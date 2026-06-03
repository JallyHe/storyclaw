# Find/Replace 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有编辑器类型（大纲/MD、剧本/EP、TXT、DOCX、PDF）添加 Ctrl+F 查找；对可编辑类型（MD/EP/TXT）额外支持替换。

**Architecture:** FindBar 组件作为绝对定位浮层挂载在 `doc-shell-canvas` 内；DocumentEditorShell 通过 `findHandlers` prop 接收各编辑器的查找/替换回调；PDF/DOCX 的 FindBar 在 RefViewer 内部独立实现。

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, ProseMirror, pdfjs-dist, docx-preview

---

## 文件变更清单

| 文件 | 类型 |
|------|------|
| `src/components/editors/FindBar.tsx` | 新增 |
| `src/components/editors/prosemirror/prosemirror.css` | 修改（FindBar 样式 + 高亮样式） |
| `src/components/editors/DocumentEditorShell.tsx` | 修改 |
| `src/components/editors/text/PlainTextEditor.tsx` | 修改 |
| `src/components/editors/prosemirror/RichTextEditor.tsx` | 修改 |
| `src/components/editors/outline/OutlineEditor.tsx` | 修改 |
| `src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx` | 修改 |
| `src/components/editors/reference/RefViewer.tsx` | 修改 |
| `src/components/editors/reference/reference.css` | 修改 |
| `tests/find-bar.test.tsx` | 新增 |

---

## Task 1: FindHandlers 接口 + FindBar 组件 + CSS

**Files:**
- Create: `src/components/editors/FindBar.tsx`
- Modify: `src/components/editors/prosemirror/prosemirror.css`

- [ ] **Step 1: 新建 FindBar.tsx**

```tsx
// src/components/editors/FindBar.tsx
import { useEffect, useRef, useState } from 'react'

export interface FindOptions {
  caseSensitive: boolean
}

export interface FindHandlers {
  find(query: string, options: FindOptions): number
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

  useEffect(() => {
    if (!query) { setTotal(0); setCurrent(0); handlers.clear(); return }
    const count = handlers.find(query, { caseSensitive })
    setTotal(count)
    setCurrent(count > 0 ? 1 : 0)
  }, [query, caseSensitive, handlers])

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
    const count = handlers.find(query, { caseSensitive })
    setTotal(count)
    setCurrent(count > 0 ? 1 : 0)
  }

  const handleReplaceAll = () => {
    if (!handlers.replaceAll) return
    const n = handlers.replaceAll(query, replacement, { caseSensitive })
    setTotal(0); setCurrent(0)
    handlers.clear()
    alert(`已替换 ${n} 处`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter') { e.shiftKey ? handlePrev() : handleNext() }
    if (e.key === 'F3') { e.shiftKey ? handlePrev() : handleNext(); e.preventDefault() }
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
        <span className="find-bar-count">{total > 0 ? `${current} / ${total}` : (noMatch ? '无匹配' : '')}</span>
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
```

- [ ] **Step 2: 在 prosemirror.css 末尾追加 FindBar 样式 + 高亮样式**

追加到 `src/components/editors/prosemirror/prosemirror.css` 文件末尾：

```css
/* ── FindBar ─────────────────────────────────────────────── */
.find-bar {
  position: absolute; top: 8px; right: 8px; z-index: 200;
  display: flex; flex-direction: column; gap: 4px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.28);
  min-width: 320px;
}
.find-bar-row { display: flex; align-items: center; gap: 4px; }
.find-bar-input {
  flex: 1; height: 28px; padding: 0 8px; font-size: 12.5px;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-0); color: var(--text-0); outline: none;
}
.find-bar-input:focus { border-color: color-mix(in srgb, var(--accent) 70%, var(--border)); }
.find-bar-input.no-match { border-color: var(--diff-del-fg); }
.find-bar-count { font-size: 11px; color: var(--text-3); white-space: nowrap; min-width: 48px; text-align: center; }
.find-bar-btn {
  height: 28px; min-width: 28px; padding: 0 6px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg-2);
  color: var(--text-1); font-size: 12px; cursor: pointer;
  display: grid; place-items: center; transition: all .1s;
}
.find-bar-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.find-bar-btn:disabled { opacity: .4; cursor: not-allowed; }
.find-bar-btn.active { background: color-mix(in srgb,var(--accent) 18%,var(--bg-2)); border-color: color-mix(in srgb,var(--accent) 50%,var(--border)); color: var(--accent); }
.find-bar-close { font-size: 10px; }
.find-bar-aa { font-size: 11px; font-weight: 700; }

/* ── Find highlights (injected spans) ───────────────────── */
.find-highlight { background: color-mix(in srgb, #f0c040 55%, transparent); border-radius: 2px; }
.find-highlight-current { background: color-mix(in srgb, #f0a000 75%, transparent); border-radius: 2px; outline: 1.5px solid #f0a000; }
```

- [ ] **Step 3: 写基本 FindBar 单元测试**

创建 `tests/find-bar.test.tsx`：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FindBar } from '@/components/editors/FindBar'
import type { FindHandlers } from '@/components/editors/FindBar'

function makeHandlers(overrides?: Partial<FindHandlers>): FindHandlers {
  return {
    find: vi.fn().mockReturnValue(3),
    prev: vi.fn(),
    next: vi.fn(),
    replace: vi.fn(),
    replaceAll: vi.fn().mockReturnValue(2),
    clear: vi.fn(),
    ...overrides
  }
}

describe('FindBar', () => {
  it('calls find when query changes', async () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(h.find).toHaveBeenCalledWith('hello', { caseSensitive: false })
  })

  it('shows no-match class when 0 results', () => {
    const h = makeHandlers({ find: vi.fn().mockReturnValue(0) })
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.change(input, { target: { value: 'xyz' } })
    expect(input.classList.contains('no-match')).toBe(true)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<FindBar handlers={makeHandlers()} allowReplace={false} onClose={onClose} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls next on Enter', () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(h.next).toHaveBeenCalled()
  })

  it('calls prev on Shift+Enter', () => {
    const h = makeHandlers()
    render(<FindBar handlers={h} allowReplace={false} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('查找…')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(h.prev).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/find-bar.test.tsx
```

期望：5 个测试全通过

- [ ] **Step 5: Commit**

```bash
git add src/components/editors/FindBar.tsx src/components/editors/prosemirror/prosemirror.css tests/find-bar.test.tsx
git commit -m "feat: add FindBar component with find/replace UI and highlight styles"
```

---

## Task 2: DocumentEditorShell 集成 FindBar

**Files:**
- Modify: `src/components/editors/DocumentEditorShell.tsx`

- [ ] **Step 1: 修改 DocumentEditorShell.tsx**

在文件顶部 import 区添加：
```tsx
import { FindBar } from './FindBar'
import type { FindHandlers } from './FindBar'
```

在 `Props` interface 中新增：
```tsx
findHandlers?: FindHandlers
openWithReplace?: boolean
```

在函数签名中解构：
```tsx
export function DocumentEditorShell({ toolbar, outlineItems, statusLeft, children, findHandlers, openWithReplace }: Props) {
```

在已有 state 后添加：
```tsx
const [showFind, setShowFind] = useState(false)
```

在 `doc-shell-canvas` div 上添加 `keydown` 事件处理和 `position:relative` 样式，并在其内部渲染 FindBar。将原来：

```tsx
{/* Canvas / scroll area */}
<div className="doc-shell-canvas">
  <div
    className="doc-shell-canvas-inner"
    style={{ '--doc-zoom': zoom / 100 } as React.CSSProperties}
  >
    {children}
  </div>
</div>
```

替换为：

```tsx
{/* Canvas / scroll area */}
<div
  className="doc-shell-canvas"
  style={{ position: 'relative' }}
  onKeyDown={findHandlers ? (e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 'f') { e.preventDefault(); setShowFind(true) }
    if (ctrl && e.key === 'h') { e.preventDefault(); setShowFind(true) }
  } : undefined}
  tabIndex={findHandlers ? -1 : undefined}
>
  {findHandlers && showFind && (
    <FindBar
      handlers={findHandlers}
      allowReplace={!!(findHandlers.replace)}
      onClose={() => { findHandlers.clear(); setShowFind(false) }}
      openWithReplace={openWithReplace}
    />
  )}
  <div
    className="doc-shell-canvas-inner"
    style={{ '--doc-zoom': zoom / 100 } as React.CSSProperties}
  >
    {children}
  </div>
</div>
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

期望：无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/DocumentEditorShell.tsx
git commit -m "feat: integrate FindBar into DocumentEditorShell via findHandlers prop"
```

---

## Task 3: PlainTextEditor 查找/替换

**Files:**
- Modify: `src/components/editors/text/PlainTextEditor.tsx`

- [ ] **Step 1: 修改 PlainTextEditor.tsx**

在 `useRef` 导入后，新增以下实现。在 `textareaRef` 声明后添加：

```tsx
const matchesRef = useRef<Array<{ start: number; end: number }>>([])
const currentMatchRef = useRef(0)

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
      if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollToMatch(ta, start) }
    }
    return matchesRef.current.length
  },
  next() {
    const m = matchesRef.current
    if (!m.length) return
    currentMatchRef.current = (currentMatchRef.current + 1) % m.length
    const { start, end } = m[currentMatchRef.current]
    const ta = textareaRef.current
    if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollToMatch(ta, start) }
  },
  prev() {
    const m = matchesRef.current
    if (!m.length) return
    currentMatchRef.current = (currentMatchRef.current - 1 + m.length) % m.length
    const { start, end } = m[currentMatchRef.current]
    const ta = textareaRef.current
    if (ta) { ta.focus(); ta.setSelectionRange(start, end); scrollToMatch(ta, start) }
  },
  replace(replacement) {
    const m = matchesRef.current
    if (!m.length || text === null) return
    const { start, end } = m[currentMatchRef.current]
    const newText = text.slice(0, start) + replacement + text.slice(end)
    onChange(newText)
  },
  replaceAll(query, replacement, opts) {
    if (!query || text === null) return 0
    const flags = opts.caseSensitive ? 'g' : 'gi'
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, flags)
    const matches = [...text.matchAll(re)].length
    if (matches > 0) onChange(text.replace(re, replacement))
    return matches
  },
  clear() {
    matchesRef.current = []
  }
}), [text, onChange])
```

在 `PlainTextEditor` 函数内还需要：
1. 在文件顶部 import `useMemo` 和 `FindHandlers`：
   ```tsx
   import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
   import type { FindHandlers } from '@/components/editors/FindBar'
   ```
2. 在 `DocumentEditorShell` 的 props 中传入 `findHandlers={findHandlers}`

辅助函数（在组件外）：
```tsx
function scrollToMatch(ta: HTMLTextAreaElement, offset: number) {
  const lines = ta.value.slice(0, offset).split('\n')
  const lineIdx = lines.length - 1
  const style = getComputedStyle(ta)
  let lh = parseFloat(style.lineHeight)
  if (!Number.isFinite(lh)) lh = parseFloat(style.fontSize) * 1.6
  ta.scrollTop = Math.max(0, lineIdx * lh - ta.clientHeight / 2)
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/text/PlainTextEditor.tsx
git commit -m "feat: add find/replace support to PlainTextEditor"
```

---

## Task 4: RichTextEditor find 方法（供 OutlineEditor 使用）

**Files:**
- Modify: `src/components/editors/prosemirror/RichTextEditor.tsx`

- [ ] **Step 1: 扩展 RichTextEditorHandle 并实现 find 方法**

在 `RichTextEditorHandle` interface 中新增：
```tsx
findInEditor(query: string, opts: { caseSensitive: boolean }): number
findNext(): void
findPrev(): void
replaceMatch(replacement: string): void
replaceAllMatches(query: string, replacement: string, opts: { caseSensitive: boolean }): number
clearHighlights(): void
```

在 `useImperativeHandle` 的 return 对象中实现（在 `RichTextEditor` 组件内，`viewRef` 可访问）。

先在组件函数内添加内部 state refs（在 `viewRef` 声明旁）：
```tsx
const findMatchesRef = useRef<Array<{ node: Text; start: number; end: number; span?: HTMLSpanElement }>>([])
const findCurrentRef = useRef(0)
const lastFindQueryRef = useRef('')
const lastFindOptsRef = useRef<{ caseSensitive: boolean }>({ caseSensitive: false })
```

在 `useImperativeHandle` 的返回对象中追加：
```tsx
findInEditor(query, opts) {
  const view = viewRef.current
  if (!view) return 0
  clearFindSpans(findMatchesRef.current)
  findMatchesRef.current = []
  findCurrentRef.current = 0
  lastFindQueryRef.current = query
  lastFindOptsRef.current = opts
  if (!query) return 0
  const matches = collectTextMatches(view.dom as HTMLElement, query, opts)
  findMatchesRef.current = matches.map(m => ({ ...m }))
  matches.forEach((m, i) => {
    const span = wrapMatchWithSpan(m, i === 0 ? 'find-highlight-current' : 'find-highlight')
    if (span) findMatchesRef.current[i].span = span
  })
  if (matches.length > 0) scrollMatchIntoView(findMatchesRef.current[0].span)
  return matches.length
},
findNext() {
  const m = findMatchesRef.current
  if (!m.length) return
  m[findCurrentRef.current].span?.classList.replace('find-highlight-current', 'find-highlight')
  findCurrentRef.current = (findCurrentRef.current + 1) % m.length
  m[findCurrentRef.current].span?.classList.replace('find-highlight', 'find-highlight-current')
  scrollMatchIntoView(m[findCurrentRef.current].span)
},
findPrev() {
  const m = findMatchesRef.current
  if (!m.length) return
  m[findCurrentRef.current].span?.classList.replace('find-highlight-current', 'find-highlight')
  findCurrentRef.current = (findCurrentRef.current - 1 + m.length) % m.length
  m[findCurrentRef.current].span?.classList.replace('find-highlight', 'find-highlight-current')
  scrollMatchIntoView(m[findCurrentRef.current].span)
},
replaceMatch(replacement) {
  const view = viewRef.current
  const m = findMatchesRef.current
  if (!view || !m.length) return
  const cur = m[findCurrentRef.current]
  // Find ProseMirror position for this text node
  const pos = getProseMirrorPos(view, cur.span ?? cur.node as unknown as Node, cur.start, cur.end)
  if (pos === null) return
  clearFindSpans(findMatchesRef.current)
  findMatchesRef.current = []
  const tr = view.state.tr.replaceWith(pos.from, pos.to,
    view.state.schema.text(replacement))
  view.dispatch(tr)
  // Re-run find after replacement
  const count = this.findInEditor(lastFindQueryRef.current, lastFindOptsRef.current)
  return count
},
replaceAllMatches(query, replacement, opts) {
  const view = viewRef.current
  if (!view || !query) return 0
  clearFindSpans(findMatchesRef.current)
  findMatchesRef.current = []
  // Collect positions from scratch (no spans yet)
  const matches = collectTextMatches(view.dom as HTMLElement, query, opts)
  if (!matches.length) return 0
  // Build one transaction replacing all from end to start (to keep positions valid)
  const positions = matches.map(m => getProseMirrorPos(view, m.node, m.start, m.end)).filter(Boolean) as Array<{from:number;to:number}>
  positions.reverse()
  let tr = view.state.tr
  for (const { from, to } of positions) {
    tr = tr.replaceWith(from, to, view.state.schema.text(replacement))
  }
  view.dispatch(tr)
  return matches.length
},
clearHighlights() {
  clearFindSpans(findMatchesRef.current)
  findMatchesRef.current = []
}
```

在文件末尾（组件外）添加辅助函数：

```tsx
interface TextMatch { node: Text; start: number; end: number }

function collectTextMatches(container: HTMLElement, query: string, opts: { caseSensitive: boolean }): TextMatch[] {
  const results: TextMatch[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? ''
    const haystack = opts.caseSensitive ? text : text.toLowerCase()
    const needle = opts.caseSensitive ? query : query.toLowerCase()
    let pos = 0
    while (true) {
      const idx = haystack.indexOf(needle, pos)
      if (idx === -1) break
      results.push({ node: node as Text, start: idx, end: idx + needle.length })
      pos = idx + 1
    }
  }
  return results
}

function wrapMatchWithSpan(match: TextMatch, className: string): HTMLSpanElement | undefined {
  try {
    const { node, start, end } = match
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    const span = document.createElement('span')
    span.className = className
    range.surroundContents(span)
    return span
  } catch { return undefined }
}

function clearFindSpans(matches: Array<{ span?: HTMLSpanElement }>) {
  for (const m of matches) {
    if (!m.span || !m.span.parentNode) continue
    const parent = m.span.parentNode
    while (m.span.firstChild) parent.insertBefore(m.span.firstChild, m.span)
    parent.removeChild(m.span)
    if (parent instanceof Text) {} else (parent as Element).normalize()
  }
}

function scrollMatchIntoView(el: HTMLSpanElement | undefined) {
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function getProseMirrorPos(
  view: import('prosemirror-view').EditorView,
  node: Node,
  start: number,
  end: number
): { from: number; to: number } | null {
  try {
    const domPos = view.posAtDOM(node, start)
    return { from: domPos, to: domPos + (end - start) }
  } catch { return null }
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/prosemirror/RichTextEditor.tsx
git commit -m "feat: add find/replace methods to RichTextEditorHandle"
```

---

## Task 5: OutlineEditor 集成 FindHandlers

**Files:**
- Modify: `src/components/editors/outline/OutlineEditor.tsx`

- [ ] **Step 1: 修改 OutlineEditor.tsx**

在 import 区添加：
```tsx
import type { FindHandlers } from '@/components/editors/FindBar'
import { useMemo } from 'react'
```

在 `OutlineEditor` 函数内，`editorRef` 声明后添加：

```tsx
const findHandlers = useMemo<FindHandlers>(() => ({
  find(query, opts) {
    return editorRef.current?.findInEditor(query, opts) ?? 0
  },
  next() { editorRef.current?.findNext() },
  prev() { editorRef.current?.findPrev() },
  replace(replacement) { editorRef.current?.replaceMatch(replacement) },
  replaceAll(query, replacement, opts) {
    return editorRef.current?.replaceAllMatches(query, replacement, opts) ?? 0
  },
  clear() { editorRef.current?.clearHighlights() }
}), [])
```

在 `DocumentEditorShell` 上传入 prop：
```tsx
<DocumentEditorShell
  toolbar={toolbar}
  outlineItems={outlineItems.length > 0 ? outlineItems : undefined}
  findHandlers={findHandlers}
>
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/outline/OutlineEditor.tsx
git commit -m "feat: wire FindHandlers into OutlineEditor"
```

---

## Task 6: ScreenplayProseMirrorEditor 集成 FindHandlers

**Files:**
- Modify: `src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx`

- [ ] **Step 1: 修改 ScreenplayProseMirrorEditor.tsx**

在 import 区添加：
```tsx
import type { FindHandlers } from '@/components/editors/FindBar'
import { collectTextMatches, wrapMatchWithSpan, clearFindSpans, scrollMatchIntoView, getProseMirrorPos } from './RichTextEditor'
```

**注意：** 需要将 Task 4 中在 `RichTextEditor.tsx` 底部定义的辅助函数 `collectTextMatches`、`wrapMatchWithSpan`、`clearFindSpans`、`scrollMatchIntoView`、`getProseMirrorPos` 改为 **export**（在各函数前加 `export`）。

在 `ScreenplayProseMirrorEditor` 函数内，在已有 refs 声明后添加：

```tsx
const findMatchesRef = useRef<Array<{ node: Text; start: number; end: number; span?: HTMLSpanElement }>>([])
const findCurrentRef = useRef(0)
const lastFindQueryRef = useRef('')
const lastFindOptsRef = useRef<{ caseSensitive: boolean }>({ caseSensitive: false })

const findHandlers = useMemo<FindHandlers>(() => ({
  find(query, opts) {
    const view = viewRef.current
    if (!view) return 0
    clearFindSpans(findMatchesRef.current)
    findMatchesRef.current = []
    findCurrentRef.current = 0
    lastFindQueryRef.current = query
    lastFindOptsRef.current = opts
    if (!query) return 0
    const matches = collectTextMatches(view.dom as HTMLElement, query, opts)
    findMatchesRef.current = matches.map(m => ({ ...m }))
    matches.forEach((m, i) => {
      const span = wrapMatchWithSpan(m, i === 0 ? 'find-highlight-current' : 'find-highlight')
      if (span) findMatchesRef.current[i].span = span
    })
    if (matches.length > 0) scrollMatchIntoView(findMatchesRef.current[0].span)
    return matches.length
  },
  next() {
    const m = findMatchesRef.current
    if (!m.length) return
    m[findCurrentRef.current].span?.classList.replace('find-highlight-current', 'find-highlight')
    findCurrentRef.current = (findCurrentRef.current + 1) % m.length
    m[findCurrentRef.current].span?.classList.replace('find-highlight', 'find-highlight-current')
    scrollMatchIntoView(m[findCurrentRef.current].span)
  },
  prev() {
    const m = findMatchesRef.current
    if (!m.length) return
    m[findCurrentRef.current].span?.classList.replace('find-highlight-current', 'find-highlight')
    findCurrentRef.current = (findCurrentRef.current - 1 + m.length) % m.length
    m[findCurrentRef.current].span?.classList.replace('find-highlight', 'find-highlight-current')
    scrollMatchIntoView(m[findCurrentRef.current].span)
  },
  replace(replacement) {
    const view = viewRef.current
    const m = findMatchesRef.current
    if (!view || !m.length) return
    const cur = m[findCurrentRef.current]
    const pos = getProseMirrorPos(view, cur.span ?? cur.node as unknown as Node, cur.start, cur.end)
    if (!pos) return
    clearFindSpans(findMatchesRef.current)
    findMatchesRef.current = []
    const tr = view.state.tr.replaceWith(pos.from, pos.to, view.state.schema.text(replacement))
    view.dispatch(tr)
  },
  replaceAll(query, replacement, opts) {
    const view = viewRef.current
    if (!view || !query) return 0
    clearFindSpans(findMatchesRef.current)
    findMatchesRef.current = []
    const matches = collectTextMatches(view.dom as HTMLElement, query, opts)
    if (!matches.length) return 0
    const positions = matches
      .map(m => getProseMirrorPos(view, m.node, m.start, m.end))
      .filter(Boolean) as Array<{ from: number; to: number }>
    positions.reverse()
    let tr = view.state.tr
    for (const { from, to } of positions) {
      tr = tr.replaceWith(from, to, view.state.schema.text(replacement))
    }
    view.dispatch(tr)
    return matches.length
  },
  clear() {
    clearFindSpans(findMatchesRef.current)
    findMatchesRef.current = []
  }
}), [])
```

在 `DocumentEditorShell` 传入：
```tsx
<DocumentEditorShell
  ...existing props...
  findHandlers={readonly ? undefined : findHandlers}
>
```

注：`readonly` 为 true 时（diff 预览模式）不显示查找栏。

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/prosemirror/RichTextEditor.tsx src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx
git commit -m "feat: wire FindHandlers into ScreenplayProseMirrorEditor"
```

---

## Task 7: RefViewer — PDF 查找

**Files:**
- Modify: `src/components/editors/reference/RefViewer.tsx`
- Modify: `src/components/editors/reference/reference.css`

- [ ] **Step 1: 在 RefViewer.tsx 中添加 PDF 内部 FindBar**

在 `RefViewer` import 区添加：
```tsx
import { FindBar } from '@/components/editors/FindBar'
import type { FindHandlers } from '@/components/editors/FindBar'
```

修改 `PdfPreview` 组件（在 `PdfPreview` 函数签名之后），新增 find 相关 state 和 handlers：

在 `PdfPreview` 内现有 state 声明后添加：
```tsx
const [showFind, setShowFind] = useState(false)
const pdfMatchPagesRef = useRef<number[]>([])
const pdfFindCurrentRef = useRef(0)

const pdfFindHandlers = useMemo<FindHandlers>(() => ({
  async find(query, opts) {
    pdfMatchPagesRef.current = []
    pdfFindCurrentRef.current = 0
    if (!pdfDoc || !query) return 0
    const needle = opts.caseSensitive ? query : query.toLowerCase()
    const pageCount = pdfDoc.numPages
    const matches: number[] = []
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item: any) => item.str ?? '').join('')
      const haystack = opts.caseSensitive ? pageText : pageText.toLowerCase()
      if (haystack.includes(needle)) matches.push(i)
    }
    pdfMatchPagesRef.current = matches
    if (matches.length > 0) goToPage(matches[0])
    return matches.length
  },
  next() {
    const m = pdfMatchPagesRef.current
    if (!m.length) return
    pdfFindCurrentRef.current = (pdfFindCurrentRef.current + 1) % m.length
    goToPage(m[pdfFindCurrentRef.current])
  },
  prev() {
    const m = pdfMatchPagesRef.current
    if (!m.length) return
    pdfFindCurrentRef.current = (pdfFindCurrentRef.current - 1 + m.length) % m.length
    goToPage(m[pdfFindCurrentRef.current])
  },
  clear() {
    pdfMatchPagesRef.current = []
    pdfFindCurrentRef.current = 0
  }
}), [pdfDoc, goToPage])
```

注意：需要在 `PdfPreview` 添加 `useMemo, useRef` 到 import，并且 `pdfFindHandlers.find` 是 async，但 `FindHandlers.find` 返回 `number`。需将 `find` 签名改为 `find(query, opts): number | Promise<number>`，或者用非 async 版本（收集同步结果）。

**实际做法**：将 `FindHandlers.find` 改为 `find(query: string, options: FindOptions): number | Promise<number>`，并在 `FindBar` 组件中处理 Promise：

```tsx
// FindBar.tsx - handleFind 改为 async
const handleFind = useCallback(async (q: string, cs: boolean) => {
  if (!q) { setTotal(0); setCurrent(0); handlers.clear(); return }
  const result = handlers.find(q, { caseSensitive: cs })
  const count = result instanceof Promise ? await result : result
  setTotal(count)
  setCurrent(count > 0 ? 1 : 0)
}, [handlers])
```

对应在 `useEffect` 中调用 `void handleFind(query, caseSensitive)`。

在 `PdfPreview` JSX 中，在 `.ref-pdf` div 的顶层渲染：
```tsx
<div className="ref-pdf" style={{ position: 'relative' }}>
  {showFind && (
    <FindBar
      handlers={pdfFindHandlers}
      allowReplace={false}
      onClose={() => setShowFind(false)}
    />
  )}
  <div className="ref-header">
    ...existing header content...
    <button
      className="ref-find-btn"
      title="查找 (Ctrl+F)"
      onClick={() => setShowFind(v => !v)}
    >🔍</button>
  </div>
  ...
</div>
```

并在 `PdfPreview` 的根 div 上监听 `keydown`：
```tsx
onKeyDown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowFind(true) }
}}
tabIndex={-1}
```

- [ ] **Step 2: 在 reference.css 中添加 ref-find-btn 样式**

追加到 `reference.css` 末尾：
```css
.ref-find-btn {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-0);
  color: var(--text-1);
  cursor: pointer;
}
.ref-find-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
```

- [ ] **Step 3: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editors/reference/RefViewer.tsx src/components/editors/reference/reference.css
git commit -m "feat: add Ctrl+F PDF search to RefViewer"
```

---

## Task 8: RefViewer — DOCX 查找

**Files:**
- Modify: `src/components/editors/reference/RefViewer.tsx`

- [ ] **Step 1: 修改 RefViewer.tsx 中的 DOCX 渲染部分**

在 `RefViewer` 组件内，在 `docxRef` 声明后添加：

```tsx
const [showDocxFind, setShowDocxFind] = useState(false)
const docxMatchesRef = useRef<HTMLSpanElement[]>([])
const docxCurrentRef = useRef(0)

const docxFindHandlers = useMemo<FindHandlers>(() => ({
  find(query, opts) {
    // Clear previous
    for (const span of docxMatchesRef.current) {
      if (!span.parentNode) continue
      const parent = span.parentNode
      while (span.firstChild) parent.insertBefore(span.firstChild, span)
      parent.removeChild(span)
      ;(parent as Element).normalize?.()
    }
    docxMatchesRef.current = []
    docxCurrentRef.current = 0
    if (!query || !docxRef.current) return 0
    const walker = document.createTreeWalker(docxRef.current, NodeFilter.SHOW_TEXT)
    const needle = opts.caseSensitive ? query : query.toLowerCase()
    const spans: HTMLSpanElement[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.nodeValue ?? ''
      const haystack = opts.caseSensitive ? text : text.toLowerCase()
      let pos = 0
      while (true) {
        const idx = haystack.indexOf(needle, pos)
        if (idx === -1) break
        try {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + needle.length)
          const span = document.createElement('span')
          span.className = spans.length === 0 ? 'find-highlight-current' : 'find-highlight'
          range.surroundContents(span)
          spans.push(span)
        } catch { /* skip */ }
        pos = idx + 1
      }
    }
    docxMatchesRef.current = spans
    if (spans.length > 0) spans[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
    return spans.length
  },
  next() {
    const m = docxMatchesRef.current
    if (!m.length) return
    m[docxCurrentRef.current].className = 'find-highlight'
    docxCurrentRef.current = (docxCurrentRef.current + 1) % m.length
    m[docxCurrentRef.current].className = 'find-highlight-current'
    m[docxCurrentRef.current].scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
  prev() {
    const m = docxMatchesRef.current
    if (!m.length) return
    m[docxCurrentRef.current].className = 'find-highlight'
    docxCurrentRef.current = (docxCurrentRef.current - 1 + m.length) % m.length
    m[docxCurrentRef.current].className = 'find-highlight-current'
    m[docxCurrentRef.current].scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
  clear() {
    for (const span of docxMatchesRef.current) {
      if (!span.parentNode) continue
      const parent = span.parentNode
      while (span.firstChild) parent.insertBefore(span.firstChild, span)
      parent.removeChild(span)
      ;(parent as Element).normalize?.()
    }
    docxMatchesRef.current = []
    docxCurrentRef.current = 0
  }
}), [])
```

将 DOCX 模式的 JSX 修改为：
```tsx
if (mode === 'docx') {
  return (
    <div className="ref-viewer" style={{ position: 'relative' }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowDocxFind(true) }
      }}
      tabIndex={-1}
    >
      {showDocxFind && (
        <FindBar
          handlers={docxFindHandlers}
          allowReplace={false}
          onClose={() => { docxFindHandlers.clear(); setShowDocxFind(false) }}
        />
      )}
      <div className="ref-header">
        <span className="ref-filename">{fileName}</span>
        <span className="ref-badge">DOCX</span>
        <button className="ref-find-btn" onClick={() => setShowDocxFind(v => !v)}>🔍</button>
      </div>
      <div className="ref-docx" key={docxKey}>
        <div ref={docxStyleRef} />
        <div ref={docxRef} className="docx-preview-content" />
        {docxFallbackText && <pre className="ref-docx-fallback">{docxFallbackText}</pre>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 运行全部测试**

```bash
npx vitest run
```

期望：所有测试通过

- [ ] **Step 4: Commit**

```bash
git add src/components/editors/reference/RefViewer.tsx
git commit -m "feat: add Ctrl+F DOCX DOM search to RefViewer"
```

---

## 自检清单

- [x] **Spec coverage**: 所有 8 个编辑器类型均有对应 Task
- [x] **Replace 仅限 MD/EP/TXT**: `allowReplace` 由 `findHandlers.replace` 是否存在控制
- [x] **快捷键**: Ctrl+F、Ctrl+H、Enter/Shift+Enter、F3/Shift+F3、Esc 均在 FindBar 和 Shell 中处理
- [x] **边界情况**: 空查询、无匹配、文件切换（`useMemo` 依赖、`clear` 在 useEffect cleanup）
- [x] **类型一致性**: `FindHandlers`、`FindOptions`、helper 函数从 Task 1 开始定义，后续 Tasks 直接 import
- [x] **PDF find 是异步的**: `FindHandlers.find` 返回 `number | Promise<number>`，FindBar 用 async/await 处理
