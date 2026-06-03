import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Copilot } from '../src/components/copilot/Copilot'

const { sessionsState } = vi.hoisted(() => ({
  sessionsState: {
    sessions: [
      {
        id: 's1',
        title: '把第一场改成更紧张的悬疑开场',
        group: '今天',
        time: '2026-06-03T03:00:00.000Z',
        createdAt: '2026-06-03T03:00:00.000Z',
        updatedAt: '2026-06-03T03:00:00.000Z',
        messages: [
          { role: 'user', text: '改第一场' },
          {
            role: 'assistant',
            steps: [{ kind: 'write', label: '写入', target: 'EP01' }],
            reply: ['好的'],
            typing: false
          }
        ]
      }
    ],
    activeId: 's1',
    setActive: vi.fn(),
    newSession: vi.fn(),
    visibleSessions: vi.fn()
  }
}))

sessionsState.visibleSessions.mockReturnValue(sessionsState.sessions)

vi.mock('../src/store', () => ({
  useSessionsStore: () => sessionsState,
  useCopilotDraftStore: (selector: (state: { queuedSelection: null }) => unknown) => selector({ queuedSelection: null })
}))

vi.mock('../src/hooks/useAgentEvents', () => ({
  useAgentEvents: vi.fn()
}))

vi.mock('../src/components/copilot/AgentComposer', () => ({
  AgentComposer: () => <div />,
}))

vi.mock('../src/components/agent/PermissionDialog', () => ({
  PermissionDialog: () => null
}))

vi.mock('../src/components/copilot/Message', () => ({
  Message: () => <div />
}))

describe('Copilot session overview', () => {
  it('shows message count and real relative time instead of fake diff stats', () => {
    vi.setSystemTime(new Date('2026-06-03T03:05:00.000Z'))
    render(<Copilot width={280} />)

    expect(screen.getByText('把第一场改成更紧张的悬疑开场')).toBeInTheDocument()
    expect(screen.getByText('5分钟前')).toBeInTheDocument()
    expect(screen.getByText('2 条消息')).toBeInTheDocument()
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
    expect(screen.queryByText('-1')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
