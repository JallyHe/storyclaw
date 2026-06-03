// ── 机器人会话记录持久化（全局） ─────────────────────────────────────────────
// 机器人会话与具体工作区无关，单独存到 userData/im/conversations.json，
// 重启后仍可在桌面端查看历史。

import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

function imDir(): string {
  return path.join(app.getPath('userData'), 'im')
}

function filePath(): string {
  return path.join(imDir(), 'conversations.json')
}

export async function loadConversations(): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(filePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err: any) {
    if (err?.code !== 'ENOENT') console.error('[IM] 读取会话记录失败:', err)
    return []
  }
}

export async function saveConversations(sessions: unknown[]): Promise<void> {
  try {
    await fs.mkdir(imDir(), { recursive: true })
    await fs.writeFile(filePath(), JSON.stringify(sessions ?? []), 'utf8')
  } catch (err) {
    console.error('[IM] 保存会话记录失败:', err)
  }
}
