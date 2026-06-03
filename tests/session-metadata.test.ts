import { describe, expect, it } from 'vitest'
import {
  countSessionMessages,
  createTitleFromMessage,
  formatSessionRelativeTime,
  normalizeSessionTimestamp,
  touchSession
} from '../src/store/sessionMetadata'
import type { Session } from '../src/types'

describe('session metadata', () => {
  it('creates a concise automatic title from the first user message', () => {
    expect(createTitleFromMessage('帮我把第一场改成更紧张的悬疑开场，并强化人物动机')).toBe('把第一场改成更紧张的悬疑开场')
    expect(createTitleFromMessage('请 继续 润色对白。')).toBe('继续润色对白')
  })

  it('normalizes legacy display-only time values to a real timestamp', () => {
    const fallback = '2026-06-03T03:00:00.000Z'

    expect(normalizeSessionTimestamp('刚刚', fallback)).toBe(fallback)
    expect(normalizeSessionTimestamp('2026-06-02T10:00:00.000Z', fallback)).toBe('2026-06-02T10:00:00.000Z')
  })

  it('touches a session with createdAt, updatedAt, and persisted ISO time', () => {
    const session: Session = { id: 's1', title: '旧会话', group: '今天', time: '刚刚', messages: [] }
    const touched = touchSession(session, '2026-06-03T03:10:00.000Z')

    expect(touched.createdAt).toBe('2026-06-03T03:10:00.000Z')
    expect(touched.updatedAt).toBe('2026-06-03T03:10:00.000Z')
    expect(touched.time).toBe('2026-06-03T03:10:00.000Z')
  })

  it('formats real session timestamps for display', () => {
    const session: Session = {
      id: 's1',
      title: '会话',
      group: '今天',
      time: '2026-06-03T03:00:00.000Z',
      updatedAt: '2026-06-03T03:00:00.000Z',
      messages: []
    }

    expect(formatSessionRelativeTime(session, Date.parse('2026-06-03T03:00:30.000Z'))).toBe('刚刚')
    expect(formatSessionRelativeTime(session, Date.parse('2026-06-03T03:05:00.000Z'))).toBe('5分钟前')
  })

  it('counts visible conversation messages without pretending they are diffs', () => {
    expect(countSessionMessages([
      { role: 'user', text: '改第一场' },
      { role: 'assistant', steps: [{ kind: 'write', label: '写入', target: 'EP01' }], reply: ['好的'], typing: false }
    ])).toBe(2)
  })
})
