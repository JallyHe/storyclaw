import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FindBar } from '@/components/editors/FindBar'
import type { FindHandlers } from '@/components/editors/FindBar'

function makeHandlers(overrides?: Partial<FindHandlers>): FindHandlers {
  return {
    find: vi.fn().mockReturnValue(3),
    prev: vi.fn(),
    next: vi.fn(),
    replace: vi.fn(),
    replaceAll: vi.fn().mockReturnValue(2),
    clear: vi.fn(),
    ...overrides,
  }
}

describe('FindBar', () => {
  it('calls find when query changes', async () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'hello' } }) })
    expect(h.find).toHaveBeenCalledWith('hello', { caseSensitive: false })
  })

  it('shows no-match class when 0 results', async () => {
    const h = makeHandlers({ find: vi.fn().mockReturnValue(0) })
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'xyz' } }) })
    expect(input.classList.contains('no-match')).toBe(true)
  })

  it('shows match count', async () => {
    const h = makeHandlers({ find: vi.fn().mockReturnValue(5) })
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'a' } }) })
    expect(screen.getByText('1 / 5')).toBeDefined()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<FindBar handlers={makeHandlers()} allowReplace={false} onClose={onClose} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls next on Enter', async () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'a' } }) })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(h.next).toHaveBeenCalled()
  })

  it('calls prev on Shift+Enter', async () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'a' } }) })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(h.prev).toHaveBeenCalled()
  })

  it('clears on unmount', () => {
    const h = makeHandlers()
    const { unmount } = render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    unmount()
    expect(h.clear).toHaveBeenCalled()
  })

  it('toggles case sensitivity', async () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    await act(async () => { fireEvent.change(input, { target: { value: 'a' } }) })
    const aaBtn = screen.getByTitle('区分大小写')
    await act(async () => { fireEvent.click(aaBtn) })
    expect(h.find).toHaveBeenLastCalledWith('a', { caseSensitive: true })
  })
})
