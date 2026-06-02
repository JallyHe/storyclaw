import { useCallback } from 'react'
import type { Block as BlockType, DiffStatus } from '@/types'

interface Props {
  blk: BlockType
  diff: DiffStatus
  onEdit?: (id: string, text: string) => void
}

export function Block({ blk, diff, onEdit }: Props) {
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
        {blk.ext && <span className="ext">（{blk.ext}）</span>}
      </div>
    )
  }
  const label = { action: '动作', dialogue: '对白', paren: '潜台词', transition: '转场' }[blk.type] ?? ''
  const klass = { action: 'blk-action', dialogue: 'blk-dialogue', paren: 'blk-paren', transition: 'blk-action' }[blk.type] ?? ''

  return (
    <div
      className={`blk ${klass} ${cls}`}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={editable ? commit : undefined}
    >
      <span className="blk-gutter" contentEditable={false}>{label}</span>
      {'text' in blk ? blk.text : ''}
    </div>
  )
}
