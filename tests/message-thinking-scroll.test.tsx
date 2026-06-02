import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Message } from '../src/components/copilot/Message'

vi.mock('@/store', () => ({
  useSessionsStore: () => ({ updateAssistantMessage: vi.fn() })
}))

describe('Message thinking details', () => {
  it('scrolls expanded thinking content to the latest text', () => {
    const makeMessage = (thinking: string) => ({
      role: 'assistant' as const,
      typing: true,
      reply: [],
      steps: [{
        kind: 'thinking',
        label: 'Agent 正在思考…',
        target: '',
        thinking
      }]
    })
    const { rerender } = render(
      <Message
        m={makeMessage(Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n'))}
      />
    )

    fireEvent.click(screen.getByText('Agent 正在思考…'))
    const text = screen.getByText(/line 39/).closest('.step-thinking-text') as HTMLDivElement
    Object.defineProperty(text, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(text, 'scrollTop', { configurable: true, writable: true, value: 0 })

    rerender(
      <Message
        m={makeMessage(Array.from({ length: 80 }, (_, index) => `line ${index}`).join('\n'))}
      />
    )

    expect(text.scrollTop).toBe(text.scrollHeight)
  })
})
