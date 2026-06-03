import { create } from 'zustand'
import type { IMConversationEvent } from '@/im/types'

const MAX_EVENTS = 500

interface ImBotState {
  events: IMConversationEvent[]
  /** 未读消息数（面板未激活时累加） */
  unread: number
  push: (event: IMConversationEvent) => void
  clear: () => void
  resetUnread: () => void
}

export const useImBotStore = create<ImBotState>((set) => ({
  events: [],
  unread: 0,
  push: (event) => set(state => {
    // 当机器人回复/报错到达时，移除该会话此前的「正在思考」占位
    let events = state.events
    if (event.role === 'assistant' || event.role === 'error') {
      events = events.filter(e => !(e.role === 'pending' && e.conversationId === event.conversationId))
    }
    events = [...events, event]
    if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS)
    // pending 不计未读（它只是过渡态）
    const unread = event.role === 'pending' ? state.unread : state.unread + 1
    return { events, unread }
  }),
  clear: () => set({ events: [], unread: 0 }),
  resetUnread: () => set({ unread: 0 })
}))
