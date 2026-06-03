# sub2api Fork — Frontend Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three frontend modules to the forked sub2api Vue 3 app: admin credit configuration pages, user credits display, and a modern marketing landing page.

**Architecture:** New Vue components under `frontend/src/views/`. Admin pages live in `views/admin/credits/`. User credits component is added to existing `UsageView.vue`. The landing page is a new top-level route `/` with its own `LandingLayout.vue` — completely isolated from the dashboard layout.

**Tech Stack:** Vue 3.4+, TypeScript, Vite, TailwindCSS, Pinia (state management)

**Prerequisite:** Plan A (Credits Backend) must be deployed and running.

**Working directory:** `~/sub2api/frontend/`

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/api/credits.ts` |
| Create | `src/views/admin/credits/AdminCreditPlansView.vue` |
| Create | `src/views/admin/credits/AdminModelRatesView.vue` |
| Modify | `src/views/user/UsageView.vue` |
| Create | `src/components/CreditBalanceCard.vue` |
| Create | `src/layouts/LandingLayout.vue` |
| Create | `src/views/public/LandingView.vue` |
| Modify | `src/router/index.ts` |

---

## Task 1: Add Credits API Client

**Files:**
- Create: `src/api/credits.ts`

- [ ] **Step 1: Write the API client**

Create `src/api/credits.ts`:

```typescript
import { request } from '@/utils/request'  // use the existing axios wrapper

export interface CreditBalance {
  balance: number
  expires_at: number | null  // Unix timestamp
  plan_id: number | null
}

export interface CreditLedgerEntry {
  id: number
  delta: number
  reason: string
  model: string | null
  balance_after: number
  created_at: number  // Unix timestamp
}

export interface ModelCreditRate {
  id: number
  model_pattern: string
  credits_per_1k_tokens_input: number
  credits_per_1k_tokens_output: number
  priority: number
}

export interface ClientModelsResponse {
  endpoint: string
  api_key: string
  models: Array<{ id: string; name: string; type: string }>
  credits: CreditBalance | null
}

export const creditsApi = {
  // User-facing
  getBalance: () =>
    request.get<CreditBalance>('/api/v1/credits/balance'),

  getLedger: (params: { page?: number; limit?: number } = {}) =>
    request.get<{ items: CreditLedgerEntry[]; page: number; limit: number }>(
      '/api/v1/credits/ledger',
      { params }
    ),

  // Admin
  getModelRates: () =>
    request.get<{ items: ModelCreditRate[] }>('/api/v1/admin/credits/model-rates'),

  getUserBalance: (userId: number) =>
    request.get<CreditBalance>(`/api/v1/admin/credits/users/${userId}/balance`),

  grantCredits: (data: { user_id: number; credits: number; notes?: string }) =>
    request.post('/api/v1/admin/credits/grant', data),

  // Public (no auth required)
  getPlans: () =>
    request.get('/api/v1/plans'),  // existing sub2api endpoint
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/credits.ts
git commit -m "feat(api): add credits API client"
```

---

## Task 2: Admin Model Rates Page

**Files:**
- Create: `src/views/admin/credits/AdminModelRatesView.vue`

- [ ] **Step 1: Write the component**

Create `src/views/admin/credits/AdminModelRatesView.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { creditsApi, type ModelCreditRate } from '@/api/credits'

const rates = ref<ModelCreditRate[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  try {
    const res = await creditsApi.getModelRates()
    rates.value = res.data.items
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-900">模型积分费率</h1>
    </div>

    <p class="text-sm text-gray-500">
      配置每个模型的积分消耗比例。<code>*</code> 通配符匹配任意字符（如 <code>claude-opus-4*</code>）。
      多条规则匹配同一模型时，Priority 最高的规则生效。
    </p>

    <div v-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-700">{{ error }}</div>

    <div v-if="loading" class="text-center py-8 text-gray-400">加载中…</div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">模型匹配模式</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">输入 / 1K tokens</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">输出 / 1K tokens</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">优先级</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr v-for="rate in rates" :key="rate.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-mono text-gray-900">{{ rate.model_pattern }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ rate.credits_per_1k_tokens_input }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ rate.credits_per_1k_tokens_output }}</td>
            <td class="px-4 py-3 text-right text-gray-500">{{ rate.priority }}</td>
          </tr>
          <tr v-if="rates.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-400">暂无费率配置</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-gray-400">
      提示：修改费率需直接操作数据库（model_credit_rates 表），或通过 API <code>POST /api/v1/admin/credits/model-rates</code> 完成（下一版本支持界面编辑）。
    </p>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/credits/AdminModelRatesView.vue
git commit -m "feat(admin): model credit rates view"
```

---

## Task 3: Admin Credit Grant Page

**Files:**
- Create: `src/views/admin/credits/AdminCreditPlansView.vue`

- [ ] **Step 1: Write the component**

Create `src/views/admin/credits/AdminCreditPlansView.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { creditsApi } from '@/api/credits'

const grantForm = ref({ user_id: '', credits: '', notes: '' })
const grantLoading = ref(false)
const grantResult = ref('')
const grantError = ref('')

async function handleGrant() {
  grantError.value = ''
  grantResult.value = ''
  if (!grantForm.value.user_id || !grantForm.value.credits) {
    grantError.value = '请填写用户 ID 和积分数量'
    return
  }
  grantLoading.value = true
  try {
    await creditsApi.grantCredits({
      user_id: Number(grantForm.value.user_id),
      credits: Number(grantForm.value.credits),
      notes: grantForm.value.notes,
    })
    grantResult.value = `✓ 已向用户 ${grantForm.value.user_id} 充值 ${grantForm.value.credits} 积分`
    grantForm.value = { user_id: '', credits: '', notes: '' }
  } catch (e: any) {
    grantError.value = e.message || '充值失败'
  } finally {
    grantLoading.value = false
  }
}

const checkUserId = ref('')
const checkResult = ref<{ balance: number; expires_at: number | null } | null>(null)
const checkError = ref('')

async function handleCheck() {
  checkError.value = ''
  checkResult.value = null
  if (!checkUserId.value) return
  try {
    const res = await creditsApi.getUserBalance(Number(checkUserId.value))
    checkResult.value = res.data
  } catch (e: any) {
    checkError.value = e.message || '查询失败'
  }
}
</script>

<template>
  <div class="p-6 space-y-8 max-w-2xl">
    <h1 class="text-xl font-semibold text-gray-900">积分管理</h1>

    <!-- Grant credits -->
    <section class="rounded-lg border border-gray-200 p-5 space-y-4">
      <h2 class="font-medium text-gray-800">手动充值积分</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">用户 ID</label>
          <input v-model="grantForm.user_id" type="number" placeholder="123"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">积分数量</label>
          <input v-model="grantForm.credits" type="number" placeholder="1000"
            class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-600 mb-1">备注（可选）</label>
        <input v-model="grantForm.notes" type="text" placeholder="管理员手动补偿"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div v-if="grantError" class="text-sm text-red-600">{{ grantError }}</div>
      <div v-if="grantResult" class="text-sm text-green-600">{{ grantResult }}</div>
      <button @click="handleGrant" :disabled="grantLoading"
        class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {{ grantLoading ? '充值中…' : '充值' }}
      </button>
    </section>

    <!-- Check balance -->
    <section class="rounded-lg border border-gray-200 p-5 space-y-4">
      <h2 class="font-medium text-gray-800">查询用户积分</h2>
      <div class="flex gap-3">
        <input v-model="checkUserId" type="number" placeholder="用户 ID"
          class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button @click="handleCheck"
          class="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          查询
        </button>
      </div>
      <div v-if="checkError" class="text-sm text-red-600">{{ checkError }}</div>
      <div v-if="checkResult" class="rounded bg-gray-50 p-3 text-sm space-y-1">
        <p><span class="text-gray-500">余额：</span><strong>{{ checkResult.balance.toLocaleString() }} 积分</strong></p>
        <p v-if="checkResult.expires_at">
          <span class="text-gray-500">到期：</span>{{ new Date(checkResult.expires_at * 1000).toLocaleDateString('zh-CN') }}
        </p>
        <p v-else><span class="text-gray-500">到期：</span>永不过期</p>
      </div>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/credits/AdminCreditPlansView.vue
git commit -m "feat(admin): credit management page (grant + balance check)"
```

---

## Task 4: User Credits Balance Card Component

**Files:**
- Create: `src/components/CreditBalanceCard.vue`

- [ ] **Step 1: Write the component**

Create `src/components/CreditBalanceCard.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { creditsApi, type CreditBalance } from '@/api/credits'

const balance = ref<CreditBalance | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await creditsApi.getBalance()
    balance.value = res.data
  } finally {
    loading.value = false
  }
})

const expiresText = computed(() => {
  if (!balance.value?.expires_at) return '永不过期'
  return new Date(balance.value.expires_at * 1000).toLocaleDateString('zh-CN')
})

const progressPercent = computed(() => {
  // We don't have "total" here so we show a visual indicator based on amount
  if (!balance.value) return 0
  const b = balance.value.balance
  if (b <= 0) return 0
  if (b >= 100000) return 100
  return Math.round((b / 100000) * 100)
})
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-gray-500">积分余额</h3>
      <span class="text-xs text-gray-400">到期：{{ expiresText }}</span>
    </div>

    <div v-if="loading" class="animate-pulse h-8 w-32 bg-gray-100 rounded" />

    <div v-else>
      <div class="text-3xl font-bold text-gray-900 tabular-nums">
        {{ (balance?.balance ?? 0).toLocaleString() }}
        <span class="text-base font-normal text-gray-400 ml-1">积分</span>
      </div>

      <div class="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="progressPercent > 20 ? 'bg-blue-500' : 'bg-red-500'"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <div v-if="(balance?.balance ?? 0) <= 0" class="mt-2 text-xs text-red-500">
        积分已耗尽，请购买套餐继续使用
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CreditBalanceCard.vue
git commit -m "feat(component): CreditBalanceCard for user dashboard"
```

---

## Task 5: Add Credits Display to UsageView

**Files:**
- Modify: `src/views/user/UsageView.vue`

- [ ] **Step 1: Import and add CreditBalanceCard**

At the top of `UsageView.vue`'s `<script setup>`, add the import:

```typescript
import CreditBalanceCard from '@/components/CreditBalanceCard.vue'
```

In the template, add the card at the top of the page content (before the existing usage table):

```html
<div class="mb-6">
  <CreditBalanceCard />
</div>
```

- [ ] **Step 2: Verify the page renders**

```bash
pnpm dev
# Open http://localhost:5173 and navigate to the usage page
```

Expected: credit balance card appears above the usage list.

- [ ] **Step 3: Commit**

```bash
git add src/views/user/UsageView.vue
git commit -m "feat(user): show credit balance card on usage page"
```

---

## Task 6: Register Admin Routes

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Add admin credit routes**

In `src/router/index.ts`, find the admin routes section and add:

```typescript
{
  path: 'credits/model-rates',
  component: () => import('@/views/admin/credits/AdminModelRatesView.vue'),
  meta: { title: '模型积分费率' },
},
{
  path: 'credits/manage',
  component: () => import('@/views/admin/credits/AdminCreditPlansView.vue'),
  meta: { title: '积分管理' },
},
```

These should be inside the existing admin `children` array (the same level as other admin pages like `users`, `groups`, etc.).

- [ ] **Step 2: Commit**

```bash
git add src/router/index.ts
git commit -m "feat(router): add admin credit routes"
```

---

## Task 7: Build and Verify Admin Pages

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Navigate to admin credit pages**

Open `http://localhost:5173/admin/credits/model-rates` — expect the model rates table.
Open `http://localhost:5173/admin/credits/manage` — expect the grant/check form.

- [ ] **Step 3: Fix any TypeScript errors**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git commit -m "test: verify admin credit pages render correctly"
```

---

## Task 8: Create Landing Page Layout

**Files:**
- Create: `src/layouts/LandingLayout.vue`

- [ ] **Step 1: Write the layout**

Create `src/layouts/LandingLayout.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 20
}

onMounted(() => window.addEventListener('scroll', onScroll))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="min-h-screen bg-white" style="--landing-accent: #6366f1;">
    <!-- Sticky nav -->
    <header
      class="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      :class="scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'"
    >
      <nav class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2 font-bold text-lg text-gray-900">
          <span class="text-indigo-600">◆</span> Sub2API
        </RouterLink>
        <div class="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#features" class="hover:text-gray-900">功能</a>
          <a href="#pricing" class="hover:text-gray-900">定价</a>
          <a href="#how" class="hover:text-gray-900">使用方法</a>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink to="/auth/login"
            class="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">登录</RouterLink>
          <RouterLink to="/auth/register"
            class="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors">
            免费注册
          </RouterLink>
        </div>
      </nav>
    </header>

    <!-- Page content -->
    <main>
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-100 py-8 mt-16">
      <div class="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400 space-y-2">
        <p>© {{ new Date().getFullYear() }} Sub2API · 开源 AI API 中转平台</p>
        <p class="space-x-4">
          <a href="/legal/terms" class="hover:text-gray-600">服务条款</a>
          <a href="/legal/privacy" class="hover:text-gray-600">隐私政策</a>
        </p>
      </div>
    </footer>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/LandingLayout.vue
git commit -m "feat(layout): LandingLayout with sticky nav and footer"
```

---

## Task 9: Create the Landing Page

**Files:**
- Create: `src/views/public/LandingView.vue`

- [ ] **Step 1: Write the landing page**

Create `src/views/public/LandingView.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import LandingLayout from '@/layouts/LandingLayout.vue'
import { creditsApi } from '@/api/credits'

interface Plan {
  id: number
  name: string
  price: number
  credits: number
  validity_days: number
  features: string
  for_sale: boolean
}

const plans = ref<Plan[]>([])

onMounted(async () => {
  try {
    const res = await creditsApi.getPlans()
    plans.value = (res.data?.items ?? []).filter((p: Plan) => p.for_sale)
  } catch {
    // Non-critical, landing page still works without plans
  }
})

const features = [
  {
    icon: '🤖',
    title: '多模型统一接入',
    desc: 'Claude、GPT-4o、Gemini 一个平台全覆盖，一个 API Key 搞定所有模型。',
  },
  {
    icon: '💎',
    title: '积分透明计费',
    desc: '订阅即获积分，每次调用按模型消耗积分，余额实时可见，不再为账单焦虑。',
  },
  {
    icon: '⚡',
    title: 'StoryClaw 一键配置',
    desc: '在 StoryClaw 中输入账号登录，模型列表自动加载，无需手动配置任何参数。',
  },
]

const steps = [
  { num: '01', title: '注册账号', desc: '邮箱注册，30 秒完成' },
  { num: '02', title: '选择套餐', desc: '按需购买积分，微信/支付宝支付' },
  { num: '03', title: 'StoryClaw 连接', desc: '输入服务器地址，一键登录' },
  { num: '04', title: '开始使用', desc: '模型自动配置，立即可用' },
]

const models = ['Claude Opus 4', 'Claude Sonnet 4', 'GPT-4o', 'GPT-4o mini', 'Gemini 2.0 Flash', 'Gemini 2.5 Pro']
</script>

<template>
  <LandingLayout>
    <!-- Hero -->
    <section class="pt-32 pb-20 px-4 text-center bg-gradient-to-b from-indigo-50/60 to-white">
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full">
          <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> 开源 · 自托管
        </div>
        <h1 class="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
          一个订阅，<br />
          <span class="text-indigo-600">接入所有 AI 模型</span>
        </h1>
        <p class="text-xl text-gray-500 max-w-xl mx-auto leading-relaxed">
          基于 sub2api 构建，积分透明计费，StoryClaw 一键配置，拒绝繁琐的 API Key 管理。
        </p>
        <div class="flex items-center justify-center gap-4 pt-2">
          <RouterLink to="/auth/register"
            class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200">
            免费开始使用 →
          </RouterLink>
          <a href="#pricing"
            class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-4 py-3">
            查看定价
          </a>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="py-20 px-4">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-center text-3xl font-bold text-gray-900 mb-12">为什么选择我们</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div v-for="f in features" :key="f.title"
            class="rounded-2xl border border-gray-100 bg-gray-50 p-6 space-y-3 hover:shadow-md transition-shadow">
            <div class="text-3xl">{{ f.icon }}</div>
            <h3 class="font-semibold text-gray-900">{{ f.title }}</h3>
            <p class="text-sm text-gray-500 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Models -->
    <section class="py-12 px-4 bg-gray-50 overflow-hidden">
      <div class="max-w-5xl mx-auto">
        <p class="text-center text-sm text-gray-400 mb-6 uppercase tracking-widest">支持的模型</p>
        <div class="flex flex-wrap justify-center gap-3">
          <span v-for="m in models" :key="m"
            class="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 font-medium shadow-sm">
            {{ m }}
          </span>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="py-20 px-4">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-center text-3xl font-bold text-gray-900 mb-4">透明定价</h2>
        <p class="text-center text-gray-500 mb-12">购买即得积分，按用量消耗，到期前不浪费</p>

        <div v-if="plans.length === 0"
          class="text-center text-gray-400 py-12">套餐加载中…</div>

        <div v-else class="grid md:grid-cols-3 gap-6">
          <div v-for="(plan, i) in plans" :key="plan.id"
            class="relative rounded-2xl border-2 p-6 space-y-4 transition-shadow hover:shadow-lg"
            :class="i === 1 ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-gray-200'">
            <div v-if="i === 1"
              class="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              最受欢迎
            </div>
            <div>
              <h3 class="font-bold text-xl text-gray-900">{{ plan.name }}</h3>
              <p class="text-3xl font-extrabold text-gray-900 mt-2">
                ¥{{ (plan.price).toFixed(0) }}
                <span class="text-base font-normal text-gray-400">/ {{ plan.validity_days }} 天</span>
              </p>
            </div>
            <div class="flex items-center gap-2 text-indigo-700 font-semibold text-lg">
              <span>{{ plan.credits.toLocaleString() }}</span>
              <span class="text-sm font-normal text-gray-400">积分</span>
            </div>
            <ul class="text-sm text-gray-600 space-y-2">
              <li v-for="feat in plan.features.split('\n').filter(Boolean)" :key="feat"
                class="flex items-start gap-2">
                <span class="text-green-500 mt-0.5">✓</span>{{ feat }}
              </li>
            </ul>
            <RouterLink to="/auth/register"
              class="block text-center py-2.5 rounded-xl font-medium transition-colors"
              :class="i === 1
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">
              立即购买
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="py-20 px-4 bg-gray-50">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-center text-3xl font-bold text-gray-900 mb-12">4 步开始使用</h2>
        <div class="grid md:grid-cols-4 gap-6">
          <div v-for="step in steps" :key="step.num" class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg">
              {{ step.num }}
            </div>
            <h4 class="font-semibold text-gray-900">{{ step.title }}</h4>
            <p class="text-sm text-gray-500">{{ step.desc }}</p>
          </div>
        </div>
        <div class="mt-12 text-center">
          <RouterLink to="/auth/register"
            class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
            立即开始 →
          </RouterLink>
        </div>
      </div>
    </section>
  </LandingLayout>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/public/LandingView.vue
git commit -m "feat(landing): modern marketing landing page with dynamic pricing"
```

---

## Task 10: Register Landing Page Route

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Add the landing page as the root route**

In `src/router/index.ts`, find the routes array. The current root `/` likely redirects to `/dashboard` or shows the login page. Change it:

```typescript
{
  path: '/',
  component: () => import('@/views/public/LandingView.vue'),
  meta: { title: 'Sub2API - AI API 中转平台', public: true },
},
```

Ensure this route is NOT wrapped by the auth guard (mark it as `public: true` or place it outside the authenticated route group, following the existing pattern for public routes).

- [ ] **Step 2: Verify the route guard allows the landing page**

Find the navigation guard in `src/router/index.ts` (the `router.beforeEach` call). Ensure pages with `meta.public = true` are allowed through without authentication.

- [ ] **Step 3: Build check**

```bash
pnpm build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat(router): add landing page as root route"
```

---

## Task 11: Final Dev Verification

- [ ] **Step 1: Start dev server with backend**

```bash
pnpm dev
# Backend should already be running on :8080
```

- [ ] **Step 2: Verify landing page at /**

Navigate to `http://localhost:5173/`. Expect:
- Header with logo and login/register links
- Hero section with gradient background
- Features grid (3 cards)
- Model chips row
- Pricing section (loads from API or shows placeholder)
- Steps section
- Footer

- [ ] **Step 3: Verify admin pages**

Login as admin, navigate to:
- `/admin/credits/model-rates` — model rates table
- `/admin/credits/manage` — grant credits form

- [ ] **Step 4: Verify user credits display**

Login as a regular user, navigate to `/usage`. Expect the CreditBalanceCard above the usage table.

- [ ] **Step 5: Build for production**

```bash
pnpm build
```

Expected: dist/ generated, no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete frontend extensions (credits UI + landing page)"
```

---

## What's Next

**Plan C** (`2026-06-04-plan-c-storyclaw.md`): StoryClaw desktop app connection panel and auto-model-load.
