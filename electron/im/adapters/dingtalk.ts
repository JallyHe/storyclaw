// ── 钉钉 adapter ─────────────────────────────────────────────────────────────
// 基于 dingtalk-stream 的 WebSocket 长连接（Stream 模式）：
// 只需 clientId(App Key) / clientSecret(App Secret)，无需公网地址。
// 收到 IM 消息 → 归一化为 IncomingMessage；回复 POST 到消息自带的 sessionWebhook。

import { DWClient, TOPIC_ROBOT, EventAck } from 'dingtalk-stream'
import type { IMPlatformConfig, IMStatus } from '../../../src/im/types'
import type { IMAdapter, IncomingMessage, MessageHandler } from '../types'
import { sendFileToUser } from './dingtalkMedia'

/** 通过 sessionWebhook 回复一条原生 Markdown 消息。 */
async function postToWebhook(sessionWebhook: string, text: string): Promise<void> {
  const res = await fetch(sessionWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { title: 'StoryClaw', text } })
  })
  if (!res.ok) {
    throw new Error(`钉钉回复失败：HTTP ${res.status}`)
  }
}

export class DingTalkAdapter implements IMAdapter {
  readonly platform = 'dingtalk' as const
  private client: DWClient | null = null
  private status: IMStatus = 'idle'
  private message?: string
  /** 已处理过的 msgId → 时间戳，用于过滤网关重投的重复消息 */
  private seen = new Map<string, number>()

  /** 去重：5 分钟内同一 msgId 只处理一次。 */
  private isDuplicate(msgId: string): boolean {
    if (!msgId) return false
    const now = Date.now()
    // 顺手清理过期条目
    for (const [id, ts] of this.seen) {
      if (now - ts > 300000) this.seen.delete(id)
    }
    if (this.seen.has(msgId)) return true
    this.seen.set(msgId, now)
    return false
  }

  async start(config: IMPlatformConfig, onMessage: MessageHandler): Promise<void> {
    const clientId = config.credentials.clientId?.trim()
    const clientSecret = config.credentials.clientSecret?.trim()
    if (!clientId || !clientSecret) {
      this.status = 'error'
      this.message = '缺少 App Key 或 App Secret'
      throw new Error(this.message)
    }

    await this.stop()
    this.status = 'connecting'
    this.message = '正在连接钉钉…'

    const client = new DWClient({ clientId, clientSecret })
    this.client = client

    client.registerCallbackListener(TOPIC_ROBOT, async (res: any) => {
      try {
        const message = JSON.parse(res.data)
        const msgId: string = message?.msgId ?? ''
        const text: string = message?.text?.content?.trim() ?? ''
        const sessionWebhook: string = message?.sessionWebhook ?? ''
        const senderStaffId: string = message?.senderStaffId ?? ''
        const robotCode: string = message?.robotCode ?? clientId
        // 过滤网关因 ACK 超时而重投的重复消息
        if (text && sessionWebhook && !this.isDuplicate(msgId)) {
          const incoming: IncomingMessage = {
            platform: 'dingtalk',
            messageId: msgId,
            text,
            senderNick: message?.senderNick ?? '',
            conversationId: message?.conversationId ?? '',
            reply: (reply: string) => postToWebhook(sessionWebhook, reply),
            sendFile: senderStaffId
              ? (absPath: string) => sendFileToUser(clientId, clientSecret, robotCode, senderStaffId, absPath)
              : undefined
          }
          // 关键：不 await 处理过程，立即向网关 ACK，避免超时重投；
          // Agent 跑完后异步把回复发回钉钉。
          void Promise.resolve(onMessage(incoming)).catch(err => console.error('[IM/钉钉] 处理消息失败:', err))
        }
      } catch (err) {
        console.error('[IM/钉钉] 解析消息失败:', err)
      }
      return { status: EventAck.SUCCESS }
    })

    try {
      await client.connect()
      this.status = 'connected'
      this.message = '钉钉已连接'
    } catch (err: any) {
      this.status = 'error'
      this.message = `钉钉连接失败：${err?.message ?? String(err)}`
      this.client = null
      throw new Error(this.message)
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        // dingtalk-stream 的 DWClient 提供 disconnect()
        ;(this.client as any).disconnect?.()
      } catch (err) {
        console.error('[IM/钉钉] 断开连接出错:', err)
      }
      this.client = null
    }
    this.status = 'idle'
    this.message = undefined
  }

  getStatus(): { status: IMStatus; message?: string } {
    return { status: this.status, message: this.message }
  }
}
