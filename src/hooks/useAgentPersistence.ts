import { useEffect } from 'react'
import { agentIpc } from '@/ipc/agent'
import { useChangesStore, useSessionsStore, useWorkspaceStore } from '@/store'
import type { AgentSnapshot } from '@/types'

export function useAgentPersistence() {
  const root = useWorkspaceStore(s => s.root)

  useEffect(() => {
    if (!root) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleSave = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        agentIpc.saveSnapshot(root, createSnapshot()).catch(err => {
          console.error('[Agent] Failed to save snapshot:', err)
        })
      }, 150)
    }

    const unsubSessions = useSessionsStore.subscribe(scheduleSave)
    const unsubChanges = useChangesStore.subscribe(scheduleSave)

    return () => {
      if (timer) {
        clearTimeout(timer)
        agentIpc.saveSnapshot(root, createSnapshot()).catch(err => {
          console.error('[Agent] Failed to save snapshot:', err)
        })
      }
      unsubSessions()
      unsubChanges()
    }
  }, [root])
}

function createSnapshot(): AgentSnapshot {
  const sessionsState = useSessionsStore.getState()
  const changesState = useChangesStore.getState()
  return {
    version: 1,
    activeSessionId: sessionsState.activeId,
    modeBySessionId: sessionsState.modeBySessionId,
    // 机器人会话单独全局持久化；空白草稿会话在发出第一条消息前不保存
    sessions: sessionsState.sessions.filter(s => s.kind !== 'imbot' && s.messages.length > 0),
    pendingChanges: [...changesState.changes.values()]
  }
}
