import { create } from 'zustand'
import type { ScreenplayLineType } from '@/editors/screenplay/schema'

export interface ScreenplayViewState {
  selectionFrom: number
  selectionTo: number
  scrollTop: number
  lineType: ScreenplayLineType
}

interface EditorViewCacheState {
  screenplayStates: Map<string, ScreenplayViewState>
  getScreenplayState: (path: string) => ScreenplayViewState | undefined
  saveScreenplayState: (path: string, state: ScreenplayViewState) => void
  drop: (path: string) => void
  keepOnly: (paths: string[]) => void
  clear: () => void
  rename: (oldPath: string, nextPath: string) => void
}

export const useEditorViewCacheStore = create<EditorViewCacheState>((set, get) => ({
  screenplayStates: new Map(),

  getScreenplayState: path => get().screenplayStates.get(path),

  saveScreenplayState: (path, state) => set(s => {
    const screenplayStates = new Map(s.screenplayStates)
    screenplayStates.set(path, state)
    return { screenplayStates }
  }),

  drop: path => set(s => {
    const screenplayStates = new Map(s.screenplayStates)
    screenplayStates.delete(path)
    return { screenplayStates }
  }),

  keepOnly: paths => set(s => {
    const keep = new Set(paths)
    const screenplayStates = new Map(
      [...s.screenplayStates].filter(([path]) => keep.has(path))
    )
    return { screenplayStates }
  }),

  clear: () => set({ screenplayStates: new Map() }),

  rename: (oldPath, nextPath) => set(s => {
    const screenplayStates = new Map(s.screenplayStates)
    const state = screenplayStates.get(oldPath)
    screenplayStates.delete(oldPath)
    if (state) screenplayStates.set(nextPath, state)
    return { screenplayStates }
  })
}))
