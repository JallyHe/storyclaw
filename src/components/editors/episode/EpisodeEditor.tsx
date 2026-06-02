import { useState, useRef, useCallback, useEffect } from 'react'
import type { EpFile, DiffBlock } from '@/types'
import { SceneNav } from './SceneNav'
import { useWorkspaceStore } from '@/store'
import { Ic } from '@/components/icons'
import storyclawLogo from '@/assets/storyclaw-logo.png'

// ── Block renderer ─────────────────────────────────────────────────────────────
function Block({ blk, diff, onEdit }: {
  blk: EpFile['blocks'][0]
  diff: 'add' | 'del' | null
  onEdit?: (id: string, text: string) => void
}) {
  const cls = diff === 'add' ? 'diff-add' : diff === 'del' ? 'diff-del' : ''
  const editable = !diff && !!onEdit && (blk.type === 'action' || blk.type === 'dialogue' || blk.type === 'paren' || blk.type === 'transition')

  const commit = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (onEdit) onEdit(blk.id, e.currentTarget.innerText)
  }, [blk.id, onEdit])

  if (blk.type === 'scene') {
    return (
      <div className={`blk blk-scene ${cls}`} data-head={blk.id}>
        <span className="blk-gutter">场头</span>
        <span className="sc-no">{blk.number}</span>
        <span className="sc-ie">{blk.intext}</span>
        <span>{blk.location}</span>
        <span className="sc-time">{blk.time}</span>
      </div>
    )
  }
  if (blk.type === 'character') {
    return (
      <div className={`blk blk-character ${cls}`}>
        <span className="blk-gutter">人物</span>
        {blk.name}
        {blk.ext && <span className="ext">{blk.ext}</span>}
      </div>
    )
  }

  const labels: Record<string, string> = { action: '动作', dialogue: '对白', paren: '潜台词', transition: '转场' }
  const classes: Record<string, string> = { action: 'blk-action', dialogue: 'blk-dialogue', paren: 'blk-paren', transition: 'blk-action' }
  const label = labels[blk.type] ?? ''
  const klass = classes[blk.type] ?? ''
  const text = 'text' in blk ? blk.text : ''

  return (
    <div
      className={`blk ${klass} ${cls}`}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={editable ? commit : undefined}
    >
      <span className="blk-gutter">{label}</span>
      {text}
    </div>
  )
}

// ── DiffBar ────────────────────────────────────────────────────────────────────
function DiffBar({ onAccept, onReject }: { onAccept: () => void; onReject: () => void }) {
  return (
    <div className="diff-bar">
      <span className="dicon"><img src={storyclawLogo} alt="" /></span>
      <span className="dtext"><b>AI 改动</b> — 审阅后选择接受或拒绝</span>
      <button className="btn btn-accept" onClick={onAccept}>✓ 接受</button>
      <button className="btn btn-reject" onClick={onReject}>✕ 拒绝</button>
    </div>
  )
}

// ── EpisodeEditor ──────────────────────────────────────────────────────────────
interface Props {
  filePath: string
  file: EpFile
  diffBlocks?: DiffBlock[]
  onAccept: () => void
  onReject: () => void
}

const STATUS_MAP: Record<string, string> = { done: '已完成', wip: '写作中', todo: '大纲' }

export function EpisodeEditor({ filePath, file, diffBlocks, onAccept, onReject }: Props) {
  const { saveFile, markDirty } = useWorkspaceStore()
  const [navOpen, setNavOpen] = useState(true)
  const [focusedScene, setFocusedScene] = useState<string | null>(
    file.blocks.find(b => b.type === 'scene')?.id ?? null
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  const jumpTo = useCallback((headId: string) => {
    setFocusedScene(headId)
    const el = scrollRef.current?.querySelector(`[data-head="${headId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (diffBlocks && scrollRef.current) {
      const el = scrollRef.current.querySelector('.diff-add, .diff-del')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [diffBlocks])

  const onEdit = useCallback(async (blockId: string, text: string) => {
    const updated: EpFile = {
      ...file,
      blocks: file.blocks.map(b => b.id === blockId ? { ...b, text } as any : b)
    }
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [file, filePath, saveFile, markDirty])

  const statusCls = file.status ?? 'todo'
  const statusLabel = STATUS_MAP[statusCls] ?? '大纲'

  return (
    <div className="episode-editor">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <button className={`tool-btn${navOpen ? ' on' : ''}`} onClick={() => setNavOpen(o => !o)}>
          <Ic.scenes width={14} height={14} />
          场景大纲
        </button>
        <div className="tb-divider" />
        <span className="ep-stat">
          <Ic.film width={13} height={13} />
          <span className={`st-text st-${statusCls}`}>{statusLabel}</span>
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {file.episode} · {file.title}
        </span>
      </div>

      {/* Body: nav + screenplay */}
      <div className="episode-body">
        {navOpen && (
          <SceneNav file={file} activeId={focusedScene} onPick={jumpTo} />
        )}
        <div className="editor-wrap" style={{ background: 'var(--bg-editor)' }}>
          <div className="editor-scroll" ref={scrollRef}>
            {file.logline && (
              <div className="ep-logline">
                <span className="epl-no">{file.episode}</span>
                {file.logline}
              </div>
            )}
            <div className="page">
              {diffBlocks
                ? diffBlocks.map((item, i) => (
                    <Block key={item.blk.id + i} blk={item.blk} diff={item.diff} />
                  ))
                : file.blocks.map(b => (
                    <Block key={b.id} blk={b} diff={null} onEdit={onEdit} />
                  ))
              }
            </div>
            {diffBlocks && <DiffBar onAccept={onAccept} onReject={onReject} />}
          </div>
        </div>
      </div>
    </div>
  )
}
