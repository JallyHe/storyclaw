/**
 * serverConnection.ts
 * Manages the StoryClaw → sub2api backend connection.
 * Credentials are stored in userData/agent/server-connection.json.
 * On successful connection, discovered models are merged into the agent model config.
 */

import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { AgentModelConfig } from '../../src/types'
import { loadAgentConfig, saveAgentConfig } from './config'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ServerConnectionState {
  serverUrl: string
  email: string
  token: string
  tokenSavedAt: number  // epoch ms
  modelCount: number
  balance: number
  expiresAt: number | null  // Unix timestamp (seconds)
}

export interface ConnectResult {
  success: boolean
  modelCount?: number
  balance?: number
  error?: string
}

interface ClientModelsResponse {
  endpoint: string
  api_key: string
  models: Array<{ id: string; name: string; type: string }>
  credits?: { balance: number; expires_at: number | null }
}

// ── Persistence ────────────────────────────────────────────────────────────────

function connFilePath(): string {
  return path.join(app.getPath('userData'), 'agent', 'server-connection.json')
}

export async function loadConnectionState(): Promise<ServerConnectionState | null> {
  try {
    const raw = await fs.readFile(connFilePath(), 'utf8')
    return JSON.parse(raw) as ServerConnectionState
  } catch {
    return null
  }
}

async function saveConnectionState(state: ServerConnectionState): Promise<void> {
  const dir = path.dirname(connFilePath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(connFilePath(), JSON.stringify(state, null, 2), 'utf8')
}

export async function clearConnectionState(): Promise<void> {
  try {
    await fs.unlink(connFilePath())
  } catch {
    // File may not exist
  }
}

// ── Connection logic ───────────────────────────────────────────────────────────

/**
 * Authenticate and load models from the sub2api backend.
 * On success, discovered models are merged into the agent model config
 * (existing sub2api models are replaced, other models are preserved).
 */
export async function connectToServer(
  serverUrl: string,
  email: string,
  password: string
): Promise<ConnectResult> {
  const base = serverUrl.replace(/\/$/, '')

  // Step 1: Login
  let token: string
  try {
    const res = await fetch(`${base}/api/client/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as Record<string, unknown>)
      const msg = typeof body.error === 'string' ? body.error : '认证失败'
      return { success: false, error: `登录失败 (${res.status}): ${msg}` }
    }
    const loginData = await res.json() as { token: string }
    token = loginData.token
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: `无法连接到服务器: ${msg}` }
  }

  // Step 2: Load models
  let modelsData: ClientModelsResponse
  try {
    const res = await fetch(`${base}/api/client/models`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return { success: false, error: `获取模型列表失败 (${res.status})` }
    }
    modelsData = await res.json() as ClientModelsResponse
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: `获取模型列表失败: ${msg}` }
  }

  // Step 3: Merge models into agent config
  const modelCount = await mergeModels(modelsData)

  // Step 4: Persist connection state
  const state: ServerConnectionState = {
    serverUrl: base,
    email,
    token,
    tokenSavedAt: Date.now(),
    modelCount,
    balance: modelsData.credits?.balance ?? 0,
    expiresAt: modelsData.credits?.expires_at ?? null,
  }
  await saveConnectionState(state)

  return { success: true, modelCount, balance: state.balance }
}

/**
 * connectWithToken: called after browser OAuth callback with a pre-issued token.
 * Saves state and loads models without re-authenticating.
 */
export async function connectWithToken(serverUrl: string, token: string): Promise<ConnectResult> {
  const base = serverUrl.replace(/\/$/, '')

  // Load models with the token
  let modelsData: ClientModelsResponse
  try {
    const res = await fetch(`${base}/api/client/models`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return { success: false, error: `获取模型列表失败 (${res.status})` }
    }
    modelsData = await res.json() as ClientModelsResponse
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: `获取模型列表失败: ${msg}` }
  }

  const modelCount = await mergeModels(modelsData)
  const state: ServerConnectionState = {
    serverUrl: base,
    email: '',          // not known from token-only flow; can be fetched later
    token,
    tokenSavedAt: Date.now(),
    modelCount,
    balance: modelsData.credits?.balance ?? 0,
    expiresAt: modelsData.credits?.expires_at ?? null,
  }
  await saveConnectionState(state)
  return { success: true, modelCount, balance: state.balance }
}

/**
 * Remove all sub2api models from the config and disconnect.
 */
export async function disconnectFromServer(): Promise<void> {
  const config = await loadAgentConfig()
  const filtered = config.models.filter(m => m.providerId !== 'sub2api')
  const activeId = filtered.some(m => m.id === config.activeModelId)
    ? config.activeModelId
    : (filtered[0]?.id ?? '')
  await saveAgentConfig({ ...config, models: filtered, activeModelId: activeId })
  await clearConnectionState()
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function mergeModels(data: ClientModelsResponse): Promise<number> {
  const config = await loadAgentConfig()

  // Remove existing sub2api models (we replace them fully on each connect)
  const nonSub2Api = config.models.filter(m => m.providerId !== 'sub2api')

  // Build new models from the response
  const newModels: AgentModelConfig[] = (data.models ?? []).map(m => ({
    id: `sub2api-${m.id}`,
    providerId: 'sub2api',
    displayName: m.name,
    model: m.id,
    api: 'openai-completions' as const,
    baseUrl: data.endpoint,
    apiKey: data.api_key,
    enabled: true,
    reasoning: false,
    defaultMode: 'craft' as const,
    supportsTools: true,
    supportsVision: false,
  }))

  const merged = [...newModels, ...nonSub2Api]
  const activeId = newModels[0]?.id ?? config.activeModelId ?? ''
  await saveAgentConfig({ ...config, models: merged, activeModelId: activeId })
  return newModels.length
}
