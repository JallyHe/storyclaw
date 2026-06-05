import { useRef, useEffect, useState } from 'react'
import { useChangesStore, useCopilotDraftStore, useSessionsStore, useTabsStore, useUiStore } from '@/store'
import { useAgentEvents } from '@/hooks/useAgentEvents'
import { Message } from './Message'
import { AgentComposer, type AgentComposerHandle } from './AgentComposer'
import { PermissionDialog } from '@/components/agent/PermissionDialog'
import { Ic } from '@/components/icons'
import { countSessionMessages, formatSessionRelativeTime } from '@/store/sessionMetadata'
import type { Block } from '@/types'

const QUICK_ACTIONS = [
  { id: 'continue',    label: '续写本场',    icon: Ic.feather, prompt: '请续写当前剧本场景，保持人物语气和既有情节连贯。' },
  { id: 'breakdown',   label: '剧本拆解',    icon: Ic.scissors, prompt: '请拆解当前剧本的场次、人物行动、冲突推进和可优化点。' },
  { id: 'fromOutline', label: '据大纲续一场', icon: Ic.fileScene, prompt: '请根据大纲续写下一场剧本，并给出清晰的场景标题和动作对白。' },
  { id: 'consistency', label: '一致性检查',   icon: Ic.fileRole, prompt: '请检查当前项目的人物、设定、时间线和情节一致性问题。' },
  { id: 'plot',        label: '梳理情节',    icon: Ic.compass, prompt: '请梳理当前故事情节，指出主线推进、悬念释放和节奏问题。' },
]

function blockPreview(block: Block): string {
  if (block.type === 'character') return block.name + (block.ext ? `（${block.ext}）` : '')
  if (block.type === 'scene') return [`第 ${block.number} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ') || '场景'
  return block.text || block.type
}

interface Props { width: number }

export function Copilot({ width }: Props) {
  useAgentEvents()
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<AgentComposerHandle>(null)
  const { sessions, activeId, setActive, newSession, visibleSessions } = useSessionsStore()
  const queuedSelection = useCopilotDraftStore(s => s.queuedSelection)
  const changes = useChangesStore(s => s.changes)
  const acceptAll = useChangesStore(s => s.acceptAll)
  const openTab = useTabsStore(s => s.openTab)
  const setView = useUiStore(s => s.setView)
  const [chatOpen, setChatOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
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

  const changeList = [...changes.entries()]
  const totalAdd = changeList.reduce((total, [, change]) => total + change.diffBlocks.filter(block => block.diff === 'add').length, 0)
  const totalDel = changeList.reduce((total, [, change]) => total + change.diffBlocks.filter(block => block.diff === 'del').length, 0)
  const openChange = (fileId: string, block?: Block) => {
    setView('editor')
    openTab(fileId, {
      line: 1,
      column: 0,
      length: Math.max(1, block ? blockPreview(block).length : 1),
      matchText: block ? blockPreview(block) : '',
      blockId: block?.id
    })
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
          {changeList.length > 0 && (
            <div className="cp-changes-summary">
              <button type="button" className="cp-changes-head" onClick={() => setChangesOpen(open => !open)}>
                <Ic.changes width={13} height={13} />
                <span>{changeList.length} 个改动</span>
                <span className="cp-changes-stat">
                  {totalAdd > 0 && <b className="add">+{totalAdd}</b>}
                  {totalDel > 0 && <b className="del">-{totalDel}</b>}
                </span>
                <Ic.chevD width={12} height={12} style={{ transform: changesOpen ? 'rotate(180deg)' : undefined }} />
              </button>
              {changesOpen && (
                <div className="cp-changes-list">
                  {changeList.map(([fileId, change]) => {
                    const name = fileId.split(/[\\/]/).pop() ?? fileId
                    const adds = change.diffBlocks.filter(block => block.diff === 'add')
                    const dels = change.diffBlocks.filter(block => block.diff === 'del')
                    const firstChangedBlock = change.diffBlocks.find(block => block.diff)?.blk
                    const preview = change.diffBlocks
                      .filter(block => block.diff)
                      .slice(0, 4)
                      .map(block => ({
                        diff: block.diff,
                        text: blockPreview(block.blk)
                      }))
                    return (
                      <button key={fileId} type="button" className="cp-change-file" onClick={() => openChange(fileId, firstChangedBlock)}>
                        <span className="cp-change-file-row">
                          <span className="cp-change-name">{name}</span>
                          <span className="cp-changes-stat">
                            {adds.length > 0 && <b className="add">+{adds.length}</b>}
                            {dels.length > 0 && <b className="del">-{dels.length}</b>}
                          </span>
                        </span>
                        {preview.length > 0 && (
                          <span className="cp-change-preview">
                            {preview.map((item, index) => (
                              <span key={index} className={item.diff === 'add' ? 'add' : 'del'}>{item.diff === 'add' ? '+' : '-'} {item.text}</span>
                            ))}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <button type="button" className="cp-change-accept-all" onClick={() => void acceptAll()}>
                    <Ic.checkAll width={12} height={12} /> 全部接受
                  </button>
                </div>
              )}
            </div>
          )}
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
