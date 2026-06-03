import { create } from 'zustand'
import type { AgentMode, AgentSnapshot, Session, Message } from '@/types'
import type { IMConversationEvent } from '@/im/types'

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
  ingestImEvent: (event: IMConversationEvent) => void
  restoreImSessions: (saved: Session[]) => void
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
    // 已有空白会话（无消息、非机器人）→ 直接切到它，不再新建，也不立即持久化
    const blank = get().sessions.find(sess => sess.kind !== 'imbot' && sess.messages.length === 0)
    if (blank) {
      set({ activeId: blank.id })
      return
    }
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

  hydrateFromSnapshot: (snapshot) => set(s => {
    // 保留内存中的机器人会话（全局、不随工作区快照丢失）
    const imbot = s.sessions.filter(x => x.kind === 'imbot')
    const agent = snapshot.sessions.map(session => ({ ...session, archived: Boolean(session.archived) }))
    let sessions: Session[] = [...imbot, ...agent]
    let activeId = snapshot.activeSessionId
    // 激活会话必须存在且未归档；否则落到首个可用会话，或补一个空白草稿
    if (!sessions.some(x => x.id === activeId && !x.archived)) {
      const firstAgent = agent.find(x => !x.archived)
      if (firstAgent) {
        activeId = firstAgent.id
      } else {
        const blank: Session = { id: 's_new', title: '新会话', group: '进行中', time: '刚刚', messages: [] }
        sessions = [blank, ...sessions]
        activeId = blank.id
      }
    }
    return { sessions, activeId, modeBySessionId: snapshot.modeBySessionId }
  }),

  ingestImEvent: (event) => set(s => {
    const sessionId = `imbot:${event.platform}:${event.conversationId}`
    const peer = event.senderNick || '机器人会话'
    const exists = s.sessions.some(sess => sess.id === sessionId)

    // 把一条 IM 事件映射为会话消息
    const toMessage = (): Message =>
      event.role === 'user'
        ? { role: 'user', text: event.text }
        : { role: 'assistant', steps: [], reply: [event.text], typing: event.role === 'pending' }

    const appendInto = (msgs: Message[]): Message[] => {
      // 机器人答复/错误到达时，替换掉上一条「正在思考」占位
      let base = msgs
      if (event.role === 'assistant' || event.role === 'error') {
        const last = base.at(-1)
        if (last?.role === 'assistant' && last.typing) base = base.slice(0, -1)
      }
      return [...base, toMessage()]
    }

    if (exists) {
      return {
        sessions: s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, time: '刚刚', peerName: peer, messages: appendInto(sess.messages) }
            : sess
        )
      }
    }

    const session: Session = {
      id: sessionId,
      kind: 'imbot',
      platform: event.platform,
      peerName: peer,
      title: peer,
      titleEdited: true,
      group: '机器人',
      time: '刚刚',
      messages: appendInto([])
    }
    // 新机器人会话置顶，但不抢占当前激活会话
    return { sessions: [session, ...s.sessions] }
  }),

  restoreImSessions: (saved) => set(s => {
    const existing = new Set(s.sessions.map(x => x.id))
    const toAdd = saved
      .filter(x => x.kind === 'imbot' && !existing.has(x.id))
      .map(x => ({ ...x, archived: Boolean(x.archived) }))
    if (toAdd.length === 0) return {}
    return { sessions: [...toAdd, ...s.sessions] }
  })
}))
