import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react'
import { useSessionsStore } from '@/store'
import { Ic } from '@/components/icons'
import { formatSessionTime } from '@/lib/datetime'
import type { Session } from '@/types'

interface Props { width: number }

const PLATFORM_LABELS: Record<string, string> = { dingtalk: '钉钉', feishu: '飞书', wechat: '企微' }
function platformLabel(platform?: string): string {
  return platform ? (PLATFORM_LABELS[platform] ?? platform) : '机器人'
}

function SessionRow({ session, active, running, editing, editValue, onEditValue, onStartEdit, onCommitEdit, onCancelEdit, onPick, onContext, onArchive }: {
  session: Session
  active: boolean
  running: boolean
  editing: boolean
  editValue: string
  onEditValue: (value: string) => void
  onStartEdit: () => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onPick: () => void
  onContext: (event: MouseEvent, session: Session) => void
  onArchive: (session: Session) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  return (
    <div
      className={`session-row${active ? ' on' : ''}`}
      onClick={onPick}
      onDoubleClick={event => {
        event.stopPropagation()
        onStartEdit()
      }}
      onContextMenu={event => onContext(event, session)}
    >
      <span className="session-ico">
        {session.kind === 'imbot'
          ? <Ic.robot width={14} height={14} />
          : running
            ? <Ic.spark width={14} height={14} />
            : <Ic.message width={14} height={14} />
        }
      </span>
      <div className="session-body">
        {editing ? (
          <input
            ref={inputRef}
            className="session-title-input"
            value={editValue}
            onChange={event => onEditValue(event.target.value)}
            onClick={event => event.stopPropagation()}
            onBlur={onCommitEdit}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              event.stopPropagation()
              if (event.key === 'Enter') onCommitEdit()
              if (event.key === 'Escape') onCancelEdit()
            }}
          />
        ) : (
          <div className="session-title">
            {session.kind === 'imbot' && <span className="session-tag">{platformLabel(session.platform)}</span>}
            {session.title}
          </div>
        )}
        <div className="session-meta">{formatSessionTime(session.ts, session.time)}</div>
      </div>
      {!editing && (
        <button
          className="session-del"
          title="归档会话"
          aria-label="归档会话"
          onClick={event => {
            event.stopPropagation()
            onArchive(session)
          }}
        >
          <Ic.trash width={13} height={13} />
        </button>
      )}
    </div>
  )
}

export function SessionList({ width }: Props) {
  const { activeId, sessions: allSessions, setActive, newSession, renameSession, archiveSession, visibleSessions } = useSessionsStore()
  const sessions = visibleSessions()
  // A session is "running" if its last message is an assistant message still typing
  const runningIds = new Set(
    allSessions
      .filter(s => { const last = s.messages.at(-1); return last?.role === 'assistant' && last.typing })
      .map(s => s.id)
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; session: Session } | null>(null)

  const groups: Record<string, typeof sessions> = {}
  sessions.forEach(s => { (groups[s.group] = groups[s.group] ?? []).push(s) })
  const order = ['机器人', '进行中', '今天', '更早']

  const startEdit = (session: Session) => {
    setMenu(null)
    setEditingId(session.id)
    setEditValue(session.title)
  }

  const commitEdit = () => {
    if (editingId) renameSession(editingId, editValue)
    setEditingId(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const openContextMenu = (event: MouseEvent, session: Session) => {
    event.preventDefault()
    event.stopPropagation()
    setActive(session.id)
    setMenu({ x: event.clientX, y: event.clientY, session })
  }

  const archiveFromMenu = (session: Session) => {
    setMenu(null)
    archiveSession(session.id)
  }

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  return (
    <div className="sessions" style={{ width, flexShrink: 0 }}>
      <div className="sessions-head">
        <span className="sh-title">会话</span>
        <button className="new-session" onClick={newSession}>
          <Ic.plus width={13} height={13} />
          新会话
        </button>
      </div>
      <div className="sb-scroll">
        {order.filter(g => groups[g]).map(g => (
          <div key={g}>
            <div className="session-group">{g}</div>
            {groups[g].map(s => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                running={runningIds.has(s.id)}
                editing={editingId === s.id}
                editValue={editValue}
                onEditValue={setEditValue}
                onStartEdit={() => startEdit(s)}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onPick={() => setActive(s.id)}
                onContext={openContextMenu}
                onArchive={archiveFromMenu}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="sessions-foot">
        <Ic.history width={12} height={12} />
        共 {sessions.length} 个会话
      </div>
      {menu && (
        <div
          className="session-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={event => event.stopPropagation()}
        >
          <button onClick={() => startEdit(menu.session)}>
            <Ic.edit width={13} height={13} /> 改名
          </button>
          <button onClick={() => archiveFromMenu(menu.session)}>
            <Ic.x width={13} height={13} /> 归档
          </button>
        </div>
      )}
    </div>
  )
}
