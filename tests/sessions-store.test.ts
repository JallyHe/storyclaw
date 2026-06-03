import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { useSessionsStore } from '../src/store/sessions'

describe('sessions store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T03:00:00.000Z'))
    useSessionsStore.setState({
      sessions: [{
        id: 's_new',
        title: '新会话',
        group: '进行中',
        time: '2026-06-03T03:00:00.000Z',
        createdAt: '2026-06-03T03:00:00.000Z',
        updatedAt: '2026-06-03T03:00:00.000Z',
        messages: []
      }],
      activeId: 's_new',
      modeBySessionId: { s_new: 'craft' }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto names a new session from the first user message', () => {
    useSessionsStore.getState().addMessage({
      role: 'user',
      text: '帮我把第一场改成更紧张的悬疑开场，并强化人物动机'
    })

    expect(useSessionsStore.getState().sessions[0].title).toBe('把第一场改成更紧张的悬疑开场')
  })

  it('stores real timestamps and updates them when messages arrive', () => {
    vi.setSystemTime(new Date('2026-06-03T03:05:00.000Z'))

    useSessionsStore.getState().addMessage({ role: 'user', text: '继续润色对白' })

    const session = useSessionsStore.getState().sessions[0]
    expect(session.time).toBe('2026-06-03T03:05:00.000Z')
    expect(session.updatedAt).toBe('2026-06-03T03:05:00.000Z')
    expect(session.createdAt).toBe('2026-06-03T03:00:00.000Z')
  })

  it('keeps a custom title when new messages arrive', () => {
    useSessionsStore.getState().renameSession('s_new', '导演反馈')
    useSessionsStore.getState().addMessage({ role: 'user', text: '继续润色对白' })

    expect(useSessionsStore.getState().sessions[0].title).toBe('导演反馈')
  })

  it('archives a session and activates the next visible session', () => {
    useSessionsStore.getState().addMessage({ role: 'user', text: '先写第一场' })
    useSessionsStore.getState().newSession()
    const archivedId = useSessionsStore.getState().activeId

    useSessionsStore.getState().archiveSession(archivedId)

    const state = useSessionsStore.getState()
    expect(state.sessions.find(session => session.id === archivedId)?.archived).toBe(true)
    expect(state.activeId).not.toBe(archivedId)
    expect(state.visibleSessions().every(session => !session.archived)).toBe(true)
  })
})
