import { describe, expect, it } from 'vitest'
import { MAX_MOUNTED_EDITORS, updateEditorKeepAliveList } from '../src/components/editors/editorKeepAlive'

describe('editor keep-alive list', () => {
  it('keeps the active file first without duplicating it', () => {
    expect(updateEditorKeepAliveList(['/a.ep', '/b.ep'], '/b.ep', ['/a.ep', '/b.ep'])).toEqual(['/b.ep', '/a.ep'])
  })

  it('drops closed tabs from the mounted editor list', () => {
    expect(updateEditorKeepAliveList(['/a.ep', '/b.ep'], '/b.ep', ['/b.ep'])).toEqual(['/b.ep'])
  })

  it('caps mounted editors to the configured limit', () => {
    expect(updateEditorKeepAliveList(['/a.ep', '/b.ep', '/c.ep'], '/d.ep', ['/a.ep', '/b.ep', '/c.ep', '/d.ep'], 3))
      .toEqual(['/d.ep', '/a.ep', '/b.ep'])
  })

  it('keeps ten mounted editors by default', () => {
    const openTabs = Array.from({ length: 12 }, (_, i) => `/${i}.ep`)
    const current = openTabs.slice(0, 11)

    expect(updateEditorKeepAliveList(current, '/11.ep', openTabs)).toHaveLength(MAX_MOUNTED_EDITORS)
  })
})
