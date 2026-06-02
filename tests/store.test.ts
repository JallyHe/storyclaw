import { describe, it, expect, beforeEach } from 'vitest'
import { useTabsStore } from '../src/store/tabs'
import { useUiStore } from '../src/store/ui'

describe('TabsStore', () => {
  beforeEach(() => useTabsStore.setState({ openTabs: [], activeFile: null }))

  it('opens a tab and sets active', () => {
    useTabsStore.getState().openTab('/path/ep01.ep')
    expect(useTabsStore.getState().openTabs).toContain('/path/ep01.ep')
    expect(useTabsStore.getState().activeFile).toBe('/path/ep01.ep')
  })

  it('deduplicates open tabs', () => {
    useTabsStore.getState().openTab('/path/ep01.ep')
    useTabsStore.getState().openTab('/path/ep01.ep')
    expect(useTabsStore.getState().openTabs).toHaveLength(1)
  })

  it('closes a tab and activates previous', () => {
    useTabsStore.getState().openTab('/a.ep')
    useTabsStore.getState().openTab('/b.ep')
    useTabsStore.getState().closeTab('/b.ep')
    expect(useTabsStore.getState().activeFile).toBe('/a.ep')
    expect(useTabsStore.getState().openTabs).toHaveLength(1)
  })
})

describe('UiStore', () => {
  it('toggles left panel', () => {
    const s = useUiStore.getState()
    const initial = s.leftOpen
    s.toggleLeft()
    expect(useUiStore.getState().leftOpen).toBe(!initial)
  })
})
