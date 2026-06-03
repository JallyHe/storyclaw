import { useRef, useEffect, useState } from 'react'
import { useCopilotDraftStore, useSessionsStore } from '@/store'
import { useAgentEvents } from '@/hooks/useAgentEvents'
import { Message } from './Message'
import { AgentComposer, type AgentComposerHandle } from './AgentComposer'
import { PermissionDialog } from '@/components/agent/PermissionDialog'
import { Ic } from '@/components/icons'
import { countSessionMessages, formatSessionRelativeTime } from '@/store/sessionMetadata'

const QUICK_ACTIONS = [
  { id: 'continue',    label: '续写本场',    icon: Ic.feather, prompt: '请续写当前剧本场景，保持人物语气和既有情节连贯。' },
  { id: 'breakdown',   label: '剧本拆解',    icon: Ic.scissors, prompt: '请拆解当前剧本的场次、人物行动、冲突推进和可优化点。' },
  { id: 'fromOutline', label: '据大纲续一场', icon: Ic.fileScene, prompt: '请根据大纲续写下一场剧本，并给出清晰的场景标题和动作对白。' },
  { id: 'consistency', label: '一致性检查',   icon: Ic.fileRole, prompt: '请检查当前项目的人物、设定、时间线和情节一致性问题。' },
  { id: 'plot',        label: '梳理情节',    icon: Ic.compass, prompt: '请梳理当前故事情节，指出主线推进、悬念释放和节奏问题。' },
]

interface Props { width: number }

export function Copilot({ width }: Props) {
  useAgentEvents()
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<AgentComposerHandle>(null)
  const { sessions, activeId, setActive, newSession, visibleSessions } = useSessionsStore()
  const queuedSelection = useCopilotDraftStore(s => s.queuedSelection)
  const [chatOpen, setChatOpen] = useState(false)
  const session = sessions.find(s => s.id === activeId)
  const visible = visibleSessions()
  const messages = session?.messages ?? []
  const lastMsg = messages.at(-1)
  const busy = Boolean(lastMsg?.role === 'assistant' && lastMsg.typing)
  const empty = messages.length === 0

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (queuedSelection) setChatOpen(true)
  }, [queuedSelection])

  const fillPrompt = (prompt: string) => {
    composerRef.current?.setText(prompt)
  }

  const createSession = () => {
    newSession()
    setChatOpen(true)
  }

  const pickSession = (id: string) => {
    setActive(id)
    setChatOpen(true)
  }

  return (
    <div className="copilot" style={{ width }}>
      <div className="cp-head">
        <div className="cp-top">
          <button type="button" className="cp-tab active">CHAT</button>
          <div className="cp-head-actions">
            <button type="button" className="cp-icon-btn" title="新建会话" onClick={createSession}>
              <Ic.plus width={15} height={15} />
            </button>
            <button type="button" className="cp-icon-btn" title="更多">
              <Ic.dots width={15} height={15} />
            </button>
          </div>
        </div>
        {chatOpen && (
          <button type="button" className="cp-thread-head" title="选择会话" onClick={() => setChatOpen(false)}>
            <Ic.chevR width={14} height={14} className="cp-thread-back" />
            <span>{session?.title ?? '新会话'}</span>
          </button>
        )}
      </div>
      {!chatOpen ? (
        <div className="cp-overview">
          <div className="cp-section-label">SESSIONS</div>
          <div className="cp-session-list-view">
            {visible.length === 0 ? (
              <div className="cp-session-empty">暂无会话</div>
            ) : (
              visible.map(item => {
                const messageCount = countSessionMessages(item.messages)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`cp-session-row${item.id === activeId ? ' on' : ''}`}
                    onClick={() => pickSession(item.id)}
                  >
                    <span className="cp-session-dot" />
                    <span className="cp-session-row-main">
                      <span className="cp-session-row-title">{item.title}</span>
                      <span className="cp-session-row-meta">
                        <span>{formatSessionRelativeTime(item)}</span>
                        {messageCount > 0 && <span>{messageCount} 条消息</span>}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="cp-scroll" ref={scrollRef}>
            {empty && (
              <div>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)', lineHeight: 1.7, marginBottom: 14 }}>
                  我是你的<b style={{ color: 'var(--text-0)' }}>剧本创作搭档</b>。读懂全剧故事线、人物卡与设定，帮你续写当前场、改写、检查一致性，并把改动以 <b style={{ color: 'var(--text-0)' }}>diff</b> 写回当前这一集文档。
                </div>
                <div className="cp-hint">快速开始</div>
                <div className="cp-actions">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.id} className="qa" disabled={busy} onClick={() => fillPrompt(a.prompt)}>
                      <a.icon width={13} height={13} />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => <Message key={i} m={m} />)}
            {!empty && !busy && (
              <div className="cp-actions" style={{ marginTop: 2 }}>
                {QUICK_ACTIONS.map(a => (
                  <button key={a.id} className="qa" onClick={() => fillPrompt(a.prompt)}>
                    <a.icon width={13} height={13} />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cp-composer">
            <AgentComposer ref={composerRef} busy={busy} includeCurrentDocumentContext />
          </div>
        </>
      )}
      <PermissionDialog />
    </div>
  )
}
