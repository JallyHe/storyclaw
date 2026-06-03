// ── IM 管理器 ────────────────────────────────────────────────────────────────
// 平台无关的路由中枢：持有各平台 adapter，按配置启停；
// 收到消息 → 交给 agent 跑一次 → 把回复发回平台；并向渲染端广播状态。

import fs from 'fs/promises'
import path from 'path'
import { BrowserWindow } from 'electron'
import type {
  IMConfigSnapshot,
  IMConversationEvent,
  IMMessageRole,
  IMPlatform,
  IMStatusSnapshot
} from '../../src/im/types'
import type { IMAdapter, IncomingMessage } from './types'
import { DingTalkAdapter } from './adapters/dingtalk'
import { loadIMConfig, saveIMConfig } from './config'
import { getWorkspaceRoot, runHeadlessPrompt } from '../agent/session'

/**
 * 从 agent 回复中解析「@发送文件/视频/音频:路径」指令。
 * 返回去掉这些指令行后的正文，以及待发送的相对路径列表。
 */
function extractMediaDirectives(raw: string): { text: string; files: string[] } {
  const files: string[] = []
  const re = /^\s*@发送(?:文件|视频|音频)[:：]\s*(.+?)\s*$/gm
  const text = raw.replace(re, (_m, p: string) => {
    const rel = p.trim().replace(/^["'`]|["'`]$/g, '')
    if (rel) files.push(rel)
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
  return { text, files }
}

/** adapter 工厂：新增平台时在此登记。 */
const ADAPTER_FACTORIES: Partial<Record<IMPlatform, () => IMAdapter>> = {
  dingtalk: () => new DingTalkAdapter()
}

class IMManager {
  private adapters = new Map<IMPlatform, IMAdapter>()
  private statuses = new Map<IMPlatform, IMStatusSnapshot>()
  private win: BrowserWindow | null = null

  bindWindow(win: BrowserWindow): void {
    this.win = win
  }

  /** 应用启动后调用：按已保存配置自动连接已启用的平台。 */
  async startEnabled(): Promise<void> {
    const config = await loadIMConfig()
    for (const platform of Object.keys(config.platforms) as IMPlatform[]) {
      const p = config.platforms[platform]
      if (p?.enabled) await this.startPlatform(platform).catch(() => {})
    }
  }

  async startPlatform(platform: IMPlatform): Promise<IMStatusSnapshot> {
    const factory = ADAPTER_FACTORIES[platform]
    if (!factory) return this.setStatus(platform, 'error', '该平台暂未支持')

    const config = await loadIMConfig()
    const platformConfig = config.platforms[platform]
    if (!platformConfig) return this.setStatus(platform, 'error', '尚未配置')

    await this.stopPlatform(platform)
    const adapter = factory()
    this.adapters.set(platform, adapter)
    this.setStatus(platform, 'connecting', '正在连接…')

    try {
      await adapter.start(platformConfig, msg => this.handleMessage(msg))
      const s = adapter.getStatus()
      return this.setStatus(platform, s.status, s.message)
    } catch (err: any) {
      this.adapters.delete(platform)
      return this.setStatus(platform, 'error', err?.message ?? String(err))
    }
  }

  async stopPlatform(platform: IMPlatform): Promise<IMStatusSnapshot> {
    const adapter = this.adapters.get(platform)
    if (adapter) {
      await adapter.stop().catch(() => {})
      this.adapters.delete(platform)
    }
    return this.setStatus(platform, 'idle')
  }

  getStatus(platform: IMPlatform): IMStatusSnapshot {
    return this.statuses.get(platform) ?? { platform, status: 'idle' }
  }

  getAllStatuses(): IMStatusSnapshot[] {
    return [...this.statuses.values()]
  }

  /** 保存配置；对启用的平台重连，停用的平台断开。 */
  async applyConfig(config: IMConfigSnapshot): Promise<IMConfigSnapshot> {
    const saved = await saveIMConfig(config)
    for (const platform of Object.keys(ADAPTER_FACTORIES) as IMPlatform[]) {
      const p = saved.platforms[platform]
      if (p?.enabled) await this.startPlatform(platform).catch(() => {})
      else await this.stopPlatform(platform)
    }
    return saved
  }

  /** 取一个可用于广播的窗口：优先绑定窗口，失效则取任意存活窗口。 */
  private targetWindow(): BrowserWindow | null {
    if (this.win && !this.win.isDestroyed()) return this.win
    const any = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    return any ?? null
  }

  private async handleMessage(msg: IncomingMessage): Promise<void> {
    console.log(`[IM] 收到消息 platform=${msg.platform} from=${msg.senderNick} text=${msg.text.slice(0, 40)}`)
    this.touchLastMessage(msg.platform)
    this.broadcastMessage(msg, 'user', msg.text)
    this.broadcastMessage(msg, 'pending', '正在思考中…')
    void msg.reply('🤔 正在思考中，请稍候…').catch(() => {})

    try {
      const raw = await runHeadlessPrompt(msg.text)
      // 解析「@发送文件/视频/音频:路径」指令，正文与待发文件分离
      const { text, files } = extractMediaDirectives(raw)
      const finalText = text || '（助手没有返回内容）'
      await msg.reply(finalText)
      this.broadcastMessage(msg, 'assistant', finalText)
      await this.sendFiles(msg, files)
    } catch (err: any) {
      const text = `⚠️ 处理失败：${err?.message ?? String(err)}`
      await msg.reply(text).catch(() => {})
      this.broadcastMessage(msg, 'error', text)
    }
  }

  /** 把 agent 指定的项目文件作为附件发给用户。 */
  private async sendFiles(msg: IncomingMessage, relPaths: string[]): Promise<void> {
    if (relPaths.length === 0) return
    if (!msg.sendFile) {
      this.broadcastMessage(msg, 'error', '当前平台不支持发送文件附件')
      return
    }
    const root = getWorkspaceRoot()
    if (!root) return
    for (const rel of relPaths) {
      try {
        const abs = path.resolve(root, rel.replace(/[\\/]+/g, path.sep))
        const relative = path.relative(root, abs)
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          throw new Error('路径超出工作区范围')
        }
        await fs.access(abs)
        await msg.sendFile(abs)
        this.broadcastMessage(msg, 'assistant', `📎 已发送文件：${rel}`)
      } catch (err: any) {
        this.broadcastMessage(msg, 'error', `发送文件失败（${rel}）：${err?.message ?? String(err)}`)
      }
    }
  }

  private broadcastMessage(msg: IncomingMessage, role: IMMessageRole, text: string): void {
    const event: IMConversationEvent = {
      id: `${msg.platform}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      platform: msg.platform,
      conversationId: msg.conversationId,
      senderNick: msg.senderNick,
      role,
      text,
      ts: Date.now()
    }
    const target = this.targetWindow()
    if (!target) { console.warn('[IM] 无可用窗口，会话事件未能送达桌面端'); return }
    target.webContents.send('im:message', event)
  }

  private setStatus(
    platform: IMPlatform,
    status: IMStatusSnapshot['status'],
    message?: string
  ): IMStatusSnapshot {
    const prev = this.statuses.get(platform)
    const snapshot: IMStatusSnapshot = { platform, status, message, lastMessageAt: prev?.lastMessageAt }
    this.statuses.set(platform, snapshot)
    this.targetWindow()?.webContents.send('im:status', snapshot)
    return snapshot
  }

  private touchLastMessage(platform: IMPlatform): void {
    const prev = this.statuses.get(platform) ?? { platform, status: 'connected' as const }
    const snapshot: IMStatusSnapshot = { ...prev, lastMessageAt: Date.now() }
    this.statuses.set(platform, snapshot)
    this.targetWindow()?.webContents.send('im:status', snapshot)
  }
}

export const imManager = new IMManager()
