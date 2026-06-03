import { useEffect, useMemo, useRef, useState } from 'react'
import { useImBotStore } from '@/store'
import { imIpc } from '@/ipc/im'
import { getPlatformDescriptor } from '@/im/registry'
import type { IMPlatform, IMStatusSnapshot } from '@/im/types'
import { Ic } from '@/components/icons'
import { Markdown } from '@/components/common/Markdown'
import './imbot.css'

function platformName(id: IMPlatform): string {
  return getPlatformDescriptor(id)?.name.replace(/集成$/, '') ?? id
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function IMBotPanel({ width }: { width: number }) {
  const { events, clear, resetUnread } = useImBotStore()
  const [statuses, setStatuses] = useState<Record<string, IMStatusSnapshot>>({})
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { resetUnread() }, [resetUnread])

  useEffect(() => {
    void imIpc.getStatuses().then(list => {
      setStatuses(Object.fromEntries(list.map(s => [s.platform, s])))
    }).catch(() => {})
    return imIpc.onStatus(s => setStatuses(cur => ({ ...cur, [s.platform]: s })))
  }, [])

  // 新消息自动滚到底
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [events.length])

  const connected = useMemo(
    () => Object.values(statuses).filter(s => s.status === 'connected').map(s => s.platform),
    [statuses]
  )

  return (
    <div className="imbot-panel" style={{ width }}>
      <div className="imbot-head">
        <span className="imbot-title"><Ic.robot width={16} height={16} /> 机器人会话</span>
        <button className="imbot-clear" title="清空" onClick={clear}><Ic.x width={14} height={14} /></button>
      </div>

      <div className="imbot-status-bar">
        {connected.length > 0
          ? connected.map(p => <span key={p} className="imbot-chip on">{platformName(p)} 已连接</span>)
          : <span className="imbot-chip">无已连接平台</span>}
      </div>

      <div className="imbot-list" ref={listRef}>
        {events.length === 0 && (
          <div className="imbot-empty">
            <Ic.message width={22} height={22} />
            <p>还没有会话。机器人收到 IM 消息后会显示在这里。</p>
          </div>
        )}
        {events.map(ev => (
          <div key={ev.id} className={`imbot-msg ${ev.role}`}>
            <div className="imbot-msg-meta">
              <span className="imbot-msg-who">
                {ev.role === 'user' ? (ev.senderNick || '用户') : '助手'}
              </span>
              <span className="imbot-msg-plat">{platformName(ev.platform)}</span>
              <span className="imbot-msg-time">{formatTime(ev.ts)}</span>
            </div>
            <div className="imbot-msg-body">
              {ev.role === 'pending'
                ? <span className="imbot-typing">正在思考中<i></i><i></i><i></i></span>
                : ev.role === 'user'
                  ? ev.text
                  : <Markdown text={ev.text} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
