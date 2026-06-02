import { useEffect, useRef, useState, useCallback } from 'react'
import { workspaceIpc } from '@/ipc/workspace'
import { useTabsStore } from '@/store'
import { DocumentEditorShell } from '@/components/editors/DocumentEditorShell'
import './plaintext.css'

interface Props { filePath: string }

export function PlainTextEditor({ filePath }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const name = filePath.split(/[\\/]/).pop() ?? filePath

  const revealTarget = useTabsStore(s => s.revealTarget)
  const consumeReveal = useTabsStore(s => s.consumeReveal)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setDirty(false)
    workspaceIpc.readText(filePath)
      .then(t => { setText(t); setLoading(false) })
      .catch(err => { setError(err?.message ?? '无法读取文件'); setLoading(false) })
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [filePath])

  // Reveal & select the matched line when navigated from search
  useEffect(() => {
    if (loading || text === null) return
    const ta = textareaRef.current
    if (!ta || !revealTarget || revealTarget.path !== filePath) return

    // Convert 1-based line + 0-based column to an absolute character offset
    const lines = text.split('\n')
    const lineIdx = Math.min(revealTarget.line - 1, lines.length - 1)
    let offset = 0
    for (let i = 0; i < lineIdx; i++) offset += lines[i].length + 1 // +1 for the \n
    const start = offset + Math.min(revealTarget.column, lines[lineIdx]?.length ?? 0)
    const end = start + revealTarget.length

    ta.focus()
    ta.setSelectionRange(start, end)

    // Scroll the matched line roughly to the middle
    const style = getComputedStyle(ta)
    let lineHeight = parseFloat(style.lineHeight)
    if (!Number.isFinite(lineHeight)) lineHeight = parseFloat(style.fontSize) * 1.6
    ta.scrollTop = Math.max(0, lineIdx * lineHeight - ta.clientHeight / 2)

    consumeReveal(filePath)
  }, [loading, text, revealTarget, filePath, consumeReveal])

  const scheduleSave = useCallback((value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await workspaceIpc.writeText(filePath, value)
        setDirty(false)
      } catch (err) {
        console.error('Save failed:', err)
      }
    }, 500)
  }, [filePath])

  const onChange = (value: string) => {
    setText(value)
    setDirty(true)
    scheduleSave(value)
  }

  const lineCount = text ? text.split('\n').length : 0
  const charCount = text?.length ?? 0

  const toolbar = (
    <span className="doc-shell-file-name">
      {name}{dirty && <span className="pt-dirty" title="未保存">●</span>}
    </span>
  )

  const statusLeft = (
    <span className="doc-status-stat">{lineCount} 行 · {charCount} 字符</span>
  )

  return (
    <DocumentEditorShell toolbar={toolbar} statusLeft={statusLeft}>
      <div className="doc-paper plaintext-paper">
        {loading ? (
          <div className="pt-loading">加载中…</div>
        ) : error ? (
          <div className="pt-error">{error}</div>
        ) : (
          <textarea
            ref={textareaRef}
            className="pt-textarea"
            value={text ?? ''}
            spellCheck={false}
            onChange={e => onChange(e.target.value)}
            placeholder="空文件，开始输入…"
          />
        )}
      </div>
    </DocumentEditorShell>
  )
}
