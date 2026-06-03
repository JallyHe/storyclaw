# sub2api 平台扩展设计文档

**日期：** 2026-06-04  
**状态：** 已批准  
**范围：** Fork sub2api 并添加积分系统、宣传首页、StoryClaw 客户端集成

---

## 概述

基于开源项目 [sub2api](https://github.com/Wei-Shaw/sub2api) Fork 并扩展，构建一个完整的 AI API 中转订阅平台。sub2api 已提供账号管理、API Key 分发、Token 计费、微信/支付宝支付、用户控制台、管理后台等核心功能——本设计**仅扩展不替换**。

### 新增内容

| 子系统 | 说明 |
|--------|------|
| 积分系统 | 在 token 计费之上叠加积分抽象层，用户看到积分而非 token |
| 宣传首页 | 现代化营销落地页，动态展示定价等级 |
| StoryClaw 集成 | 桌面客户端一键连接后端，自动加载模型配置 |

---

## §1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  Fork: sub2api 仓库                      │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────┐    │
│  │  Go 后端         │    │  Vue 3 前端               │    │
│  │                 │    │                           │    │
│  │ 原有模块不动:     │    │ 原有页面不动:              │    │
│  │  - 账号管理      │    │  - 用户控制台             │    │
│  │  - API Key      │    │  - 登录/注册               │    │
│  │  - Token 计费   │    │  - 管理后台               │    │
│  │  - 微信/支付宝   │    │                           │    │
│  │                 │    │ 新增:                      │    │
│  │ 新增模块:        │    │  - 宣传首页 (/)            │    │
│  │  - 积分中间件    │    │  - 积分展示组件            │    │
│  │  - 积分账本 DB  │    │  - 管理员积分配置页         │    │
│  │  - 模型比例配置  │    │                           │    │
│  │  - Client API   │    └──────────────────────────┘    │
│  └─────────────────┘                                     │
│           │                                              │
│    PostgreSQL + Redis (原有)                              │
└─────────────────────────────────────────────────────────┘
                           │
                   ┌───────┴───────┐
                   │  StoryClaw    │
                   │  桌面应用     │
                   └───────────────┘
```

**三条主线互不耦合：**
- 积分系统作为 Go 中间件插入现有计费流程，不改变 token 计数逻辑
- 宣传首页作为 Vue Router 新路由，独立视觉组件
- StoryClaw 集成通过新的 `/api/client/` 端点对接

---

## §2 积分系统

### 数据库新增表

```sql
-- 会员等级配置（管理员可改）
credit_plans (
  id            BIGINT PRIMARY KEY,
  name          TEXT NOT NULL,        -- "基础版" "专业版" "旗舰版"
  price_cny     INT NOT NULL,         -- 单位：分
  credits       BIGINT NOT NULL,      -- 购买后获得的积分总量
  validity_days INT NOT NULL,         -- 有效期天数
  is_active     BOOL NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)

-- 模型积分消耗比例（管理员可改）
model_credit_rates (
  id                          BIGINT PRIMARY KEY,
  model_pattern               TEXT NOT NULL,  -- 支持通配符，如 "claude-opus-4*"
  credits_per_1k_tokens_input  INT NOT NULL,
  credits_per_1k_tokens_output INT NOT NULL,
  priority                    INT NOT NULL DEFAULT 0,  -- 多条匹配时取最高优先级
  updated_at                  TIMESTAMPTZ
)

-- 用户积分账本（append-only 流水，不删不改）
credit_ledger (
  id             BIGINT PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  delta          BIGINT NOT NULL,       -- 正=充值，负=消耗
  reason         TEXT NOT NULL,         -- "purchase" | "api_call" | "admin_grant"
  ref_id         TEXT,                  -- 关联订单 ID 或请求 ID
  balance_after  BIGINT NOT NULL,       -- 写入时的余额快照
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 用户当前积分状态（冗余缓存，由触发器维护）
user_credits (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id),
  balance    BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  plan_id    BIGINT REFERENCES credit_plans(id)
)
```

### 请求处理流程

```
API 请求到达
    │
    ├─ sub2api 原有中间件：认证、限速、账号选择（不变）
    │
    ├─ 积分预检（新增，请求前）：
    │    从 Redis 读取用户余额缓存
    │    余额 <= 0 → 返回 402 Payment Required
    │
    ├─ 转发请求到上游 AI 服务（不变）
    │
    └─ 积分扣减（新增，响应后）：
         1. 按 model_pattern 匹配消耗比例（优先级最高的规则）
         2. delta = -(input/1000 × rate_in + output/1000 × rate_out)
         3. 写 credit_ledger 流水（异步，不阻塞响应）
         4. 更新 Redis 余额缓存
         5. 同步 user_credits 表（批量，每分钟 flush）
```

### 用户控制台展示

在现有 `UsageView.vue` 中新增积分摘要组件：
- 剩余积分 + 进度条（已用 / 总量）
- 到期时间
- 消耗明细列表（时间、模型名、消耗积分，不显示 token 数）

### 管理员配置（新增两个页面）

- **`AdminCreditPlansView.vue`**：管理 `credit_plans`，配置各等级名称、价格、积分量、有效期
- **`AdminModelRatesView.vue`**：配置 `model_credit_rates`，支持通配符，实时预览换算示例

---

## §3 宣传首页

### 路由

```
/          → LandingView.vue（新建，独立 LandingLayout，不复用 Dashboard 布局）
/pricing   → 等同 /#pricing（锚点）
```

### 页面分区

| 区域 | 内容 |
|------|------|
| Header | Logo + 导航链接 + 登录/注册按钮，滚动后固定 |
| Hero | 主标语 + 副标语 + CTA 按钮 + 渐变/动态背景 |
| 特性展示 | 3列卡片：多模型支持 / 积分透明计费 / 一键客户端配置 |
| 支持模型 | 横向滚动 Logo 墙：Claude、GPT-4o、Gemini 等 |
| 定价区 | 动态读取 `credit_plans`，3档会员卡片，推荐档高亮 |
| 使用步骤 | 步骤图：注册 → 购买套餐 → StoryClaw 连接 → 开始使用 |
| Footer | 备案号、服务条款、隐私政策 |

### 技术约束

- 独立 CSS 自定义属性，不复用管理后台设计 token
- 定价区调用 `GET /api/plans`（现有端点），管理员改价后自动更新
- 完全公开，无需登录，`<title>` 和 `<meta>` 支持 SEO

---

## §4 StoryClaw 客户端集成

### 后端新增端点（`/api/client/` 前缀，需 client_token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/client/auth/login` | 邮箱密码换取 client_token（JWT，30 天有效） |
| POST | `/api/client/auth/refresh` | 静默刷新 token |
| GET  | `/api/client/models` | 返回可用模型列表 + endpoint + api_key |
| GET  | `/api/client/credits` | 返回积分余额和到期时间 |
| GET  | `/api/client/profile` | 返回用户基本信息 |

**`GET /api/client/models` 响应格式：**

```json
{
  "endpoint": "https://your-server.com/v1",
  "api_key": "sk-user-xxxxxxxx",
  "models": [
    { "id": "claude-opus-4-5", "name": "Claude Opus 4", "type": "claude" },
    { "id": "gpt-4o", "name": "GPT-4o", "type": "openai" }
  ],
  "credits": {
    "balance": 8420,
    "expires_at": "2026-09-01T00:00:00Z"
  }
}
```

### StoryClaw 端改动

**新增设置面板区块「连接 AI 服务」：**

```
┌─ 连接你的 AI 服务 ────────────────────────────────┐
│  服务器地址  [https://your-server.com         ]   │
│  邮箱       [user@example.com                ]   │
│  密码       [••••••••                        ]   │
│                              [连接]              │
│  ✓ 已连接   余额：8,420 积分   到期：2026-09-01   │
│  已加载 12 个模型                                 │
└───────────────────────────────────────────────── ┘
```

### 支付与积分充值的衔接

sub2api 现有支付流程在订单完成后触发 webhook 回调。本设计在该回调中插入充值逻辑：

```
支付回调（微信/支付宝） → 原有订单状态更新（不变）
                        → 新增：按订单关联的 credit_plan 向 credit_ledger 写充值流水
                               更新 user_credits.balance 和 expires_at
                               刷新 Redis 余额缓存
```

管理员也可通过后台手动为用户充值（reason = "admin_grant"）。

---

**连接成功后行为：**
1. 调用现有模型配置逻辑，将 endpoint + api_key + models 写入 StoryClaw 配置
2. 用户不需要手动填写任何 API 信息
3. client_token 存入 electron-store（已加密）

**容错：**
- 服务不可达 → 降级为手动配置模式，不影响已有设置
- token 过期前 7 天 → 启动时静默刷新

---

## 实现顺序

1. Fork sub2api 仓库，搭建本地开发环境
2. 数据库迁移：新增 4 张积分相关表
3. Go 后端：积分中间件 + `/api/client/` 端点
4. Vue 前端：管理员积分配置页（`AdminCreditPlansView`、`AdminModelRatesView`）
5. Vue 前端：用户积分展示组件
6. Vue 前端：宣传首页（`LandingView.vue`）
7. StoryClaw：新增连接服务设置面板 + 模型自动加载逻辑

---

## 不在此次范围内

- 更换 sub2api 现有支付流程（微信/支付宝已支持）
- 重写现有用户控制台或管理后台页面
- CDN / 自定义域名配置
- 邮件模板定制
