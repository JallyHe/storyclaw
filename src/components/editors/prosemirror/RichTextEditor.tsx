import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { setBlockType, toggleMark } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { baseKeymap } from 'prosemirror-commands'
import { markdownToRichTextDoc, richTextDocToMarkdown } from '@/editors/richtext/markdown'
import { htmlToRichTextDoc, richTextDocToHtml } from '@/editors/richtext/html'
import { richTextSchema } from '@/editors/richtext/schema'
import { createFindPlugin, findPluginKey, collectDocPositions, scrollFindMatchIntoView } from '@/editors/findPlugin'
import './prosemirror.css'

export interface RichTextHeading {
  level: number
  text: string
  index: number
}

/** Imperative handle — lets parent build its own toolbar */
export interface RichTextEditorHandle {
  setParagraph(): void
  setHeading(level: number): void
  setBullet(): void
  setAlign(align: 'left' | 'center' | 'right'): void
  toggleBold(): void
  toggleItalic(): void
  toggleUnderline(): void
  setTextStyle(patch: { color?: string | null; fontFamily?: string | null }): void
  scrollToHeading(index: number): void
  getDom(): HTMLElement | null
  // Find / replace
  findInEditor(query: string, opts: { caseSensitive: boolean }): number
  findNext(): void
  findPrev(): void
  replaceMatch(replacement: string): void
  replaceAllMatches(query: string, replacement: string, opts: { caseSensitive: boolean }): number
  clearHighlights(): void
}

interface Props {
  value: string
  onChange: (value: string) => void
  onHeadingsChange?: (headings: RichTextHeading[]) => void
  placeholder?: string
  compact?: boolean
  format?: 'markdown' | 'html'
}

const FONT_OPTIONS = [
  { label: '思源黑体', value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { label: '思源宋体', value: '"Source Han Serif SC", "Noto Serif SC", serif' },
  { label: '霞鹜文楷', value: '"LXGW WenKai", "KaiTi", serif' }
]

function extractHeadings(view: EditorView): RichTextHeading[] {
  const els = view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const items: RichTextHeading[] = []
  els.forEach((el, i) => {
    items.push({ level: parseInt(el.tagName[1]) || 1, text: el.textContent ?? '', index: i })
  })
  return items
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { value, onChange, onHeadingsChange, placeholder, compact, format = 'markdown' },
  ref
) {
  const mountRef       = useRef<HTMLDivElement>(null)
  const viewRef        = useRef<EditorView | null>(null)
  const latestValueRef = useRef(value)
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const findQueryRef = useRef('')
  const findOptsRef  = useRef<{ caseSensitive: boolean }>({ caseSensitive: false })

  useEffect(() => { latestValueRef.current = value }, [value])

  useEffect(() => {
    if (!mountRef.current) return
    const state = EditorState.create({
      doc: richTextSchema.nodeFromJSON(
        format === 'html' ? htmlToRichTextDoc(value) : markdownToRichTextDoc(value)
      ),
      plugins: [
        history(),
        createFindPlugin(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(baseKeymap)
      ]
    })
    const view = new EditorView(mountRef.current, {
      state,
      dispatchTransaction(tr) {
        const next = view.state.apply(tr)
        view.updateState(next)
        if (!tr.docChanged) return
        if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
        changeTimerRef.current = setTimeout(() => {
          const out = format === 'html'
            ? richTextDocToHtml(next.doc.toJSON())
            : richTextDocToMarkdown(next.doc.toJSON())
          latestValueRef.current = out
          onChange(out)
          if (onHeadingsChange) {
            requestAnimationFrame(() => {
              if (viewRef.current) onHeadingsChange(extractHeadings(viewRef.current))
            })
          }
        }, 350)
      },
      attributes: {
        class: compact ? 'rich-editor-mount compact' : 'rich-editor-mount',
        'data-placeholder': placeholder ?? ''
      }
    })
    viewRef.current = view
    if (onHeadingsChange) {
      requestAnimationFrame(() => {
        if (viewRef.current) onHeadingsChange(extractHeadings(viewRef.current))
      })
    }
    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
      view.destroy()
      viewRef.current = null
    }
  }, [compact, format, onChange, onHeadingsChange, placeholder])

  // Sync external `value` changes (e.g. the AI rewrote the file) into the live
  // editor. We skip when the incoming value matches what we last emitted, so the
  // user's own keystrokes never trigger a disruptive reset.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (value === latestValueRef.current) return
    const doc = richTextSchema.nodeFromJSON(
      format === 'html' ? htmlToRichTextDoc(value) : markdownToRichTextDoc(value)
    )
    const nextState = EditorState.create({ doc, plugins: view.state.plugins })
    view.updateState(nextState)
    latestValueRef.current = value
    if (onHeadingsChange) {
      requestAnimationFrame(() => {
        if (viewRef.current) onHeadingsChange(extractHeadings(viewRef.current))
      })
    }
  }, [value, format, onHeadingsChange])

  // Expose formatting commands to parent
  useImperativeHandle(ref, () => ({
    setParagraph() {
      run(setBlockType(richTextSchema.nodes.paragraph))
    },
    setHeading(level: number) {
      run(setBlockType(richTextSchema.nodes.heading, { level }))
    },
    setBullet() {
      run(setBlockType(richTextSchema.nodes.bullet_item))
    },
    setAlign(align: 'left' | 'center' | 'right') {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection
      let tr = view.state.tr
      view.state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isBlock || !('align' in node.attrs)) return
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, align })
      })
      if (tr.docChanged) view.dispatch(tr)
      view.focus()
    },
    toggleBold()      { run(toggleMark(richTextSchema.marks.strong)) },
    toggleItalic()    { run(toggleMark(richTextSchema.marks.em)) },
    toggleUnderline() { run(toggleMark(richTextSchema.marks.underline)) },
    setTextStyle(patch) {
      const view = viewRef.current
      if (!view) return
      const { from, to, empty } = view.state.selection
      const styleType = richTextSchema.marks.text_style
      let tr = view.state.tr.removeMark(from, to, styleType)
      const merged = { color: patch.color ?? null, fontFamily: patch.fontFamily ?? null }
      if (merged.color || merged.fontFamily) {
        const mark = styleType.create(merged)
        if (empty) tr = tr.addStoredMark(mark)
        else tr = tr.addMark(from, to, mark)
      }
      view.dispatch(tr)
      view.focus()
    },
    scrollToHeading(index: number) {
      const els = viewRef.current?.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')
      els?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    getDom() {
      return (viewRef.current?.dom as HTMLElement | undefined) ?? null
    },
    findInEditor(query, opts) {
      const view = viewRef.current
      findQueryRef.current = query
      findOptsRef.current = opts
      if (!view) return 0
      const matches = query ? collectDocPositions(view.state.doc, query, opts) : []
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches, current: 0 }))
      if (matches[0]) scrollFindMatchIntoView(view, matches[0])
      return matches.length
    },
    findNext() {
      const view = viewRef.current
      if (!view) return
      const s = findPluginKey.getState(view.state)
      if (!s || !s.matches.length) return
      const current = (s.current + 1) % s.matches.length
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: s.matches, current }))
      scrollFindMatchIntoView(view, s.matches[current])
    },
    findPrev() {
      const view = viewRef.current
      if (!view) return
      const s = findPluginKey.getState(view.state)
      if (!s || !s.matches.length) return
      const current = (s.current - 1 + s.matches.length) % s.matches.length
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: s.matches, current }))
      scrollFindMatchIntoView(view, s.matches[current])
    },
    replaceMatch(replacement) {
      const view = viewRef.current
      if (!view) return
      const s = findPluginKey.getState(view.state)
      if (!s || !s.matches.length) return
      const { from, to } = s.matches[s.current]
      const tr = replacement
        ? view.state.tr.replaceWith(from, to, view.state.schema.text(replacement))
        : view.state.tr.delete(from, to)
      tr.setMeta(findPluginKey, { matches: [], current: 0 })
      view.dispatch(tr)
      this.findInEditor(findQueryRef.current, findOptsRef.current)
    },
    replaceAllMatches(query, replacement, opts) {
      const view = viewRef.current
      if (!view || !query) return 0
      const positions = collectDocPositions(view.state.doc, query, opts)
      if (!positions.length) return 0
      const sorted = [...positions].sort((a, b) => b.from - a.from)
      let tr = view.state.tr
      for (const { from, to } of sorted) {
        tr = replacement
          ? tr.replaceWith(from, to, view.state.schema.text(replacement))
          : tr.delete(from, to)
      }
      tr.setMeta(findPluginKey, { matches: [], current: 0 })
      view.dispatch(tr)
      return positions.length
    },
    clearHighlights() {
      const view = viewRef.current
      if (!view) return
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: [], current: 0 }))
    }
  }), [])

  function run(cmd: (state: EditorState, dispatch?: EditorView['dispatch']) => boolean) {
    const view = viewRef.current
    if (!view) return
    cmd(view.state, view.dispatch)
    view.focus()
  }

  // No toolbar rendered here — parent is responsible
  return <div ref={mountRef} />
})

// ── Standalone toolbar component (reusable) ────────────────────────────────

export function RichTextToolbar({ editorRef }: { editorRef: React.RefObject<RichTextEditorHandle | null> }) {
  const e = () => editorRef.current
  return (
    <>
      <button className="pm-tool" onClick={() => e()?.setParagraph()}>正文</button>
      <button className="pm-tool" onClick={() => e()?.setHeading(1)}>H1</button>
      <button className="pm-tool" onClick={() => e()?.setHeading(2)}>H2</button>
      <button className="pm-tool" onClick={() => e()?.setHeading(3)}>H3</button>
      <button className="pm-tool" onClick={() => e()?.setBullet()}>列表</button>
      <span className="pm-tool-sep" />
      <button className="pm-tool" onClick={() => e()?.setAlign('left')}>左</button>
      <button className="pm-tool" onClick={() => e()?.setAlign('center')}>中</button>
      <button className="pm-tool" onClick={() => e()?.setAlign('right')}>右</button>
      <span className="pm-tool-sep" />
      <button className="pm-tool" style={{ fontWeight: 700 }} onClick={() => e()?.toggleBold()}>B</button>
      <button className="pm-tool" style={{ fontStyle: 'italic' }} onClick={() => e()?.toggleItalic()}>I</button>
      <button className="pm-tool" style={{ textDecoration: 'underline' }} onClick={() => e()?.toggleUnderline()}>U</button>
      <span className="pm-spacer" />
      <label className="pm-tool-input">
        字体
        <select defaultValue="" onChange={e2 => e()?.setTextStyle({ fontFamily: e2.target.value || null })}>
          <option value="">默认</option>
          {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="pm-tool-input color">
        颜色
        <input type="color" defaultValue="#20252f" onChange={e2 => e()?.setTextStyle({ color: e2.target.value })} />
      </label>
    </>
  )
}
