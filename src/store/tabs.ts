import { create } from 'zustand'
import { useEditorViewCacheStore } from './editorViewCache'

export interface RevealTarget {
  path: string
  line: number          // 1-based
  column: number        // 0-based
  length: number        // match length in chars
  matchText: string     // the exact matched substring (for DOM-based reveal)
  blockId?: string      // structured editors can reveal exact block nodes
  nonce: number         // bumps on every request so identical targets re-trigger
}

interface TabsState {
  openTabs: string[]
  activeFile: string | null
  revealTarget: RevealTarget | null
  openTab: (path: string, reveal?: Omit<RevealTarget, 'path' | 'nonce'>) => void
  consumeReveal: (path: string) => void
  closeTab: (path: string) => void
  closeOtherTabs: (path: string) => void
  closeAllTabs: () => void
  renameTab: (oldPath: string, nextPath: string) => void
  setActive: (path: string) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  openTabs: [],
  activeFile: null,
  revealTarget: null,

  openTab: (path, reveal) => set(s => ({
    openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
    activeFile: path,
    revealTarget: reveal ? { ...reveal, path, nonce: Date.now() } : s.revealTarget
  })),

  // Clear the reveal target once an editor has consumed it (for that path)
  consumeReveal: (path) => set(s =>
    s.revealTarget && s.revealTarget.path === path ? { revealTarget: null } : s
  ),

  closeTab: (path) => set(s => {
    const i = s.openTabs.indexOf(path)
    const next = s.openTabs.filter(t => t !== path)
    const active = path === s.activeFile ? (next[Math.max(0, i - 1)] ?? next[0] ?? null) : s.activeFile
    useEditorViewCacheStore.getState().drop(path)
    return { openTabs: next, activeFile: active }
  }),

  closeOtherTabs: (path) => set(s => {
    if (!s.openTabs.includes(path)) return s
    useEditorViewCacheStore.getState().keepOnly([path])
    return { openTabs: [path], activeFile: path }
  }),

  closeAllTabs: () => {
    useEditorViewCacheStore.getState().clear()
    set({ openTabs: [], activeFile: null, revealTarget: null })
  },

  renameTab: (oldPath, nextPath) => {
    useEditorViewCacheStore.getState().rename(oldPath, nextPath)
    set(s => ({
      openTabs: s.openTabs.map(path => path === oldPath ? nextPath : path),
      activeFile: s.activeFile === oldPath ? nextPath : s.activeFile
    }))
  },

  setActive: (path) => set({ activeFile: path })
}))
