import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorSaveStore, requestUnsavedDocumentAction } from '../src/store/editorSave'
import { useWorkspaceStore } from '../src/store/workspace'

describe('editor save store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkspaceStore.setState({ dirtySet: new Set() })
    useEditorSaveStore.setState({
      autoSave: false,
      handlers: new Map()
    })
  })

  it('keeps auto save disabled by default and persists global preference', () => {
    expect(useEditorSaveStore.getState().autoSave).toBe(false)

    useEditorSaveStore.getState().setAutoSave(true)

    expect(useEditorSaveStore.getState().autoSave).toBe(true)
    expect(localStorage.getItem('storyclaw.editor.autoSave')).toBe('true')
  })

  it('saves a dirty registered document before closing when the user chooses save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    useWorkspaceStore.getState().markDirty('D:/story/a.ep')
    useEditorSaveStore.getState().registerHandler('D:/story/a.ep', { save })
    vi.stubGlobal('api', {
      window: {
        confirmUnsaved: vi.fn().mockResolvedValue('save')
      }
    })

    const allowed = await requestUnsavedDocumentAction(['D:/story/a.ep'])

    expect(allowed).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
