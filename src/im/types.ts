// ── IM (即时通讯) 多平台接入：共享类型 ──────────────────────────────────────────
// 渲染进程与主进程共用。纯类型 + 纯数据，无运行时依赖。

/** 受支持的平台 id。新增平台时在此追加。 */
export type IMPlatform = 'dingtalk' | 'feishu' | 'wechat'

/** 连接方式：长连接（桌面端首选）或公网 URL 回调（暂未启用）。 */
export type IMConnectionMode = 'stream' | 'webhook'

/** 单个平台的配置（凭据按字段名存）。 */
export interface IMPlatformConfig {
  enabled: boolean
  /** 当前选用的连接方式 */
  mode: IMConnectionMode
  /** 凭据字段值，键对应 registry 里的 field.key，例如 clientId/clientSecret */
  credentials: Record<string, string>
}

/** 全量 IM 配置快照，按平台 id 索引。 */
export interface IMConfigSnapshot {
  version: 1
  platforms: Partial<Record<IMPlatform, IMPlatformConfig>>
}

/** 运行时连接状态。 */
export type IMStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface IMStatusSnapshot {
  platform: IMPlatform
  status: IMStatus
  message?: string
  /** 最近一次收到消息的时间戳（ms），用于面板展示活跃度 */
  lastMessageAt?: number
}

/** 会话事件角色：用户消息 / 机器人处理中 / 机器人回复 / 错误。 */
export type IMMessageRole = 'user' | 'pending' | 'assistant' | 'error'

/** 推送给桌面端会话面板的一条会话事件。 */
export interface IMConversationEvent {
  id: string
  platform: IMPlatform
  conversationId: string
  senderNick: string
  role: IMMessageRole
  text: string
  ts: number
}
