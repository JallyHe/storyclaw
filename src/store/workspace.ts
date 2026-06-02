import { create } from 'zustand'
import type { TreeNode, StoryFile } from '@/types'
import { workspaceIpc } from '@/ipc/workspace'
import { agentIpc } from '@/ipc/agent'
import { useChangesStore } from './changes'
import { useSessionsStore } from './sessions'
import { useTabsStore } from './tabs'

type EditingMode = 'rename' | 'create-file' | 'create-folder' | null
type ClipboardMode = 'copy' | 'cut'

interface ClipboardState {
  nodes: TreeNode[]
  mode: ClipboardMode
}

interface WorkspaceState {
  root: string | null
  tree: TreeNode[]
  fileCache: Map<string, StoryFile>
  fileVersions: Map<string, number>   // bumped when a file is changed externally (AI write)
  dirtySet: Set<string>
  editingNodeId: string | null
  editingValue: string
  editingMode: EditingMode
  clipboard: ClipboardState | null
  cutSourceId: string | null
  openWorkspace: (dir: string) => Promise<void>
  refreshTree: () => Promise<void>
  getFile: (path: string) => Promise<StoryFile>
  saveFile: (path: string, data: StoryFile) => Promise<void>
  invalidateFile: (path: string) => void   // drop cache + bump version so open editors reload
  createFolder: (parentDir: string, name: string) => Promise<string | null>
  createFile: (parentDir: string, name: string) => Promise<string | null>
  renameItem: (path: string, nextName: string) => Promise<string | null>
  deleteItem: (path: string) => Promise<void>
  markDirty: (path: string) => void
  clearDirty: (path: string) => void
  setEditing: (nodeId: string | null, mode?: EditingMode, initialValue?: string) => void
  updateEditingValue: (value: string) => void
  commitEditing: () => Promise<void>
  cancelEditing: () => Promise<void>
  copyToClipboard: (nodes: TreeNode[]) => void
  cutToClipboard: (nodes: TreeNode[]) => void
  pasteFromClipboard: (targetDir: string) => Promise<void>
  moveNode: (sourceId: string, targetDir: string) => Promise<string | null>
  importExternalFiles: (sourcePaths: string[], targetDir: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: [],
  fileCache: new Map(),
  fileVersions: new Map(),
  dirtySet: new Set(),
  editingNodeId: null,
  editingValue: '',
  editingMode: null,
  clipboard: null,
  cutSourceId: null,

  openWorkspace: async (dir) => {
    const tree = await workspaceIpc.open(dir)
    const snapshot = await agentIpc.loadSnapshot(dir)
    useSessionsStore.getState().hydrateFromSnapshot(snapshot)
    useChangesStore.getState().hydrateFromSnapshot(snapshot)
    useTabsStore.getState().closeAllTabs()
    set({
      root: dir,
      tree,
      fileCache: new Map(),
      fileVersions: new Map(),
      dirtySet: new Set(),
      editingNodeId: null,
      editingValue: '',
      editingMode: null,
      clipboard: null,
      cutSourceId: null
    })
  },

  refreshTree: async () => {
    const { root } = get()
    if (!root) return
    const tree = await workspaceIpc.tree(root)
    set({ tree })
  },

  getFile: async (path) => {
    const cached = get().fileCache.get(path)
    if (cached) return cached
    const data = await workspaceIpc.readFile(path)
    set(s => { s.fileCache.set(path, data); return { fileCache: new Map(s.fileCache) } })
    return data
  },

  saveFile: async (path, data) => {
    await workspaceIpc.writeFile(path, data)
    set(s => {
      s.fileCache.set(path, data)
      const d = new Set(s.dirtySet); d.delete(path)
      return { fileCache: new Map(s.fileCache), dirtySet: d }
    })
  },

  // Called when a file is modified outside the editor (e.g. AI write).
  // Drops the cached copy and bumps a version counter so any open editor
  // re-reads the fresh content from disk.
  invalidateFile: (path) => set(s => {
    const fileCache = new Map(s.fileCache)
    fileCache.delete(path)
    const fileVersions = new Map(s.fileVersions)
    fileVersions.set(path, (fileVersions.get(path) ?? 0) + 1)
    return { fileCache, fileVersions }
  }),

  createFolder: async (parentDir, name) => {
    const { root } = get()
    if (!root) return null
    const created = await workspaceIpc.createFolder(root, parentDir, name)
    await get().refreshTree()
    return created
  },

  createFile: async (parentDir, name) => {
    const { root } = get()
    if (!root) return null
    const created = await workspaceIpc.createFile(root, parentDir, name)
    await get().refreshTree()
    return created
  },

  renameItem: async (path, nextName) => {
    const { root } = get()
    if (!root) return null
    const renamed = await workspaceIpc.renameItem(root, path, nextName)
    set(s => {
      const fileCache = new Map(s.fileCache)
      if (fileCache.has(path)) {
        fileCache.set(renamed, fileCache.get(path)!)
        fileCache.delete(path)
      }
      const dirtySet = new Set(s.dirtySet)
      if (dirtySet.delete(path)) dirtySet.add(renamed)
      return { fileCache, dirtySet }
    })
    await get().refreshTree()
    return renamed
  },

  deleteItem: async (path) => {
    const { root } = get()
    if (!root) return
    await workspaceIpc.deleteItem(root, path)
    set(s => {
      const fileCache = new Map(s.fileCache)
      fileCache.delete(path)
      const dirtySet = new Set(s.dirtySet)
      dirtySet.delete(path)
      return { fileCache, dirtySet }
    })
    await get().refreshTree()
  },

  markDirty: (path) => set(s => { const d = new Set(s.dirtySet); d.add(path); return { dirtySet: d } }),
  clearDirty: (path) => set(s => { const d = new Set(s.dirtySet); d.delete(path); return { dirtySet: d } }),

  setEditing: (nodeId, mode = null, initialValue = '') => {
    set({ editingNodeId: nodeId, editingMode: mode, editingValue: initialValue })
  },

  updateEditingValue: (value) => {
    set({ editingValue: value })
  },

  commitEditing: async () => {
    const { editingNodeId, editingValue, editingMode, root } = get()
    if (!editingNodeId || !editingMode || !root) return

    try {
      if (editingMode === 'rename') {
        await get().renameItem(editingNodeId, editingValue)
      } else if (editingMode === 'create-folder') {
        const currentPath = editingNodeId
        const baseName = currentPath.split(/[\\/]/).pop() || ''
        if (baseName !== editingValue) {
          await get().renameItem(currentPath, editingValue)
        }
      } else if (editingMode === 'create-file') {
        const currentPath = editingNodeId
        const oldName = currentPath.split(/[\\/]/).pop() || ''
        const oldExt = oldName.includes('.') ? oldName.split('.').pop()!.toLowerCase() : ''
        const newExt = editingValue.includes('.') ? editingValue.split('.').pop()!.toLowerCase() : ''

        let finalPath = currentPath
        if (oldName !== editingValue) {
          const renamed = await get().renameItem(currentPath, editingValue)
          if (renamed) finalPath = renamed
        }
        // If the extension changed, regenerate the file body to match the new
        // type (e.g. .ep template → empty .txt). The temp file was created as .ep.
        if (newExt !== oldExt) {
          try {
            await workspaceIpc.applyDefaultContent(finalPath)
            // drop any cached (wrong-type) content
            set(s => { const c = new Map(s.fileCache); c.delete(finalPath); c.delete(currentPath); return { fileCache: c } })
          } catch (err) {
            console.error('Failed to apply default content:', err)
          }
        }
      }
    } finally {
      set({ editingNodeId: null, editingValue: '', editingMode: null })
    }
  },

  cancelEditing: async () => {
    const { editingNodeId, editingMode, root } = get()
    if (!editingNodeId || !editingMode || !root) {
      set({ editingNodeId: null, editingValue: '', editingMode: null })
      return
    }

    if (editingMode === 'create-file' || editingMode === 'create-folder') {
      try {
        await get().deleteItem(editingNodeId)
      } catch (err) {
        console.error('Failed to delete temporary item:', err)
      }
    }

    set({ editingNodeId: null, editingValue: '', editingMode: null })
  },

  copyToClipboard: (nodes) => {
    set({ clipboard: { nodes, mode: 'copy' }, cutSourceId: null })
  },

  cutToClipboard: (nodes) => {
    set({ clipboard: { nodes, mode: 'cut' }, cutSourceId: nodes.length > 0 ? nodes[0].id : null })
  },

  pasteFromClipboard: async (targetDir) => {
    const { root, clipboard } = get()
    if (!root || !clipboard) return

    try {
      for (const node of clipboard.nodes) {
        if (clipboard.mode === 'copy') {
          await workspaceIpc.copyItem(root, node.id, targetDir)
        } else if (clipboard.mode === 'cut') {
          await workspaceIpc.moveItem(root, node.id, targetDir)
        }
      }

      if (clipboard.mode === 'cut') {
        set({ clipboard: null, cutSourceId: null })
      }

      await get().refreshTree()
    } catch (err) {
      console.error('Paste failed:', err)
    }
  },

  moveNode: async (sourceId, targetDir) => {
    const { root } = get()
    if (!root) return null
    // No-op if the file is already in the target dir
    const sourceParent = sourceId.slice(0, Math.max(sourceId.lastIndexOf('\\'), sourceId.lastIndexOf('/')))
    if (sourceParent === targetDir) return null
    // Prevent moving a folder into itself or its descendants
    if (targetDir === sourceId || targetDir.startsWith(sourceId + '\\') || targetDir.startsWith(sourceId + '/')) return null
    try {
      const moved = await workspaceIpc.moveItem(root, sourceId, targetDir)
      set(s => {
        const fileCache = new Map(s.fileCache)
        if (fileCache.has(sourceId)) {
          fileCache.set(moved, fileCache.get(sourceId)!)
          fileCache.delete(sourceId)
        }
        const dirtySet = new Set(s.dirtySet)
        if (dirtySet.delete(sourceId)) dirtySet.add(moved)
        return { fileCache, dirtySet }
      })
      await get().refreshTree()
      return moved
    } catch (err) {
      console.error('Move failed:', err)
      return null
    }
  },

  importExternalFiles: async (sourcePaths, targetDir) => {
    const { root } = get()
    if (!root || sourcePaths.length === 0) return
    try {
      await workspaceIpc.importFiles(root, sourcePaths, targetDir)
      await get().refreshTree()
    } catch (err) {
      console.error('Import failed:', err)
    }
  }
}))
