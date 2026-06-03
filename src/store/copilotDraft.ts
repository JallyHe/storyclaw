import { create } from 'zustand'
import type { SelectionReference } from '@/components/copilot/selectionReference'

export interface CopilotDraftSelection {
  ref: SelectionReference
  promptText?: string
  autoSubmit?: boolean
}

interface CopilotDraftState {
  queuedSelection: CopilotDraftSelection | null
  queueSelection: (selection: CopilotDraftSelection) => void
  consumeSelection: () => CopilotDraftSelection | null
}

export const useCopilotDraftStore = create<CopilotDraftState>((set, get) => ({
  queuedSelection: null,
  queueSelection: (selection) => set({ queuedSelection: selection }),
  consumeSelection: () => {
    const selection = get().queuedSelection
    set({ queuedSelection: null })
    return selection
  }
}))
