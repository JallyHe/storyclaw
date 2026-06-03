import type { Message, Session } from '@/types'

export function createSessionTimestamp(now = new Date()): string {
  return now.toISOString()
}

export function normalizeSessionTimestamp(value: string | undefined, fallback = createSessionTimestamp()): string {
  if (!value) return fallback
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback
}

export function touchSession(session: Session, now = createSessionTimestamp()): Session {
  const createdAt = normalizeSessionTimestamp(session.createdAt ?? session.time, now)
  return { ...session, createdAt, updatedAt: now, time: now }
}

export function formatSessionRelativeTime(session: Session, now = Date.now()): string {
  const timestamp = normalizeSessionTimestamp(session.updatedAt ?? session.time ?? session.createdAt)
  const diffMs = Math.max(0, now - Date.parse(timestamp))
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}小时前`
  if (diffMs < 2 * day) return '昨天'
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}天前`
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
}

export function countSessionMessages(messages: Message[]): number {
  return messages.length
}

export function createTitleFromMessage(text: string): string {
  const compact = text
    .replace(/[#*_`>\-[\](){}]/g, '')
    .replace(/\s+/g, '')
    .replace(/^(请|帮我|麻烦|能不能|可以|继续)/, '')
    .replace(/[。！？!?，,；;：:]+$/g, '')
  const firstClause = compact.split(/[。！？!?，,；;：:]/)[0] ?? compact
  return firstClause.slice(0, 16) || '新会话'
}
