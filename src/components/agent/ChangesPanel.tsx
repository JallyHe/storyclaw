import { useState } from 'react'
import { useChangesStore, useTabsStore, useUiStore } from '@/store'
import { FILE_KIND, Ic } from '@/components/icons'
import type { DiffBlock } from '@/types'

function blockPreview(block: DiffBlock['blk']): string {
  if (block.type === 'character') return block.name + (block.ext ? `（${block.ext}）` : '')
  if (block.type === 'scene') return [`第 ${block.number} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ') || '场景'
  return block.text || block.type
}

function ChangeRow({ fileId, diffBlocks, applied, summary, onOpen, onAccept, onReject }: {
  fileId: string; diffBlocks: DiffBlock[]
  applied?: boolean; summary?: string; onOpen: (id: string, block?: DiffBlock['blk']) => void
  onAccept: (id: string) => void; onReject: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const ext = fileId.split('.').pop() ?? ''
  const name = fileId.split(/[\\/]/).pop() ?? fileId
  const nameOnly = name.replace(/\.[^.]+$/, '')
  const kind = FILE_KIND[ext] ?? { icon: Ic.diffFile, color: 'var(--accent)' }

  // Applied record (AI already wrote directly, e.g. markdown outline) — info card
  if (applied) {
    return (
      <div className="change-card applied">
        <div className="change-h">
          <span className="file-ico" style={{ color: kind.color }}>
            <kind.icon width={14} height={14} />
          </span>
          <span className="change-name" onClick={() => onOpen(fileId)}>
            {nameOnly}<span className="file-ext">.{ext}</span>
          </span>
          <span className="change-applied-tag">{summary ?? '已更新'}</span>
        </div>
        <div className="change-actions">
          <button className="mini-btn" onClick={() => onOpen(fileId)}>
            <Ic.fileScene width={12} height={12} /> 打开
          </button>
          <button className="mini-btn accept" onClick={() => onAccept(fileId)}>
            <Ic.check width={12} height={12} /> 知道了
          </button>
        </div>
      </div>
    )
  }

  const added   = diffBlocks.filter(b => b.diff === 'add').length
  const removed = diffBlocks.filter(b => b.diff === 'del').length

  const mini = diffBlocks
    .filter(b => b.diff)
    .map(b => ({
      t: b.diff as 'add' | 'del',
      block: b.blk,
      s: blockPreview(b.blk)
    }))

  return (
    <div className="change-card">
      <div className="change-h">
        <span
          className="twisty"
          onClick={() => setOpen(o => !o)}
          style={{ transform: open ? 'rotate(90deg)' : '' }}
        >
          <Ic.chevRight width={13} height={13} />
        </span>
        <span className="file-ico" style={{ color: kind.color }}>
          <kind.icon width={14} height={14} />
        </span>
        <span className="change-name" onClick={() => onOpen(fileId)}>
          {nameOnly}<span className="file-ext">.{ext}</span>
        </span>
        <span className="change-stat">
          {added   > 0 && <span className="add">+{added}</span>}
          {removed > 0 && <span className="del">−{removed}</span>}
        </span>
      </div>
      {open && mini.length > 0 && (
        <div className="change-diff">
          {mini.map((d, i) => (
            <button key={i} type="button" className={`l ${d.t}`} onClick={() => onOpen(fileId, d.block)} title="打开并跳到这处改动">
              <span className="sign">{d.t === 'add' ? '+' : '−'}</span>
              {d.s}
            </button>
          ))}
        </div>
      )}
      <div className="change-actions">
        <button className="mini-btn" onClick={() => onReject(fileId)}>
          <Ic.x width={12} height={12} /> 拒绝
        </button>
        <button className="mini-btn accept" onClick={() => onAccept(fileId)}>
          <Ic.check width={12} height={12} /> 接受
        </button>
      </div>
    </div>
  )
}

interface Props { width: number }

export function ChangesPanel({ width }: Props) {
  const { changes, acceptChange, rejectChange, acceptAll, rejectAll } = useChangesStore()
  const openTab = useTabsStore(s => s.openTab)
  const setView = useUiStore(s => s.setView)
  // Open in the editor: switch to the editor view first, then open the tab,
  // otherwise nothing visibly happens while the user is on the Agent page.
  const openInEditor = (id: string, block?: DiffBlock['blk']) => {
    setView('editor')
    openTab(id, {
      line: 1,
      column: 0,
      length: Math.max(1, block ? blockPreview(block).length : 1),
      matchText: block ? blockPreview(block) : '',
      blockId: block?.id
    })
  }
  const list = [...changes.entries()]

  const totalAdd = list.reduce((a, [, c]) => a + c.diffBlocks.filter(b => b.diff === 'add').length, 0)
  const totalDel = list.reduce((a, [, c]) => a + c.diffBlocks.filter(b => b.diff === 'del').length, 0)

  return (
    <div className="changes-panel" style={{ width, flexShrink: 0 }}>
      <div className="changes-head">
        <span className="ch-title">
          <Ic.changes width={14} height={14} />
          改动
        </span>
        {list.length > 0 && (
          <span className="ch-count">
            <span className="add">+{totalAdd}</span>{' '}
            <span className="del">−{totalDel}</span>
          </span>
        )}
      </div>
      {list.length === 0 ? (
        <div className="changes-empty">
          <span className="ce-ico"><Ic.changes width={26} height={26} /></span>
          <div className="ce-t">暂无改动</div>
          <div className="ce-d">Agent 修改剧本、人物或设定后，<br />改动会以 diff 汇总在这里，等你审阅。</div>
        </div>
      ) : (
        <>
          <div className="changes-bar">
            <span>{list.length} 项改动</span>
            <div className="cb-actions">
              <button className="mini-btn" onClick={rejectAll}>全部拒绝</button>
              <button className="mini-btn accept" onClick={acceptAll}>
                <Ic.checkAll width={13} height={13} /> 全部接受
              </button>
            </div>
          </div>
          <div className="sb-scroll">
            {list.map(([fileId, change]) => (
              <ChangeRow
                key={fileId}
                fileId={fileId}
                diffBlocks={change.diffBlocks}
                applied={change.applied}
                summary={change.summary}
                onOpen={openInEditor}
                onAccept={acceptChange}
                onReject={rejectChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
