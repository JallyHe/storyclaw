# StoryClaw 设计规格
_2026-05-29_

## 项目概述

StoryClaw 是一个 **Electron + React 跨平台剧本编辑器**，面向影视剧本创作者。界面风格参照 VS Code IDE，集成 Pi Agent 提供 AI 写作辅助能力（续写、diff 预览、一致性检查等）。

设计稿来源：[Anthropic Design 导出包](https://api.anthropic.com/v1/design/h/LXd7OvfA2sNW9_JOpOmAoA)，已完整解析并记录于 `design_bundle/`。

---

## 一、技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron 33+ |
| 构建工具 | electron-vite + Vite |
| UI 框架 | React 18 + TypeScript |
| 状态管理 | Zustand |
| 样式 | CSS 变量（双主题，直接从设计稿迁移） |
| AI Agent | `@earendil-works/pi-coding-agent` |
| 文件系统 | Node.js `fs/promises`（main 进程） |
| PDF 解析 | `pdf-parse`（参考资料读取） |

---

## 二、架构：方案 A

Pi Agent 运行在 **Electron main 进程**，通过 IPC 与 renderer 通信。

```
┌─ Electron Main ──────────────────────────────────┐
│  main.ts          窗口管理、IPC handler 注册        │
│  preload.ts       contextBridge 安全 API           │
│  agent/           Pi Agent 集成                    │
│    session.ts     createAgentSession + 自定义工具  │
│    tools.ts       read/write/list 剧本工具         │
│    streaming.ts   事件流 → IPC push               │
│  fs/              工作区文件系统操作               │
│    workspace.ts   打开/创建工作区、watch 变化      │
│    serializer.ts  JSON ↔ 内存模型互转             │
└──────────────────────────────────────────────────┘
         ↕  ipcMain / ipcRenderer / contextBridge
┌─ React Renderer ─────────────────────────────────┐
│  store/           Zustand：workspace、tabs、       │
│                   sessions、changes、theme         │
│  ipc/             封装 ipcRenderer.invoke/on      │
│  components/      IDE UI（见第四节）               │
└──────────────────────────────────────────────────┘
```

**IPC 通道约定**：

| 通道 | 方向 | 说明 |
|------|------|------|
| `workspace:open` | R→M | 选择并打开工作区目录 |
| `workspace:create` | R→M | 新建项目（生成默认结构） |
| `workspace:read` | R→M | 读取文件内容 |
| `workspace:write` | R→M | 写入文件内容 |
| `workspace:watch` | M→R | 文件变更推送 |
| `agent:send` | R→M | 发送 prompt 给 Pi Agent |
| `agent:stop` | R→M | 取消当前 Agent 执行 |
| `agent:event` | M→R | Pi Agent 事件流推送（text_delta / tool_start / tool_end / **change** / agent_end） |

---

## 三、文件系统与扩展名

### 3.1 自定义扩展名

| 扩展名 | 编辑器 | 说明 |
|--------|--------|------|
| `.ep` | 剧本块编辑器 | 一集完整剧本 |
| `.otl` | 大纲编辑器 | 全剧大纲 / 分集大纲 |
| `.chr` | 人物卡表单 | 单个角色档案 |
| `.wld` | 设定编辑器 | 世界观 / 设定条目 |
| `.txt` `.md` `.pdf` 等 | 参考资料查看器 | 原著、改编素材，Pi Agent 可读取 |

所有自定义格式均为 **UTF-8 JSON**，内容模型见 3.3 节。

### 3.2 新建项目默认结构

新建向导（填写：项目名 / 类型：单片｜剧集 / 集数）自动生成：

```
《项目名》/
├── 大纲/
│   ├── 全剧大纲.otl          # 三幕结构 + logline
│   ├── EP01 大纲.otl         # 分集大纲（按集数生成）
│   └── EP02 大纲.otl
├── 剧集/
│   ├── EP01 未命名.ep        # 空剧本，含剧集元数据
│   └── EP02 未命名.ep
├── 人物/
│   └── 主角.chr              # 最小化人物卡模板
├── 设定/
│   └── 世界观概述.wld
└── 参考/                     # 空目录，用户拖入任意文档
```

### 3.3 文件内容模型（JSON）

**`.ep` 剧本文件**：
```json
{
  "version": 1,
  "episode": "EP01",
  "title": "幽灵来电",
  "status": "wip",
  "logline": "...",
  "blocks": [
    { "id": "b1", "type": "scene", "number": "1",
      "intext": "内景", "location": "电台·直播间", "time": "夜",
      "synopsis": "苏晚主持深夜节目" },
    { "id": "b2", "type": "action", "text": "调音台的指示灯在黑暗里明灭。" },
    { "id": "b3", "type": "character", "name": "苏晚" },
    { "id": "b4", "type": "dialogue", "text": "凌晨两点零七分，这里是《回声》。" },
    { "id": "b5", "type": "paren", "text": "（一阵电流杂音）" }
  ]
}
```

**`.chr` 人物文件**：
```json
{
  "version": 1,
  "name": "苏晚", "role": "主角", "age": 32, "color": "#e0a458",
  "tagline": "深夜电台主播，理性、克制。",
  "traits": ["失眠", "情感隔离"],
  "arc": "从逃避到直面。",
  "voice": "措辞精准、克制；情绪崩塌时句子变短。",
  "appearsIn": ["EP01", "EP02"]
}
```

**`.otl` 大纲文件**：
```json
{
  "version": 1,
  "scope": "series",
  "logline": "...",
  "acts": [
    { "id": "a1", "act": "第一幕·建立",
      "beats": ["建立节目日常。", "第一通诡异来电。"] }
  ]
}
```

**`.wld` 设定文件**：
```json
{ "version": 1, "title": "《回声》节目", "body": "凌晨两点到四点的深夜热线节目…" }
```

---

## 四、UI 组件结构

### 4.1 两种视图（顶部切换）

| | 编辑器模式 | Agent 模式 |
|-|-----------|-----------|
| 左栏 | Activity Bar + 文件树/搜索/变更 | 会话列表（Sessions） |
| 中栏 | 标签页 + 面包屑 + 文件编辑器 | 对话线程 + 大输入框 |
| 右栏 | Copilot 辅助栏 | Changes 变更面板 |

### 4.2 组件树

```
<App>
  <Titlebar>          标题 · 视图切换 · 主题 · 面板开关
  {view === "editor"}
    <ActivityBar>     文件树 / 搜索 / 变更 图标切换
    <Explorer>        文件树（真实目录映射）
    <ResizeHandle>
    <EditorArea>
      <TabBar>        标签页 + 脏标记
      <Breadcrumb>
      <FileEditor>    路由 → ep/chr/otl/wld/ref
        <EpisodeEditor>   剧本块 + 场景导航大纲
        <CharacterEditor> 人物卡表单
        <OutlineEditor>   大纲幕/beat 编辑
        <WorldEditor>     设定富文本
        <RefViewer>       参考文档只读查看
    <ResizeHandle>
    <Copilot>         编辑器模式 AI 辅助栏
  {view === "agent"}
    <SessionList>     历史会话列表
    <ResizeHandle>
    <AgentMain>       对话线程 + AgentComposer
    <ResizeHandle>
    <ChangesPanel>    git 式变更列表 + diff + 接受/拒绝
```

### 4.3 编辑器 · 剧本块类型

| type | 显示标签 | 可编辑 |
|------|----------|--------|
| `scene` | 场头 | 否（通过专属控件） |
| `action` | 动作 | 是（contentEditable） |
| `character` | 人物 | 否 |
| `dialogue` | 对白 | 是 |
| `paren` | 潜台词 | 是 |

diff 状态：`add`（绿色）/ `del`（红色删除线）/ `null`（正常）。编辑器顶部显示 **接受 / 拒绝** 操作条。

---

## 五、Pi Agent 集成

### 5.1 自定义工具

```typescript
// tools.ts
const readScreenplay = defineTool({
  name: "read_screenplay",
  description: "读取工作区内任意剧本文件（.ep/.chr/.otl/.wld）的内容",
  parameters: Type.Object({ path: Type.String() }),
  execute: async (_id, { path }) => {
    const content = await fs.readFile(resolve(workspaceRoot, path), "utf-8");
    return { content: [{ type: "text", text: content }], details: {} };
  },
});

const writeScreenplay = defineTool({
  name: "write_screenplay",
  description: "将修改后的剧本内容写回文件，触发 UI diff 预览（不直接应用）",
  parameters: Type.Object({ path: Type.String(), content: Type.String() }),
  execute: async (_id, { path, content }) => {
    // 不直接写磁盘：读取当前文件 → 与新内容做 block 级 diff → 推送给 renderer
    // renderer 收到后展示带 add/del 标记的 diff，用户接受后才写入磁盘
    const current = await fs.readFile(resolve(workspaceRoot, path), "utf-8").catch(() => "{}");
    const diffBlocks = computeBlockDiff(JSON.parse(current), JSON.parse(content));
    win.webContents.send("agent:event", { type: "change", path, diffBlocks });
    return { content: [{ type: "text", text: `已生成 diff：${path}` }], details: {} };
  },
});

const listWorkspace = defineTool({
  name: "list_workspace",
  description: "列出工作区文件树",
  parameters: Type.Object({}),
  execute: async () => {
    const tree = await buildFileTree(workspaceRoot);
    return { content: [{ type: "text", text: JSON.stringify(tree) }], details: {} };
  },
});

const readReference = defineTool({
  name: "read_reference",
  description: "读取参考/目录下的文档内容（支持 txt/md/pdf）",
  parameters: Type.Object({ path: Type.String() }),
  execute: async (_id, { path }) => { /* 提取文本 */ },
});
```

### 5.2 事件流 → IPC

```typescript
// streaming.ts
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      win.webContents.send("agent:event", { type: "text_delta",
        delta: event.assistantMessageEvent.delta });
      break;
    case "tool_execution_start":
      win.webContents.send("agent:event", { type: "tool_start",
        tool: event.toolName, label: toolLabel(event.toolName) });
      break;
    case "tool_execution_end":
      win.webContents.send("agent:event", { type: "tool_end",
        tool: event.toolName, isError: event.isError });
      break;
    case "agent_end":
      win.webContents.send("agent:event", { type: "agent_end" });
      break;
  }
});
```

### 5.3 Agent 模式 / 权限

| 模式 | 行为 |
|------|------|
| Craft | 可读写文件、执行工具，改动需用户确认（默认权限） |
| Plan | 只输出计划，不写文件 |
| Ask | 只读，回答问题 |

写文件操作：Agent 调用 `write_screenplay` 后产生 **pending change**，推送 diff 到 UI，用户点「接受」后才写入磁盘。

---

## 六、主题 & 设计令牌

直接从设计稿 `styles.css` 迁移：

| 令牌 | 深色 | 浅色 | 用途 |
|------|------|------|------|
| `--accent` | `#e0a458` | `#e0a458` | 主题色（暖琥珀） |
| `--accent-ai` | `#8b7cf6` | `#8b7cf6` | AI 操作（柔紫） |
| `--bg-0` | `#0f1116` | `#ece8e1` | 最底背景 |
| `--c-role` | `#d292b8` | `#b56b95` | 人物文件色 |
| `--c-outline` | `#7aa6dd` | `#4f7bb5` | 大纲文件色 |
| `--c-world` | `#6cb38f` | `#3f8a64` | 设定文件色 |

剧本字体选项：思源宋体（默认）/ 思源黑体 / 霞鹜文楷 / 等宽。

---

## 七、新建项目向导

向导三步：
1. **基础信息**：项目名称、类型（单片 / 短剧集 / 长剧集）
2. **集数配置**（剧集类型）：集数、每集标题（可空，后续改）
3. **确认生成**：预览将创建的目录树，选择存储位置

生成后自动在应用内打开该工作区。

---

## 八、实现范围（MVP）

**包含**：
- 完整 IDE 布局（两种视图，面板拖拽调整宽度）
- 文件树映射真实目录，支持打开/创建工作区
- `.ep` 剧本块编辑器（场头/动作/人物/对白/潜台词）+ 场景导航大纲
- `.chr` / `.otl` / `.wld` 表单/编辑器
- 参考资料查看器（txt/md/pdf 只读）
- Pi Agent 真实集成（Craft 模式 + 自定义工具）
- diff 预览 + 接受/拒绝流程
- 深/浅双主题
- 新建项目向导

**不包含（后续迭代）**：
- 云端同步
- 多人协作
- 导出为 Final Draft / PDF
- 版本历史（Git 集成）
