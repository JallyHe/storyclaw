# StoryClaw — Backend Connection & Auto-Model-Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "连接 AI 服务" panel to StoryClaw's settings that lets users log in to their sub2api backend and automatically load available AI models into StoryClaw's configuration.

**Architecture:** New `ServerConnectionService` handles auth + model discovery via the `/api/client/` endpoints. Credentials are persisted in electron-store (already encrypted). On successful connection, the service writes discovered models into StoryClaw's existing model configuration store. The UI is a new settings section within the existing settings panel component.

**Tech Stack:** TypeScript, Electron, electron-store, Vite

**Prerequisite:** Plan A (Credits Backend) deployed. The sub2api backend must be running and accessible.

**Working directory:** StoryClaw repo root (`D:\codeup\StoryClaw`)

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/main/services/serverConnectionService.ts` |
| Create | `src/main/services/serverConnectionService.test.ts` |
| Create | `src/preload/serverConnectionApi.ts` |
| Modify | `src/preload/index.ts` |
| Create | `src/renderer/src/components/settings/ServerConnectionPanel.vue` |
| Modify | `src/renderer/src/components/settings/SettingsPanel.vue` (or the existing settings entry point) |

> **Note:** Adjust paths to match the actual StoryClaw file structure. Run `ls src/main/services/` and `ls src/renderer/src/components/` before starting to verify directory names.

---

## Task 1: Understand Existing StoryClaw Settings and Model Config

- [ ] **Step 1: Discover the settings panel entry point**

```bash
ls src/renderer/src/components/
ls src/main/services/ 2>/dev/null || ls electron/main/services/ 2>/dev/null || find src -name '*service*' -type f | head -20
```

- [ ] **Step 2: Find how API keys/models are currently configured**

```bash
grep -r "apiKey\|modelId\|endpoint\|electron-store\|store\." src/ --include="*.ts" -l | head -10
```

- [ ] **Step 3: Check electron-store usage**

```bash
grep -r "new Store\|electron-store\|app.getPath" src/ --include="*.ts" | head -10
```

Note the store schema and which keys are used for AI configuration. This determines what `ServerConnectionService.applyToStore()` must write.

- [ ] **Step 4: Document findings in a comment**

This step is informational — record the key paths found above as a comment in `serverConnectionService.ts` during Task 2.

---

## Task 2: Create ServerConnectionService

**Files:**
- Create: `src/main/services/serverConnectionService.ts`
- Create: `src/main/services/serverConnectionService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/main/services/serverConnectionService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron-store
vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock fetch
global.fetch = vi.fn()

import { ServerConnectionService } from './serverConnectionService'

describe('ServerConnectionService', () => {
  let svc: ServerConnectionService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new ServerConnectionService()
  })

  it('should return error on bad credentials', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: '邮箱或密码错误' }),
    })
    const result = await svc.connect('https://test.com', 'a@b.com', 'wrong')
    expect(result.success).toBe(false)
    expect(result.error).toContain('401')
  })

  it('should return success and store token on valid credentials', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.test.sig'
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: fakeToken, expires_at: '2026-09-01T00:00:00Z' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          endpoint: 'https://test.com/v1',
          api_key: 'sk-test-key',
          models: [{ id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4', type: 'claude' }],
          credits: { balance: 5000, expires_at: null },
        }),
      })
    const result = await svc.connect('https://test.com', 'user@test.com', 'pass')
    expect(result.success).toBe(true)
    expect(result.modelCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to see it fail**

```bash
npx vitest run src/main/services/serverConnectionService.test.ts 2>&1 | tail -20
```

Expected: FAIL — `serverConnectionService` module not found.

- [ ] **Step 3: Write the implementation**

Create `src/main/services/serverConnectionService.ts`:

```typescript
// ServerConnectionService connects StoryClaw to a sub2api backend instance.
// The backend must have Plan A deployed (credits backend + /api/client/ endpoints).
//
// Store keys written on successful connection:
//   serverConnection.serverUrl   — the backend base URL
//   serverConnection.token       — the client JWT token
//   serverConnection.tokenExpiry — ISO timestamp of token expiry
//   aiConfig.endpoint            — the OpenAI-compatible endpoint URL (/v1)
//   aiConfig.apiKey              — the user's sub2api API key
//   aiConfig.models              — array of available model objects

import Store from 'electron-store'

interface StoreSchema {
  serverConnection?: {
    serverUrl?: string
    token?: string
    tokenExpiry?: string
    email?: string
  }
  aiConfig?: {
    endpoint?: string
    apiKey?: string
    models?: Array<{ id: string; name: string; type: string }>
  }
}

export interface ConnectResult {
  success: boolean
  modelCount?: number
  balance?: number
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  serverUrl?: string
  email?: string
  balance?: number
  expiresAt?: number | null
  modelCount?: number
}

export class ServerConnectionService {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({ name: 'storyclaw-server' })
  }

  // connect authenticates to the backend and loads models into the store.
  async connect(serverUrl: string, email: string, password: string): Promise<ConnectResult> {
    const base = serverUrl.replace(/\/$/, '')

    // Step 1: Login
    let token: string
    try {
      const loginRes = await fetch(`${base}/api/client/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}))
        return { success: false, error: `登录失败 (${loginRes.status}): ${body.error ?? '未知错误'}` }
      }
      const loginData = await loginRes.json()
      token = loginData.token

      this.store.set('serverConnection', {
        serverUrl: base,
        token,
        tokenExpiry: loginData.expires_at,
        email,
      })
    } catch (e: any) {
      return { success: false, error: `无法连接到服务器: ${e.message}` }
    }

    // Step 2: Load models
    try {
      const modelsRes = await fetch(`${base}/api/client/models`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!modelsRes.ok) {
        return { success: false, error: `获取模型失败 (${modelsRes.status})` }
      }
      const modelsData = await modelsRes.json()

      this.store.set('aiConfig', {
        endpoint: modelsData.endpoint,
        apiKey: modelsData.api_key,
        models: modelsData.models ?? [],
      })

      return {
        success: true,
        modelCount: modelsData.models?.length ?? 0,
        balance: modelsData.credits?.balance ?? 0,
      }
    } catch (e: any) {
      return { success: false, error: `获取模型失败: ${e.message}` }
    }
  }

  // disconnect clears stored credentials and AI config.
  disconnect(): void {
    this.store.delete('serverConnection')
    this.store.delete('aiConfig')
  }

  // getStatus returns current connection state.
  getStatus(): ConnectionStatus {
    const conn = this.store.get('serverConnection')
    const ai = this.store.get('aiConfig')
    if (!conn?.token) {
      return { connected: false }
    }
    return {
      connected: true,
      serverUrl: conn.serverUrl,
      email: conn.email,
      modelCount: ai?.models?.length ?? 0,
    }
  }

  // refreshIfNeeded silently refreshes the token if it expires within 7 days.
  async refreshIfNeeded(): Promise<void> {
    const conn = this.store.get('serverConnection')
    if (!conn?.token || !conn.tokenExpiry || !conn.serverUrl) return

    const expiry = new Date(conn.tokenExpiry)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    if (expiry > sevenDaysFromNow) return

    try {
      const res = await fetch(`${conn.serverUrl}/api/client/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        this.store.set('serverConnection', { ...conn, token: data.token, tokenExpiry: data.expires_at })
      }
    } catch {
      // Silently fail — user will see "disconnected" on next status check
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/main/services/serverConnectionService.test.ts 2>&1 | tail -20
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/serverConnectionService.ts src/main/services/serverConnectionService.test.ts
git commit -m "feat(main): ServerConnectionService for sub2api backend integration"
```

---

## Task 3: Expose IPC API via Preload

**Files:**
- Create: `src/preload/serverConnectionApi.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Check existing preload pattern**

```bash
cat src/preload/index.ts | head -40
```

Note how existing APIs are exposed (likely via `contextBridge.exposeInMainWorld`).

- [ ] **Step 2: Create the server connection preload module**

Create `src/preload/serverConnectionApi.ts`:

```typescript
import { ipcRenderer } from 'electron'
import type { ConnectResult, ConnectionStatus } from '../main/services/serverConnectionService'

export const serverConnectionApi = {
  connect: (serverUrl: string, email: string, password: string): Promise<ConnectResult> =>
    ipcRenderer.invoke('server-connection:connect', serverUrl, email, password),

  disconnect: (): Promise<void> =>
    ipcRenderer.invoke('server-connection:disconnect'),

  getStatus: (): Promise<ConnectionStatus> =>
    ipcRenderer.invoke('server-connection:getStatus'),
}
```

- [ ] **Step 3: Expose in preload/index.ts**

In `src/preload/index.ts`, import and expose the API:

```typescript
import { serverConnectionApi } from './serverConnectionApi'

// Add to the contextBridge.exposeInMainWorld call, following existing patterns:
contextBridge.exposeInMainWorld('serverConnectionApi', serverConnectionApi)
```

If the existing preload uses a different pattern (e.g., a single `api` object), add `serverConnection: serverConnectionApi` to that object instead.

- [ ] **Step 4: Register IPC handlers in main process**

In the main process entry (likely `src/main/index.ts`), add the IPC handlers:

```typescript
import { ServerConnectionService } from './services/serverConnectionService'

const serverConnectionService = new ServerConnectionService()

ipcMain.handle('server-connection:connect', async (_event, serverUrl: string, email: string, password: string) => {
  return serverConnectionService.connect(serverUrl, email, password)
})

ipcMain.handle('server-connection:disconnect', async () => {
  serverConnectionService.disconnect()
})

ipcMain.handle('server-connection:getStatus', async () => {
  return serverConnectionService.getStatus()
})

// Refresh token on startup
app.on('ready', async () => {
  await serverConnectionService.refreshIfNeeded()
})
```

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -20
# or: pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/preload/ src/main/index.ts
git commit -m "feat(preload): expose serverConnectionApi to renderer via IPC"
```

---

## Task 4: Create the Settings Panel Component

**Files:**
- Create: `src/renderer/src/components/settings/ServerConnectionPanel.vue`

- [ ] **Step 1: Write the component**

Create `src/renderer/src/components/settings/ServerConnectionPanel.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ConnectionStatus {
  connected: boolean
  serverUrl?: string
  email?: string
  modelCount?: number
  balance?: number
}

const status = ref<ConnectionStatus>({ connected: false })
const form = ref({ serverUrl: '', email: '', password: '' })
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

async function loadStatus() {
  try {
    status.value = await window.serverConnectionApi.getStatus()
  } catch {
    status.value = { connected: false }
  }
}

onMounted(loadStatus)

async function handleConnect() {
  error.value = ''
  successMsg.value = ''
  if (!form.value.serverUrl || !form.value.email || !form.value.password) {
    error.value = '请填写所有字段'
    return
  }
  loading.value = true
  try {
    const result = await window.serverConnectionApi.connect(
      form.value.serverUrl,
      form.value.email,
      form.value.password
    )
    if (result.success) {
      successMsg.value = `✓ 已连接，加载了 ${result.modelCount} 个模型`
      form.value.password = ''
      await loadStatus()
    } else {
      error.value = result.error ?? '连接失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleDisconnect() {
  await window.serverConnectionApi.disconnect()
  status.value = { connected: false }
  successMsg.value = ''
  error.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">连接 AI 服务</h3>
      <span v-if="status.connected"
        class="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full" />
        已连接
      </span>
    </div>

    <!-- Connected state -->
    <div v-if="status.connected"
      class="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2 text-sm">
      <p class="text-gray-700">
        <span class="text-gray-400">服务器：</span>{{ status.serverUrl }}
      </p>
      <p class="text-gray-700">
        <span class="text-gray-400">账号：</span>{{ status.email }}
      </p>
      <p class="text-gray-700">
        <span class="text-gray-400">已加载模型：</span>{{ status.modelCount ?? 0 }} 个
      </p>
      <button
        @click="handleDisconnect"
        class="mt-2 text-xs text-red-600 hover:text-red-700 underline"
      >
        断开连接
      </button>
    </div>

    <!-- Login form -->
    <div v-else class="space-y-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">服务器地址</label>
        <input
          v-model="form.serverUrl"
          type="url"
          placeholder="https://your-server.com"
          class="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">邮箱</label>
        <input
          v-model="form.email"
          type="email"
          placeholder="user@example.com"
          class="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">密码</label>
        <input
          v-model="form.password"
          type="password"
          placeholder="••••••••"
          class="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          @keydown.enter="handleConnect"
        />
      </div>

      <div v-if="error" class="text-xs text-red-600 rounded bg-red-50 p-2">{{ error }}</div>
      <div v-if="successMsg" class="text-xs text-green-600 rounded bg-green-50 p-2">{{ successMsg }}</div>

      <button
        @click="handleConnect"
        :disabled="loading"
        class="w-full rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
      >
        {{ loading ? '连接中…' : '连接' }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add TypeScript declaration for the window API**

In `src/renderer/src/env.d.ts` (or `src/renderer/src/types/global.d.ts`), add:

```typescript
interface Window {
  serverConnectionApi: {
    connect(serverUrl: string, email: string, password: string): Promise<{
      success: boolean
      modelCount?: number
      balance?: number
      error?: string
    }>
    disconnect(): Promise<void>
    getStatus(): Promise<{
      connected: boolean
      serverUrl?: string
      email?: string
      modelCount?: number
      balance?: number
    }>
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ServerConnectionPanel.vue src/renderer/src/env.d.ts
git commit -m "feat(renderer): ServerConnectionPanel settings component"
```

---

## Task 5: Integrate Panel into Settings

**Files:**
- Modify: the existing settings component (find via step below)

- [ ] **Step 1: Find the settings entry point**

```bash
grep -r "Settings\|settings\|SettingsPanel" src/renderer --include="*.vue" -l | head -5
grep -r "API\|apiKey\|endpoint\|model" src/renderer --include="*.vue" -l | head -5
```

Identify the Vue component that hosts AI settings (API key input, model selection, etc.).

- [ ] **Step 2: Import and place the panel**

In that settings component, add:

```typescript
import ServerConnectionPanel from './ServerConnectionPanel.vue'
// (adjust relative path as needed)
```

In the template, add a new section (e.g., after the existing API key section, or as the first section under an "AI 服务连接" heading):

```html
<section class="border-t border-gray-100 pt-4 mt-4">
  <ServerConnectionPanel />
</section>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/
git commit -m "feat(settings): add ServerConnectionPanel to settings panel"
```

---

## Task 6: Wire Model Config to StoryClaw's Model Selector

After `connect()` succeeds, StoryClaw needs to use the downloaded models. The exact implementation depends on how StoryClaw currently manages its model list.

- [ ] **Step 1: Find where models are stored and consumed**

```bash
grep -r "models\|modelList\|selectedModel\|setModel" src/renderer --include="*.ts" --include="*.vue" -l | head -10
grep -r "aiConfig\|getModel\|loadModel" src/ --include="*.ts" -l | head -10
```

- [ ] **Step 2: Update model loading to read from the connection store**

In the main process, add a handler that returns the stored models:

```typescript
ipcMain.handle('server-connection:getModels', async () => {
  return serverConnectionService.getStoredModels()
})
```

Add `getStoredModels()` to `ServerConnectionService`:

```typescript
getStoredModels(): Array<{ id: string; name: string; type: string }> {
  const ai = this.store.get('aiConfig')
  return ai?.models ?? []
}
```

- [ ] **Step 3: In the renderer, merge server models with local models**

In wherever models are loaded (the store or composable that supplies the model dropdown), add:

```typescript
// After loading local/hardcoded models, merge in server models
const serverModels = await window.serverConnectionApi.getModels?.() ?? []
// Prepend server models to the list (they take priority)
allModels.value = [...serverModels, ...localModels]
```

This is a best-effort integration — the exact code depends on StoryClaw's model state management. Adjust to fit the existing pattern.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: merge server models into StoryClaw model selector"
```

---

## Task 7: End-to-End Test

- [ ] **Step 1: Start the sub2api backend**

In the sub2api repo:
```bash
cd backend && go run ./cmd/server/...
```

- [ ] **Step 2: Start StoryClaw in dev mode**

```bash
pnpm dev
# (or: npm run dev)
```

- [ ] **Step 3: Open settings and connect**

1. Open StoryClaw app
2. Navigate to Settings
3. Find "连接 AI 服务" panel
4. Enter: `http://localhost:8080`, your test email, password
5. Click "连接"
6. Expect: "✓ 已连接，加载了 N 个模型"

- [ ] **Step 4: Verify models appear in model selector**

Open a new document or chat, check the model dropdown — the server's models should appear.

- [ ] **Step 5: Test disconnection**

Click "断开连接" → panel shows the login form again, server models disappear from selector.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: StoryClaw server connection E2E tested and working"
```

---

## Notes

- The `getModels` IPC handler in Task 6 may need to be added to `serverConnectionApi.ts` preload file too.
- If StoryClaw uses a Pinia store for models, call a store action instead of setting a ref directly.
- Token refresh happens on app startup (`app.on('ready', ...)`); for a better UX, also refresh on wake from sleep via `powerMonitor.on('resume', ...)`.
