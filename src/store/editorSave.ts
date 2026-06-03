import { create } from 'zustand'
import { useWorkspaceStore } from './workspace'

export type UnsavedDocumentAction = 'save' | 'discard' | 'cancel'

export interface EditorSaveHandler {
  save: () => Promise<void>
  discard?: () => void
}

interface EditorSaveState {
  autoSave: boolean
  handlers: Map<string, EditorSaveHandler>
  setAutoSave: (autoSave: boolean) => void
  registerHandler: (path: string, handler: EditorSaveHandler) => () => void
  saveDocument: (path: string) => Promise<void>
  discardDocument: (path: string) => void
}

const AUTO_SAVE_KEY = 'storyclaw.editor.autoSave'

function readInitialAutoSave(): boolean {
  try {
    return localStorage.getItem(AUTO_SAVE_KEY) === 'true'
  } catch {
    return false
  }
}

export const useEditorSaveStore = create<EditorSaveState>((set, get) => ({
  autoSave: readInitialAutoSave(),
  handlers: new Map(),

  setAutoSave: (autoSave) => {
    try {
      localStorage.setItem(AUTO_SAVE_KEY, String(autoSave))
    } catch {
      // Ignore storage errors in restricted renderer contexts.
    }
    set({ autoSave })
  },

  registerHandler: (path, handler) => {
    set(s => {
      const handlers = new Map(s.handlers)
      handlers.set(path, handler)
      return { handlers }
    })
    return () => {
      set(s => {
        const handlers = new Map(s.handlers)
        if (handlers.get(path) === handler) handlers.delete(path)
        return { handlers }
      })
    }
  },

  saveDocument: async (path) => {
    const handler = get().handlers.get(path)
    if (!handler) return
    await handler.save()
    useWorkspaceStore.getState().clearDirty(path)
  },

  discardDocument: (path) => {
    get().handlers.get(path)?.discard?.()
    useWorkspaceStore.getState().clearDirty(path)
  }
}))

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

async function askUnsavedAction(paths: string[]): Promise<UnsavedDocumentAction> {
  const names = paths.map(basename)
  const message = paths.length === 1
    ? `文件“${names[0]}”有未保存的修改。`
    : `有 ${paths.length} 个文件有未保存的修改。`

  if (window.api?.window.confirmUnsaved) {
    return window.api.window.confirmUnsaved(names)
  }

  return window.confirm(`${message}\n\n选择“确定”保存，选择“取消”放弃本次关闭。`)
    ? 'save'
    : 'cancel'
}

export async function requestUnsavedDocumentAction(paths: string[]): Promise<boolean> {
  const dirtySet = useWorkspaceStore.getState().dirtySet
  const dirtyPaths = paths.filter(path => dirtySet.has(path))
  if (dirtyPaths.length === 0) return true

  const action = await askUnsavedAction(dirtyPaths)
  if (action === 'cancel') return false

  if (action === 'save') {
    for (const path of dirtyPaths) {
      await useEditorSaveStore.getState().saveDocument(path)
    }
    return true
  }

  for (const path of dirtyPaths) {
    useEditorSaveStore.getState().discardDocument(path)
  }
  return true
}
