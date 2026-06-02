import { beforeEach, describe, expect, it } from 'vitest'
import { useTabsStore } from '../src/store/tabs'

describe('tabs store', () => {
  beforeEach(() => {
    useTabsStore.setState({
      openTabs: [],
      activeFile: null,
      revealTarget: null
    })
  })

  it('closes other tabs and keeps the selected tab active', () => {
    const store = useTabsStore.getState()
    store.openTab('a.ep')
    store.openTab('b.ep')
    store.openTab('c.ep')

    useTabsStore.getState().closeOtherTabs('b.ep')

    expect(useTabsStore.getState().openTabs).toEqual(['b.ep'])
    expect(useTabsStore.getState().activeFile).toBe('b.ep')
  })

  it('closes all tabs and clears reveal target', () => {
    useTabsStore.getState().openTab('a.ep', {
      line: 1,
      column: 0,
      length: 1,
      matchText: 'a'
    })

    useTabsStore.getState().closeAllTabs()

    expect(useTabsStore.getState().openTabs).toEqual([])
    expect(useTabsStore.getState().activeFile).toBeNull()
    expect(useTabsStore.getState().revealTarget).toBeNull()
  })
})
