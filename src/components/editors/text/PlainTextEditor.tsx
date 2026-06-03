import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { FindHandlers } from '@/components/editors/FindBar'
import { workspaceIpc } from '@/ipc/workspace'
import { useEditorSaveStore, useTabsStore, useWorkspaceStore } from '@/store'
import { DocumentEditorShell } from '@/components/editors/DocumentEditorShell'
import './plaintext.css'

interface Props { filePath: string }

export function PlainTextEditor({ filePath }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textRef = useRef('')
  const savedTextRef = useRef('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const matchesRef = useRef<Array<{ start: number; end: number }>>([])
  const currentMatchRef = useRef(0)
  const name = filePath.split(/[\\/]/).pop() ?? filePath

  const revealTarget = useTabsStore(s => s.revealTarget)
  const consumeReveal = useTabsStore(s => s.consumeReveal)
  const markDirty = useWorkspaceStore(s => s.markDirty)
  const clearDirty = useWorkspaceStore(s => s.clearDirty)
  const autoSave = useEditorSaveStore(s => s.autoSave)
  const registerSaveHandler = useEditorSaveStore(s => s.registerHandler)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setDirty(false)
    workspaceIpc.readText(filePath)
      .then(t => {
        textRef.current = t
        savedTextRef.current = t
        setText(t)
        clearDirty(filePath)
        setLoading(false)
      })
      .catch(err => { setError(err?.message ?? '无法读取文件'); setLoading(false) })
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [clearDirty, filePath])

  const saveNow = useCallback(async (value = textRef.current) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await workspaceIpc.writeText(filePath, value)
    savedTextRef.current = value
    clearDirty(filePath)
    setDirty(false)
  }, [clearDirty, filePath])

  useEffect(() => {
    return registerSaveHandler(filePath, {
      save: () => saveNow(),
      discard: () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        textRef.current = savedTextRef.current
        setText(savedTextRef.current)
        setDirty(false)
        clearDirty(filePath)
      }
    })
  }, [clearDirty, filePath, registerSaveHandler, saveNow])

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
        await saveNow(value)
      } catch (err) {
        console.error('Save failed:', err)
      }
    }, 500)
  }, [saveNow])

  const onChange = (value: string) => {
    textRef.current = value
    setText(value)
    setDirty(true)
    markDirty(filePath)
    if (autoSave) scheduleSave(value)
  }

  const findHandlers = useMemo<FindHandlers>(() => ({
    find(query, opts) {
      matchesRef.current = []
      if (!query || text === null) return 0
      const haystack = opts.caseSensitive ? text : text.toLowerCase()
      const needle = opts.caseSensitive ? query : query.toLowerCase()
      let pos = 0
      while (true) {
        const idx = haystack.indexOf(needle, pos)
        if (idx === -1) break
        matchesRef.current.push({ start: idx, end: idx + needle.length })
        pos = idx + 1
      }
      currentMatchRef.current = 0
      if (matchesRef.current.length > 0) {
        const { start, end } = matchesRef.current[0]
        const ta = textareaRef.current
        if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollTextareaToMatch(ta, start) }
      }
      return matchesRef.current.length
    },
    next() {
      const m = matchesRef.current
      if (!m.length) return
      currentMatchRef.current = (currentMatchRef.current + 1) % m.length
      const { start, end } = m[currentMatchRef.current]
      const ta = textareaRef.current
      if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollTextareaToMatch(ta, start) }
    },
    prev() {
      const m = matchesRef.current
      if (!m.length) return
      currentMatchRef.current = (currentMatchRef.current - 1 + m.length) % m.length
      const { start, end } = m[currentMatchRef.current]
      const ta = textareaRef.current
      if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollTextareaToMatch(ta, start) }
    },
    replace(replacement) {
      const m = matchesRef.current
      if (!m.length || text === null) return
      const { start, end } = m[currentMatchRef.current]
      onChange(text.slice(0, start) + replacement + text.slice(end))
    },
    replaceAll(query, replacement, opts) {
      if (!query || text === null) return 0
      const flags = opts.caseSensitive ? 'g' : 'gi'
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, flags)
      const count = [...text.matchAll(re)].length
      if (count > 0) onChange(text.replace(re, replacement))
      return count
    },
    clear() {
      matchesRef.current = []
    }
  }), [text, onChange])

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
    <DocumentEditorShell toolbar={toolbar} statusLeft={statusLeft} findHandlers={findHandlers}>
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

function scrollTextareaToMatch(ta: HTMLTextAreaElement, offset: number) {
  const lines = ta.value.slice(0, offset).split('\n')
  const lineIdx = lines.length - 1
  const style = getComputedStyle(ta)
  let lh = parseFloat(style.lineHeight)
  if (!Number.isFinite(lh)) lh = parseFloat(style.fontSize) * 1.6
  ta.scrollTop = Math.max(0, lineIdx * lh - ta.clientHeight / 2)
}
