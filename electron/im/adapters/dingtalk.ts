// ── 钉钉 adapter ─────────────────────────────────────────────────────────────
// 基于 dingtalk-stream 的 WebSocket 长连接（Stream 模式）：
// 只需 clientId(App Key) / clientSecret(App Secret)，无需公网地址。
// 收到 IM 消息 → 归一化为 IncomingMessage；回复 POST 到消息自带的 sessionWebhook。

import { DWClient, TOPIC_ROBOT, EventAck } from 'dingtalk-stream'
import type { IMPlatformConfig, IMStatus } from '../../../src/im/types'
import type { IMAdapter, IMReplyStream, IncomingMessage, MessageHandler } from '../types'
import { createAndDeliverCard, getAccessToken, streamingUpdate, type CardDeliverContext } from './dingtalkCard'

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

/** 构造一个基于 AI 卡片的流式回复通道。 */
function buildCardStream(
  appKey: string,
  appSecret: string,
  cardTemplateId: string,
  ctx: CardDeliverContext
): IMReplyStream {
  const outTrackId = `storyclaw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const guid = `${outTrackId}-g`
  let token = ''
  let lastSent = 0

  return {
    async begin() {
      token = await getAccessToken(appKey, appSecret)
      await createAndDeliverCard(token, outTrackId, cardTemplateId, ctx)
    },
    async update(fullText: string) {
      const now = Date.now()
      if (now - lastSent < 350) return // 限流，避免高频刷新
      lastSent = now
      await streamingUpdate(token, outTrackId, guid, fullText, false).catch(() => {})
    },
    async finish(fullText: string) {
      await streamingUpdate(token, outTrackId, guid, fullText, true)
    }
  }
}

export class DingTalkAdapter implements IMAdapter {
  readonly platform = 'dingtalk' as const
  private client: DWClient | null = null
  private status: IMStatus = 'idle'
  private message?: string

  async start(config: IMPlatformConfig, onMessage: MessageHandler): Promise<void> {
    const clientId = config.credentials.clientId?.trim()
    const clientSecret = config.credentials.clientSecret?.trim()
    const cardTemplateId = config.credentials.cardTemplateId?.trim()
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
        const text: string = message?.text?.content?.trim() ?? ''
        const sessionWebhook: string = message?.sessionWebhook ?? ''
        if (text && sessionWebhook) {
          // 配置了卡片模板 → 提供 AI 流式卡片通道；否则回退纯文本/Markdown
          let stream: IMReplyStream | undefined
          if (cardTemplateId) {
            const ctx: CardDeliverContext = {
              conversationType: message?.conversationType ?? '1',
              conversationId: message?.conversationId ?? '',
              senderStaffId: message?.senderStaffId ?? '',
              robotCode: message?.robotCode ?? clientId
            }
            stream = buildCardStream(clientId, clientSecret, cardTemplateId, ctx)
          }
          const incoming: IncomingMessage = {
            platform: 'dingtalk',
            messageId: message?.msgId ?? '',
            text,
            senderNick: message?.senderNick ?? '',
            conversationId: message?.conversationId ?? '',
            reply: (reply: string) => postToWebhook(sessionWebhook, reply),
            stream
          }
          await onMessage(incoming)
        }
      } catch (err) {
        console.error('[IM/钉钉] 处理消息失败:', err)
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
