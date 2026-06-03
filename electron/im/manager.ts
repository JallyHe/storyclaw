// ── IM 管理器 ────────────────────────────────────────────────────────────────
// 平台无关的路由中枢：持有各平台 adapter，按配置启停；
// 收到消息 → 交给 agent 跑一次 → 把回复发回平台；并向渲染端广播状态。

import type { BrowserWindow } from 'electron'
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
import { runHeadlessPrompt } from '../agent/session'

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

  private async handleMessage(msg: IncomingMessage): Promise<void> {
    this.touchLastMessage(msg.platform)
    this.broadcastMessage(msg, 'user', msg.text)

    // ── 流式卡片路径（钉钉配置了卡片模板时）──────────────────────────────────
    if (msg.stream) {
      let cardStarted = false
      try {
        await msg.stream.begin()
        cardStarted = true
        this.broadcastMessage(msg, 'pending', '正在思考中…')
        const reply = await runHeadlessPrompt(msg.text, full => { void msg.stream!.update(full) })
        const text = reply || '（助手没有返回内容）'
        await msg.stream.finish(text)
        this.broadcastMessage(msg, 'assistant', text)
        return
      } catch (err: any) {
        const text = `⚠️ 处理失败：${err?.message ?? String(err)}`
        if (cardStarted) {
          // 卡片已创建：收尾错误，不再回退文本
          await msg.stream.finish(text).catch(() => {})
          this.broadcastMessage(msg, 'error', text)
          return
        }
        // 卡片创建失败：落到下面的文本回退路径
        console.error('[IM] 卡片创建失败，回退文本回复:', err)
      }
    }

    // ── 文本/Markdown 回退路径 ──────────────────────────────────────────────
    this.broadcastMessage(msg, 'pending', '正在思考中…')
    void msg.reply('🤔 正在思考中，请稍候…').catch(() => {})
    try {
      const reply = await runHeadlessPrompt(msg.text)
      const text = reply || '（助手没有返回内容）'
      await msg.reply(text)
      this.broadcastMessage(msg, 'assistant', text)
    } catch (err: any) {
      const text = `⚠️ 处理失败：${err?.message ?? String(err)}`
      await msg.reply(text).catch(() => {})
      this.broadcastMessage(msg, 'error', text)
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
    this.win?.webContents.send('im:message', event)
  }

  private setStatus(
    platform: IMPlatform,
    status: IMStatusSnapshot['status'],
    message?: string
  ): IMStatusSnapshot {
    const prev = this.statuses.get(platform)
    const snapshot: IMStatusSnapshot = { platform, status, message, lastMessageAt: prev?.lastMessageAt }
    this.statuses.set(platform, snapshot)
    this.win?.webContents.send('im:status', snapshot)
    return snapshot
  }

  private touchLastMessage(platform: IMPlatform): void {
    const prev = this.statuses.get(platform) ?? { platform, status: 'connected' as const }
    const snapshot: IMStatusSnapshot = { ...prev, lastMessageAt: Date.now() }
    this.statuses.set(platform, snapshot)
    this.win?.webContents.send('im:status', snapshot)
  }
}

export const imManager = new IMManager()
