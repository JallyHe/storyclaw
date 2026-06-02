import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabBar } from '../src/components/tabs/TabBar'
import { useTabsStore } from '../src/store/tabs'

describe('TabBar scrolling', () => {
  beforeEach(() => {
    useTabsStore.setState({
      openTabs: [],
      activeFile: null,
      revealTarget: null
    })
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls the active document tab into view when switching documents', async () => {
    useTabsStore.setState({
      openTabs: ['a.ep', 'b.ep', 'c.ep', 'd.ep', 'e.ep'],
      activeFile: 'a.ep',
      revealTarget: null
    })

    render(<TabBar />)
    vi.mocked(Element.prototype.scrollIntoView).mockClear()

    act(() => {
      useTabsStore.getState().setActive('e.ep')
    })

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    })
  })
})
