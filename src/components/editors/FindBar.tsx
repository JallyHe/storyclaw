import { useCallback, useEffect, useRef, useState } from 'react'

export interface FindOptions {
  caseSensitive: boolean
}

export interface FindHandlers {
  find(query: string, options: FindOptions): number | Promise<number>
  prev(): void
  next(): void
  replace?(replacement: string): void
  replaceAll?(query: string, replacement: string, options: FindOptions): number
  clear(): void
}

interface Props {
  handlers: FindHandlers
  allowReplace: boolean
  onClose: () => void
  openWithReplace?: boolean
}

export function FindBar({ handlers, allowReplace, onClose, openWithReplace }: Props) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [showReplace, setShowReplace] = useState(openWithReplace ?? false)
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(0)
  const queryRef = useRef<HTMLInputElement>(null)

  useEffect(() => { queryRef.current?.focus() }, [])
  useEffect(() => { return () => { handlers.clear() } }, [handlers])

  const runFind = useCallback(async (q: string, cs: boolean) => {
    if (!q) { setTotal(0); setCurrent(0); handlers.clear(); return }
    const result = handlers.find(q, { caseSensitive: cs })
    const count = result instanceof Promise ? await result : result
    setTotal(count)
    setCurrent(count > 0 ? 1 : 0)
  }, [handlers])

  useEffect(() => { void runFind(query, caseSensitive) }, [query, caseSensitive, runFind])

  const handlePrev = () => {
    if (!total) return
    handlers.prev()
    setCurrent(c => c <= 1 ? total : c - 1)
  }

  const handleNext = () => {
    if (!total) return
    handlers.next()
    setCurrent(c => c >= total ? 1 : c + 1)
  }

  const handleReplace = () => {
    if (!handlers.replace || !total) return
    handlers.replace(replacement)
    void runFind(query, caseSensitive)
  }

  const handleReplaceAll = () => {
    if (!handlers.replaceAll || !query) return
    const n = handlers.replaceAll(query, replacement, { caseSensitive })
    setTotal(0); setCurrent(0)
    handlers.clear()
    // eslint-disable-next-line no-alert
    alert(`已替换 ${n} 处`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNext() }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handlePrev() }
    if (e.key === 'F3' && !e.shiftKey) { e.preventDefault(); handleNext() }
    if (e.key === 'F3' && e.shiftKey) { e.preventDefault(); handlePrev() }
  }

  const noMatch = !!query && total === 0

  return (
    <div className="find-bar" onKeyDown={onKeyDown}>
      <div className="find-bar-row">
        <input
          ref={queryRef}
          className={`find-bar-input${noMatch ? ' no-match' : ''}`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="查找…"
        />
        <button
          className={`find-bar-btn find-bar-aa${caseSensitive ? ' active' : ''}`}
          title="区分大小写"
          onClick={() => setCaseSensitive(c => !c)}
        >Aa</button>
        <span className="find-bar-count">
          {total > 0 ? `${current} / ${total}` : (noMatch ? '无匹配' : '')}
        </span>
        <button className="find-bar-btn" title="上一个 (Shift+Enter)" onClick={handlePrev} disabled={!total}>‹</button>
        <button className="find-bar-btn" title="下一个 (Enter)" onClick={handleNext} disabled={!total}>›</button>
        {allowReplace && (
          <button className="find-bar-btn" title="展开替换" onClick={() => setShowReplace(v => !v)}>⇄</button>
        )}
        <button className="find-bar-btn find-bar-close" title="关闭 (Esc)" onClick={onClose}>✕</button>
      </div>
      {allowReplace && showReplace && (
        <div className="find-bar-row">
          <input
            className="find-bar-input"
            value={replacement}
            onChange={e => setReplacement(e.target.value)}
            placeholder="替换为…"
          />
          <button className="find-bar-btn" onClick={handleReplace} disabled={!total}>替换</button>
          <button className="find-bar-btn" onClick={handleReplaceAll} disabled={!query}>全部替换</button>
        </div>
      )}
    </div>
  )
}
