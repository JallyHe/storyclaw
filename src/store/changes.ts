import { create } from 'zustand'
import type { AgentSnapshot, PendingChange } from '@/types'
import { workspaceIpc } from '@/ipc/workspace'
import { useWorkspaceStore } from './workspace'

interface ChangesState {
  changes: Map<string, PendingChange>
  addChange: (change: PendingChange) => void
  acceptChange: (fileId: string) => Promise<void>
  rejectChange: (fileId: string) => void
  acceptAll: () => Promise<void>
  rejectAll: () => void
  hydrateFromSnapshot: (snapshot: AgentSnapshot) => void
}

export const useChangesStore = create<ChangesState>((set, get) => ({
  changes: new Map(),

  addChange: (change) => set(s => {
    const next = new Map(s.changes)
    next.set(change.fileId, change)
    return { changes: next }
  }),

  acceptChange: async (fileId) => {
    const change = get().changes.get(fileId)
    if (!change) return
    // Applied records (AI direct writes) are already on disk — just dismiss them.
    if (!change.applied && change.newContent) {
      await workspaceIpc.writeFile(fileId, change.newContent)
      // Reload any open editor for this file
      useWorkspaceStore.getState().invalidateFile(fileId)
    }
    set(s => { const next = new Map(s.changes); next.delete(fileId); return { changes: next } })
  },

  rejectChange: (fileId) => set(s => {
    const next = new Map(s.changes); next.delete(fileId); return { changes: next }
  }),

  acceptAll: async () => {
    for (const fileId of get().changes.keys()) await get().acceptChange(fileId)
  },

  rejectAll: () => set({ changes: new Map() }),

  hydrateFromSnapshot: (snapshot) => set({
    changes: new Map(snapshot.pendingChanges.map(change => [change.fileId, change]))
  })
}))
