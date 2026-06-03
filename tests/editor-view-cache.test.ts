import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorViewCacheStore } from '../src/store/editorViewCache'
import { useTabsStore } from '../src/store/tabs'

describe('editor view cache', () => {
  beforeEach(() => {
    useEditorViewCacheStore.getState().clear()
    useTabsStore.setState({
      openTabs: [],
      activeFile: null,
      revealTarget: null
    })
  })

  it('stores and restores screenplay view state by file path', () => {
    useEditorViewCacheStore.getState().saveScreenplayState('/a.ep', {
      selectionFrom: 12,
      selectionTo: 18,
      scrollTop: 240,
      lineType: 'dialogue'
    })

    expect(useEditorViewCacheStore.getState().getScreenplayState('/a.ep')).toEqual({
      selectionFrom: 12,
      selectionTo: 18,
      scrollTop: 240,
      lineType: 'dialogue'
    })
  })

  it('drops cached view state when a tab is closed', () => {
    useTabsStore.getState().openTab('/a.ep')
    useTabsStore.getState().openTab('/b.ep')
    useEditorViewCacheStore.getState().saveScreenplayState('/a.ep', {
      selectionFrom: 3,
      selectionTo: 3,
      scrollTop: 80,
      lineType: 'scene'
    })

    useTabsStore.getState().closeTab('/a.ep')

    expect(useEditorViewCacheStore.getState().getScreenplayState('/a.ep')).toBeUndefined()
  })

  it('keeps the selected tab cache when closing other tabs', () => {
    useTabsStore.getState().openTab('/a.ep')
    useTabsStore.getState().openTab('/b.ep')
    useEditorViewCacheStore.getState().saveScreenplayState('/a.ep', {
      selectionFrom: 1,
      selectionTo: 1,
      scrollTop: 20,
      lineType: 'action'
    })
    useEditorViewCacheStore.getState().saveScreenplayState('/b.ep', {
      selectionFrom: 2,
      selectionTo: 2,
      scrollTop: 40,
      lineType: 'transition'
    })

    useTabsStore.getState().closeOtherTabs('/b.ep')

    expect(useEditorViewCacheStore.getState().getScreenplayState('/a.ep')).toBeUndefined()
    expect(useEditorViewCacheStore.getState().getScreenplayState('/b.ep')).toEqual({
      selectionFrom: 2,
      selectionTo: 2,
      scrollTop: 40,
      lineType: 'transition'
    })
  })
})
