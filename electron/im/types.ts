// ── 主进程 IM adapter 抽象 ───────────────────────────────────────────────────
// 平台无关的路由层只依赖这个接口；每个平台实现一个 adapter。

import type { IMPlatform, IMPlatformConfig, IMStatus } from '../../src/im/types'

/** adapter 归一化后的统一入站消息（屏蔽各平台差异）。 */
export interface IncomingMessage {
  platform: IMPlatform
  messageId: string
  text: string
  senderNick: string
  conversationId: string
  /** 平台专属回复闭包：路由层拿到 agent 回复后调用它发回（原生 Markdown） */
  reply: (text: string) => Promise<void>
  /** 可选：把一个本地文件（文件/视频/音频）发给消息发送者 */
  sendFile?: (absPath: string) => Promise<void>
}

export type MessageHandler = (msg: IncomingMessage) => void | Promise<void>

export interface IMAdapter {
  readonly platform: IMPlatform
  /** 建立连接并开始接收消息 */
  start(config: IMPlatformConfig, onMessage: MessageHandler): Promise<void>
  /** 断开连接 */
  stop(): Promise<void>
  getStatus(): { status: IMStatus; message?: string }
}
