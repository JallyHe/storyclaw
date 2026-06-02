import { create } from 'zustand'
import type { AppView, LeftPanel, ThemeKey } from '@/types'

interface UiState {
  view: AppView
  theme: ThemeKey
  leftPanel: LeftPanel
  leftOpen: boolean
  rightOpen: boolean
  explorerWidth: number
  copilotWidth: number
  sessionsWidth: number
  changesWidth: number
  setView: (v: AppView) => void
  setTheme: (t: ThemeKey) => void
  setLeftPanel: (p: LeftPanel) => void
  toggleLeft: () => void
  toggleRight: () => void
  setExplorerWidth: (w: number) => void
  setCopilotWidth: (w: number) => void
  setSessionsWidth: (w: number) => void
  setChangesWidth: (w: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  view: 'editor', theme: 'dark', leftPanel: 'explorer',
  leftOpen: true, rightOpen: true,
  explorerWidth: 256, copilotWidth: 384, sessionsWidth: 256, changesWidth: 340,
  setView: (view) => set({ view }),
  setTheme: (theme) => { document.documentElement.setAttribute('data-theme', theme); set({ theme }) },
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
  setExplorerWidth: (explorerWidth) => set({ explorerWidth }),
  setCopilotWidth: (copilotWidth) => set({ copilotWidth }),
  setSessionsWidth: (sessionsWidth) => set({ sessionsWidth }),
  setChangesWidth: (changesWidth) => set({ changesWidth })
}))
