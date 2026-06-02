import { create } from 'zustand'
import type { AgentMode, AgentSnapshot, Session, Message } from '@/types'

interface SessionsState {
  sessions: Session[]
  activeId: string
  modeBySessionId: Record<string, AgentMode>
  addMessage: (msg: Message) => void
  appendDelta: (sessionId: string, delta: string) => void
  addToolStep: (sessionId: string, tool: string, label: string, target: string) => void
  completeToolStep: (sessionId: string, tool: string, isError: boolean) => void
  appendThinking: (sessionId: string, delta: string) => void
  finalizeReply: (sessionId: string) => void
  newSession: () => void
  setActive: (id: string) => void
  renameSession: (id: string, title: string) => void
  archiveSession: (id: string) => void
  visibleSessions: () => Session[]
  setActiveMode: (mode: AgentMode) => void
  getActiveMode: () => AgentMode
  deleteMessage: (sessionId: string, index: number) => void
  hydrateFromSnapshot: (snapshot: AgentSnapshot) => void
}

const INITIAL_SESSION: Session = {
  id: 's_new', title: '新会话', group: '进行中', time: '刚刚', messages: []
}

function createTitleFromMessage(text: string): string {
  const compact = text
    .replace(/[#*_`>\-[\](){}]/g, '')
    .replace(/\s+/g, '')
    .replace(/[。！？!?，,；;：:]+$/g, '')
  return compact.slice(0, 11) || '新会话'
}

function shouldAutoName(session: Session): boolean {
  return !session.titleEdited && (session.title === '新会话' || session.messages.length === 0)
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [INITIAL_SESSION],
  activeId: 's_new',
  modeBySessionId: { s_new: 'craft' },

  addMessage: (msg) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== s.activeId) return sess
      const title = msg.role === 'user' && shouldAutoName(sess)
        ? createTitleFromMessage(msg.text)
        : sess.title
      return { ...sess, title, messages: [...sess.messages, msg] }
    })
  })),

  appendDelta: (sessionId, delta) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      const updated = { ...last, reply: [...last.reply.slice(0, -1), (last.reply[last.reply.length - 1] ?? '') + delta] }
      return { ...sess, messages: [...msgs.slice(0, -1), updated] }
    })
  })),

  addToolStep: (sessionId, tool, label, target) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      const step = { kind: tool as any, label, target }
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, steps: [...last.steps, step] }] }
    })
  })),

  completeToolStep: (sessionId, _tool, isError) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant' || !last.steps.length) return sess
      const steps = [...last.steps]
      steps[steps.length - 1] = { ...steps[steps.length - 1], isError }
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, steps }] }
    })
  })),

  appendThinking: (sessionId, delta) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant' || !last.steps.length) return sess
      const steps = [...last.steps]
      const idx = steps.length - 1
      const step = steps[idx]
      if ((step.kind as string) !== 'thinking' || step.isError !== undefined) return sess
      const prev = step.thinking ?? ''
      const merged = prev + delta
      // keep target as a short snippet for the row header
      const snippet = merged.replace(/\s+/g, ' ').slice(0, 60)
      steps[idx] = { ...step, thinking: merged, target: snippet }
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, steps }] }
    })
  })),

  finalizeReply: (sessionId) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      const steps = last.steps.map(step =>
        step.isError === undefined ? { ...step, isError: false } : step
      )
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, typing: false, steps }] }
    })
  })),

  newSession: () => {
    const id = 's_' + Date.now()
    const session: Session = { id, title: '新会话', group: '进行中', time: '刚刚', messages: [] }
    set(s => ({
      sessions: [session, ...s.sessions.map(sess => sess.group === '进行中' ? { ...sess, group: '今天' } : sess)],
      activeId: id,
      modeBySessionId: { ...s.modeBySessionId, [id]: 'craft' }
    }))
  },

  setActive: (id) => set({ activeId: id }),

  renameSession: (id, title) => {
    const cleanTitle = title.trim().slice(0, 40)
    if (!cleanTitle) return
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id === id ? { ...sess, title: cleanTitle, titleEdited: true } : sess
      )
    }))
  },

  archiveSession: (id) => set(s => {
    const sessions = s.sessions.map(sess =>
      sess.id === id ? { ...sess, archived: true, group: '归档' } : sess
    )
    const visible = sessions.filter(sess => !sess.archived)
    return {
      sessions,
      activeId: s.activeId === id ? (visible[0]?.id ?? id) : s.activeId
    }
  }),

  visibleSessions: () => get().sessions.filter(session => !session.archived),

  setActiveMode: (mode) => set(s => ({
    modeBySessionId: { ...s.modeBySessionId, [s.activeId]: mode }
  })),

  getActiveMode: () => get().modeBySessionId[get().activeId] ?? 'craft',

  deleteMessage: (sessionId, index) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess
      const messages = [...sess.messages]
      messages.splice(index, 1)
      return { ...sess, messages }
    })
  })),

  hydrateFromSnapshot: (snapshot) => set({
    sessions: snapshot.sessions.map(session => ({ ...session, archived: Boolean(session.archived) })),
    activeId: snapshot.activeSessionId,
    modeBySessionId: snapshot.modeBySessionId
  })
}))
