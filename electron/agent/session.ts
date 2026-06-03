import type { BrowserWindow } from 'electron'
import type { AgentMode, AgentPermission } from '../../src/types'
import { StoryClawAgentRuntime } from './runtime'

// Per-session runtime pool: frontend sessionId → backend runtime
const runtimePool = new Map<string, StoryClawAgentRuntime>()
let cachedWorkspaceRoot = ''
let cachedWin: BrowserWindow | null = null

export async function startAgentSession(workspaceRoot: string, win: BrowserWindow): Promise<void> {
  cachedWorkspaceRoot = workspaceRoot
  cachedWin = win
  // Dispose all runtimes from the previous workspace
  const disposes = [...runtimePool.values()].map(rt => rt.dispose())
  runtimePool.clear()
  await Promise.all(disposes)
}

async function getOrCreateRuntime(sessionId: string): Promise<StoryClawAgentRuntime> {
  let rt = runtimePool.get(sessionId)
  if (!rt) {
    if (!cachedWorkspaceRoot || !cachedWin) throw new Error('Agent workspace is not initialized')
    rt = new StoryClawAgentRuntime()
    runtimePool.set(sessionId, rt)
    await rt.start(cachedWorkspaceRoot, cachedWin, sessionId)
  }
  return rt
}

export async function sendPrompt(sessionId: string, text: string, mode: AgentMode, permission: AgentPermission, modelId?: string): Promise<void> {
  const rt = await getOrCreateRuntime(sessionId)
  await rt.prompt(text, mode, permission, modelId)
}

export async function setAgentModel(modelId: string): Promise<void> {
  // Apply to all active runtimes
  await Promise.all([...runtimePool.values()].map(rt => rt.setModel(modelId)))
}

export async function stopAgent(sessionId: string): Promise<void> {
  const rt = runtimePool.get(sessionId)
  if (rt) await rt.stop()
}

export function getSession(sessionId?: string) {
  if (sessionId) return runtimePool.get(sessionId)?.session ?? null
  return [...runtimePool.values()][0]?.session ?? null
}

/**
 * IM 机器人专用：在当前工作区跑一次只读提问并返回助手回复文本。
 * 复用独立的隐藏 sessionId，避免污染前端会话。需要先打开工作区。
 */
const IM_BOT_SESSION_ID = '__im_bot__'

export async function runHeadlessPrompt(text: string, onDelta?: (full: string) => void): Promise<string> {
  if (!cachedWorkspaceRoot || !cachedWin) {
    throw new Error('请先在 StoryClaw 中打开一个项目工作区，机器人才能基于项目回答。')
  }
  const rt = await getOrCreateRuntime(IM_BOT_SESSION_ID)
  return rt.promptOnce(text, 'ask', onDelta)
}

export function isWorkspaceReady(): boolean {
  return Boolean(cachedWorkspaceRoot && cachedWin)
}
