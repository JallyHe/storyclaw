// ── 主进程 IM adapter 抽象 ───────────────────────────────────────────────────
// 平台无关的路由层只依赖这个接口；每个平台实现一个 adapter。

import type { IMPlatform, IMPlatformConfig, IMStatus } from '../../src/im/types'

/**
 * 流式回复通道（如钉钉 AI 卡片）。平台支持时由 adapter 提供，
 * 路由层用它做「实时打字」更新；不支持时回退到一次性 reply。
 */
export interface IMReplyStream {
  /** 创建并下发卡片（先展示占位/思考中） */
  begin(): Promise<void>
  /** 用累计的完整文本刷新卡片内容（Markdown） */
  update(fullText: string): Promise<void>
  /** 收尾：写入最终内容并结束流式 */
  finish(fullText: string): Promise<void>
}

/** adapter 归一化后的统一入站消息（屏蔽各平台差异）。 */
export interface IncomingMessage {
  platform: IMPlatform
  messageId: string
  text: string
  senderNick: string
  conversationId: string
  /** 平台专属回复闭包：路由层拿到 agent 回复后调用它发回 */
  reply: (text: string) => Promise<void>
  /** 可选：流式回复通道（钉钉配置了卡片模板时提供） */
  stream?: IMReplyStream
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
