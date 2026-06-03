import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorState, Selection, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import type { DiffBlock, EpFile } from '@/types'
import { DocumentEditorShell, type DocOutlineItem } from '@/components/editors/DocumentEditorShell'
import { Ic } from '@/components/icons'
import { epFileToScreenplayDoc, screenplayDocToEpFile } from '@/editors/screenplay/convert'
import { createScreenplayPlugins, setCurrentLineType } from '@/editors/screenplay/plugins'
import { SCREENPLAY_LINE_ORDER } from '@/editors/screenplay/controls'
import { addEpisodeToFile } from '@/editors/screenplay/episodeCollection'
import { episodeLabel } from '@/editors/screenplay/episodeMeta'
import { screenplaySchema, SCREENPLAY_LABELS, type ScreenplayLineType } from '@/editors/screenplay/schema'
import { DiffBar } from '@/components/editors/episode/DiffBar'
import { useCopilotDraftStore, useEditorSaveStore, useEditorViewCacheStore, useTabsStore, useUiStore, useWorkspaceStore } from '@/store'
import { revealMatchInElement } from '@/editors/revealMatch'
import { workspaceRelativePath } from '@/components/copilot/currentDocumentContext'
import type { SelectionReference } from '@/components/copilot/selectionReference'
import { createFindPlugin, findPluginKey, collectDocPositions, scrollFindMatchIntoView } from '@/editors/findPlugin'
import type { FindHandlers } from '@/components/editors/FindBar'
import './prosemirror.css'

interface Props {
  filePath: string
  fileVersion: number
  file: EpFile
  diffBlocks?: DiffBlock[]
  onSave: (file: EpFile, options?: { updateLocalState?: boolean }) => Promise<void>
  onAccept: () => void
  onReject: () => void
  onAcceptAll?: () => void
}

const LINE_TYPES: ScreenplayLineType[] = SCREENPLAY_LINE_ORDER
const PAGE_HEIGHT = 1160
type ScreenplaySlashOption =
  | { kind: 'addEpisode'; key: 'addEpisode'; label: string }
  | { kind: 'lineType'; key: ScreenplayLineType; label: string; icon: typeof Ic.spark }
const LINE_TYPE_ICONS = {
  scene:      Ic.scenes,
  action:     Ic.feather,
  dialogue:   Ic.dialogue,
  transition: Ic.chevRight
} satisfies Record<(typeof LINE_TYPES)[number], typeof Ic.spark>

/** Derive the initial toolbar type from the file's first block,
 *  so we never show a wrong type before ProseMirror initialises. */
function firstBlockLineType(file: EpFile): ScreenplayLineType {
  const b = file.blocks[0]
  if (!b) return 'action'
  const map: Partial<Record<string, ScreenplayLineType>> = {
    scene: 'scene', action: 'action',
    dialogue: 'dialogue', paren: 'dialogue', transition: 'transition'
  }
  return map[b.type] ?? 'action'
}

// Extract scene headings from ProseMirror state for the outline panel
function extractScenes(state: EditorState, view: EditorView): DocOutlineItem[] {
  const items: DocOutlineItem[] = []
  let sceneIndex = 0
  let episodeIndex = 0
  let currentEpisodeKey: string | undefined
  state.doc.forEach((node, offset) => {
    if (node.type.name === 'episode_heading') {
      const idx = episodeIndex++
      currentEpisodeKey = `episode-${offset}`
      items.push({
        key: currentEpisodeKey,
        label: `${episodeLabel(node.attrs.episode, idx + 1)} ${node.textContent || '未命名'}`,
        indent: 0,
        collapsible: true,
        onClick: () => {
          const dom = view.nodeDOM(offset) as HTMLElement | null
          dom?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
      return
    }
    if (node.type.name === 'scene_heading') {
      const idx = sceneIndex++
      items.push({
        key: `scene-${offset}`,
        label: node.textContent || `（第 ${idx + 1} 场）`,
        indent: currentEpisodeKey ? 1 : 0,
        parentKey: currentEpisodeKey,
        onClick: () => {
          const dom = view.nodeDOM(offset) as HTMLElement | null
          dom?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  })
  return items
}

export function ScreenplayProseMirrorEditor({ filePath, fileVersion, file, diffBlocks, onSave, onAccept, onReject, onAcceptAll }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const viewRef    = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const findQueryRef = useRef('')
  const findOptsRef  = useRef<{ caseSensitive: boolean }>({ caseSensitive: false })
  const latestRef = useRef({ file, onSave })
  const draftFileRef = useRef(file)
  const autoSaveRef = useRef(false)
  const [editorRevision, setEditorRevision] = useState(0)

  const episodes = file.episodes && file.episodes.length > 1 ? file.episodes : null
  const [pageCount,  setPageCount]  = useState(1)
  const [wordCount,  setWordCount]  = useState(0)
  const [lineType,   setLineType]   = useState<ScreenplayLineType>(() => useEditorViewCacheStore.getState().getScreenplayState(filePath)?.lineType ?? firstBlockLineType(file))
  const [slashMenu,  setSlashMenu]  = useState<{ query: string; top: number; left: number } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [sceneItems, setSceneItems] = useState<DocOutlineItem[]>([])
  const [selectionMenu, setSelectionMenu] = useState<{ top: number; left: number; ref: SelectionReference } | null>(null)
  const [diffReview, setDiffReview] = useState<{ top: number; left: number } | null>(null)
  const [inlinePromptOpen, setInlinePromptOpen] = useState(false)
  const [inlinePrompt, setInlinePrompt] = useState('')
  const slashMenuRef = useRef<typeof slashMenu>(null)
  const slashIndexRef = useRef(0)

  const revealTarget = useTabsStore(s => s.revealTarget)
  const consumeReveal = useTabsStore(s => s.consumeReveal)
  const workspaceRoot = useWorkspaceStore(s => s.root)
  const markDirty = useWorkspaceStore(s => s.markDirty)
  const autoSave = useEditorSaveStore(s => s.autoSave)
  const registerSaveHandler = useEditorSaveStore(s => s.registerHandler)
  const queueSelection = useCopilotDraftStore(s => s.queueSelection)
  const setRightOpen = useUiStore(s => s.setRightOpen)

  const readonly = !!diffBlocks
  autoSaveRef.current = autoSave

  useEffect(() => {
    draftFileRef.current = file
  }, [file, fileVersion])

  // Reveal a search match (best-effort DOM text search)
  useEffect(() => {
    if (!revealTarget || revealTarget.path !== filePath) return
    const timer = setTimeout(() => {
      revealMatchInElement(viewRef.current?.dom as HTMLElement | undefined, revealTarget.matchText)
      consumeReveal(filePath)
    }, 120)
    return () => clearTimeout(timer)
  }, [revealTarget, filePath, consumeReveal])

  // Must be declared before any hook that references it
  const displayedFile = useMemo<EpFile>(() => {
    if (!diffBlocks) return file
    return { ...file, episodes: undefined, blocks: diffBlocks.map(item => item.blk) }
  }, [diffBlocks, file])

  latestRef.current = { file, onSave }
  slashMenuRef.current = slashMenu
  slashIndexRef.current = slashIndex
  const findHandlers = useMemo<FindHandlers>(() => ({
    find(query, opts) {
      const view = viewRef.current
      findQueryRef.current = query
      findOptsRef.current = opts
      if (!view) return 0
      const matches = query ? collectDocPositions(view.state.doc, query, opts) : []
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches, current: 0 }))
      if (matches[0]) scrollFindMatchIntoView(view, matches[0])
      return matches.length
    },
    next() {
      const view = viewRef.current
      if (!view) return
      const s = findPluginKey.getState(view.state)
      if (!s || !s.matches.length) return
      const current = (s.current + 1) % s.matches.length
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: s.matches, current }))
      scrollFindMatchIntoView(view, s.matches[current])
    },
    prev() {
      const view = viewRef.current
      if (!view) return
      const s = findPluginKey.getState(view.state)
      if (!s || !s.matches.length) return
      const current = (s.current - 1 + s.matches.length) % s.matches.length
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: s.matches, current }))
      scrollFindMatchIntoView(view, s.matches[current])
    },
    replace(replacement) {
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
      this.find(findQueryRef.current, findOptsRef.current)
    },
    replaceAll(query, replacement, opts) {
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
    clear() {
      const view = viewRef.current
      if (!view) return
      view.dispatch(view.state.tr.setMeta(findPluginKey, { matches: [], current: 0 }))
    }
  }), [])

  const slashOptions = useMemo(() => slashMenu ? screenplaySlashOptions(slashMenu.query) : [], [slashMenu])

  useEffect(() => {
    setSlashIndex(0)
  }, [slashMenu?.query])

  useEffect(() => {
    if (slashIndex >= slashOptions.length) setSlashIndex(Math.max(0, slashOptions.length - 1))
  }, [slashIndex, slashOptions.length])

  // Sync lineType BEFORE the browser paints when the file changes.
  // useLayoutEffect fires synchronously after DOM mutations and before paint,
  // so the toolbar never shows the old/default type for even one frame.
  useLayoutEffect(() => {
    setLineType(useEditorViewCacheStore.getState().getScreenplayState(filePath)?.lineType ?? firstBlockLineType(displayedFile))
  }, [displayedFile, filePath])

  useEffect(() => {
    if (readonly) return
    return registerSaveHandler(filePath, {
      save: async () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        await latestRef.current.onSave(snapshotFile())
      },
      discard: () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        draftFileRef.current = file
        setEditorRevision(revision => revision + 1)
      }
    })
  }, [filePath, readonly, registerSaveHandler])

  useEffect(() => {
    if (!mountRef.current) return
    const doc   = screenplaySchema.nodeFromJSON(epFileToScreenplayDoc(displayedFile, { includeEpisodeHeadings: true }))
    let state = EditorState.create({
      doc,
      plugins: readonly ? [] : [...createScreenplayPlugins(), createFindPlugin()]
    })
    const cachedState = useEditorViewCacheStore.getState().getScreenplayState(filePath)
    if (cachedState) {
      const maxPos = state.doc.content.size
      const from = Math.max(1, Math.min(cachedState.selectionFrom, maxPos))
      const to = Math.max(1, Math.min(cachedState.selectionTo, maxPos))
      try {
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
      } catch {
        state = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(from))))
      }
    }
    const view = new EditorView(mountRef.current, {
      state,
      editable: () => !readonly,
      handleKeyDown(_view, event) {
        if (!slashMenuRef.current) return false
        const options = screenplaySlashOptions(slashMenuRef.current.query)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (options.length === 0) return true
          const delta = event.key === 'ArrowDown' ? 1 : -1
          setSlashIndex(index => (index + delta + options.length) % options.length)
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setSlashMenu(null)
          setSlashIndex(0)
          return true
        }
        if (event.key === 'Enter') {
          const option = options[Math.min(slashIndexRef.current, options.length - 1)]
          if (!option) return false
          event.preventDefault()
          void selectSlashOption(option)
          return true
        }
        return false
      },
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr)
        view.updateState(newState)
        updateStats(view, newState)
        const nextLineType = currentLineType(newState)
        setLineType(nextLineType)
        if (!readonly) updateSlashMenu(view)
        updateSelectionMenu(view)
        saveViewState(view, newState, nextLineType)

        if (!readonly && tr.docChanged) {
          const updatedFile = screenplayDocToEpFile(draftFileRef.current, newState.doc.toJSON())
          draftFileRef.current = updatedFile
          markDirty(filePath)
          if (autoSaveRef.current) {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
            saveTimerRef.current = setTimeout(() => {
              const latest = latestRef.current
              latest.onSave(draftFileRef.current, { updateLocalState: false })
            }, 500)
          }
        }
      },
      attributes: {
        class: readonly ? 'pm-screenplay readonly' : 'pm-screenplay'
      }
    })
    viewRef.current = view
    updateStats(view, state)
    updateDiffDecorations(view)
    requestAnimationFrame(() => updateDiffDecorations(view))
    const initialLineType = cachedState?.lineType ?? currentLineType(state)
    setLineType(initialLineType)
    if (!readonly) updateSlashMenu(view)
    if (!readonly) updateSelectionMenu(view)
    requestAnimationFrame(() => {
      if (scrollRef.current && cachedState) scrollRef.current.scrollTop = cachedState.scrollTop
    })
    return () => {
      saveViewState(view, view.state)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      view.destroy()
      viewRef.current = null
    }
  }, [diffBlocks, editorRevision, filePath, fileVersion, markDirty, readonly])

  const updateStats = useCallback((view: EditorView, state: EditorState) => {
    setWordCount(state.doc.textContent.length)
    requestAnimationFrame(() => {
      setPageCount(Math.max(1, Math.ceil((view.dom.scrollHeight || 1) / PAGE_HEIGHT)))
      setSceneItems(extractScenes(state, view))
    })
  }, [])

  const applyLineType = (type: ScreenplayLineType) => {
    if (!viewRef.current) return
    setCurrentLineType(viewRef.current, type)
    setLineType(type)
  }

  function saveViewState(view: EditorView, state: EditorState, nextLineType = currentLineType(state)) {
    useEditorViewCacheStore.getState().saveScreenplayState(filePath, {
      selectionFrom: state.selection.from,
      selectionTo: state.selection.to,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      lineType: nextLineType
    })
  }

  const snapshotFile = () => {
    const view = viewRef.current
    if (!view) return draftFileRef.current
    const updated = screenplayDocToEpFile(draftFileRef.current, view.state.doc.toJSON())
    draftFileRef.current = updated
    return updated
  }

  const addEpisode = async () => {
    if (readonly) return
    const view = viewRef.current
    const trigger = view ? getSlashTrigger(view) : null
    if (view && trigger) view.dispatch(view.state.tr.delete(trigger.from, trigger.to))
    setSlashMenu(null)
    const result = addEpisodeToFile(snapshotFile())
    await onSave(result.file)
    setEditorRevision(revision => revision + 1)
  }

  const sendSelectionToCopilot = (promptText?: string, autoSubmit = false) => {
    if (!selectionMenu) return
    queueSelection({ ref: selectionMenu.ref, promptText, autoSubmit })
    setRightOpen(true)
    setInlinePromptOpen(false)
    setInlinePrompt('')
  }

  async function selectSlashOption(option: ScreenplaySlashOption) {
    if (option.kind === 'addEpisode') {
      await addEpisode()
      return
    }
    applySlashSelection(option.key)
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  const toolbar = (
    <>
      {!readonly && (
        <div className="pm-line-tools screenplay-tabs">
          {LINE_TYPES.map(type => {
            const Icon = LINE_TYPE_ICONS[type]
            return (
              <button
                key={type}
                className={`pm-format-btn${lineType === type ? ' active' : ''}`}
                onClick={() => applyLineType(type)}
                title={`切换为${SCREENPLAY_LABELS[type]}`}
              >
                <Icon width={14} height={14} />
                <span>{SCREENPLAY_LABELS[type]}</span>
              </button>
            )
          })}
        </div>
      )}
      {readonly && <span className="pm-readonly-badge">只读预览</span>}
    </>
  )

  const statusLeft = (
    <span className="doc-status-stat">
      {episodes ? `共 ${episodes.length} 集 · ` : ''}第 {pageCount} 页 · {wordCount} 字
    </span>
  )

  return (
    <DocumentEditorShell
      toolbar={toolbar}
      outlineItems={sceneItems.length > 0 ? sceneItems : undefined}
      statusLeft={statusLeft}
      findHandlers={readonly ? undefined : findHandlers}
    >
      <div className="pm-editor-main screenplay-main">
        {diffBlocks && diffBlocks.some(block => block.diff) && (
          <DiffBar onAccept={onAccept} onReject={onReject} onAcceptAll={onAcceptAll} />
        )}
        <div
          ref={scrollRef}
          className="pm-screenplay-scroll"
          onScroll={() => {
            const view = viewRef.current
            if (view) saveViewState(view, view.state)
          }}
        >
          <div className="pm-paper" style={{ minHeight: pageCount * PAGE_HEIGHT }}>
            <div ref={mountRef} />
            {!readonly && null}
            {readonly && diffReview && (
              <div className="pm-diff-review-pop" style={{ top: diffReview.top, left: diffReview.left }}>
                <span className="pm-diff-review-title">AI 改动</span>
                <span className="pm-diff-review-sub">审阅后接受或拒绝</span>
                <button className="accept" onMouseDown={event => { event.preventDefault(); onAccept() }}>
                  <Ic.check width={12} height={12} /> 接受
                </button>
                <button onMouseDown={event => { event.preventDefault(); onReject() }}>
                  <Ic.x width={12} height={12} /> 拒绝
                </button>
                {onAcceptAll && (
                  <button className="accept-all" onMouseDown={event => { event.preventDefault(); onAcceptAll() }}>
                    <Ic.checkAll width={12} height={12} /> 全部接受
                  </button>
                )}
              </div>
            )}
            {!readonly && slashMenu && (
              <div className="pm-inline-menu" style={{ top: slashMenu.top, left: slashMenu.left }}>
                {slashOptions.map((option, index) => {
                  const active = index === slashIndex
                  if (option.kind === 'addEpisode') {
                    return (
                      <button key={option.key} className={`pm-inline-item${active ? ' active' : ''}`} onMouseDown={e => {
                        e.preventDefault()
                        void selectSlashOption(option)
                      }}>
                        <Ic.plus width={14} height={14} />
                        <span>{option.label}</span>
                      </button>
                    )
                  }
                  const Icon = option.icon
                  return (
                    <button key={option.key} className={`pm-inline-item${active ? ' active' : ''}`} onMouseDown={e => {
                      e.preventDefault()
                      void selectSlashOption(option)
                    }}>
                      <Icon width={14} height={14} />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!readonly && selectionMenu && (
              <div className="pm-ai-selection-menu" style={{ top: selectionMenu.top, left: selectionMenu.left }}>
                {inlinePromptOpen ? (
                  <form
                    className="pm-ai-inline-form"
                    onSubmit={event => {
                      event.preventDefault()
                      sendSelectionToCopilot(inlinePrompt.trim() ? `请改写这个选区：${inlinePrompt.trim()}` : '请改写这个选区', true)
                    }}
                  >
                    <input
                      autoFocus
                      value={inlinePrompt}
                      onChange={event => setInlinePrompt(event.target.value)}
                      placeholder="告诉 AI 怎么改写这个选区"
                      onKeyDown={event => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setInlinePromptOpen(false)
                          setInlinePrompt('')
                        }
                      }}
                    />
                    <button type="submit">发送</button>
                  </form>
                ) : (
                  <>
                    <button onMouseDown={event => { event.preventDefault(); sendSelectionToCopilot() }}>
                      <Ic.at width={13} height={13} />
                      加入消息
                    </button>
                    <button onMouseDown={event => { event.preventDefault(); setInlinePromptOpen(true) }}>
                      <Ic.spark width={13} height={13} />
                      AI 编辑
                    </button>
                  </>
                )}
              </div>
            )}
            {Array.from({ length: pageCount }).map((_, i) => (
              <div key={i}>
                <div className="pm-page-cover top"    style={{ top: i * PAGE_HEIGHT }} />
                <div className="pm-page-cover bottom" style={{ top: i * PAGE_HEIGHT + 1100 }}>
                  <span className="pm-page-number">-{i + 1}-</span>
                </div>
                {i < pageCount - 1 && (
                  <div className="pm-page-gap" style={{ top: i * PAGE_HEIGHT + 1140 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DocumentEditorShell>
  )

  function updateSlashMenu(view: EditorView) {
    const trigger = getSlashTrigger(view)
    if (!trigger) { setSlashMenu(null); setSlashIndex(0); return }
    const coords   = view.coordsAtPos(view.state.selection.from)
    const rootRect = mountRef.current?.getBoundingClientRect()
    if (!rootRect) return
    setSlashMenu({
      query: trigger.query,
      top:   coords.bottom - rootRect.top  + 8,
      left:  Math.max(26, coords.left - rootRect.left)
    })
  }

  function updateSelectionMenu(view: EditorView) {
    const ref = selectionReferenceFromView(view, filePath, workspaceRoot)
    if (!ref || slashMenuRef.current) {
      setSelectionMenu(null)
      setInlinePromptOpen(false)
      return
    }
    const coords = view.coordsAtPos(view.state.selection.from)
    const rootRect = mountRef.current?.getBoundingClientRect()
    if (!rootRect) return
    setSelectionMenu({
      ref,
      top: Math.max(10, coords.top - rootRect.top - 42),
      left: Math.max(26, coords.left - rootRect.left)
    })
  }

  function updateDiffDecorations(view: EditorView) {
    const diffById = new Map((diffBlocks ?? [])
      .filter(block => block.diff && block.blk.id)
      .map(block => [block.blk.id, block.diff] as const))
    view.dom.querySelectorAll('.pm-diff-add, .pm-diff-del').forEach(node => {
      node.classList.remove('pm-diff-add', 'pm-diff-del')
    })
    if (diffById.size === 0) {
      setDiffReview(null)
      return
    }
    let first: HTMLElement | null = null
    view.dom.querySelectorAll<HTMLElement>('[data-id]').forEach(node => {
      const diff = diffById.get(node.dataset.id ?? '')
      if (!diff) return
      node.classList.add(diff === 'add' ? 'pm-diff-add' : 'pm-diff-del')
      if (!first) first = node
    })
    if (!first) {
      setDiffReview(null)
      return
    }
    setDiffReview({
      top: Math.max(12, first.offsetTop - 6),
      left: Math.max(20, first.offsetLeft + first.offsetWidth + 12)
    })
  }

  function applySlashSelection(type: ScreenplayLineType) {
    const view = viewRef.current
    if (!view) return
    const trigger = getSlashTrigger(view)
    if (trigger) view.dispatch(view.state.tr.delete(trigger.from, trigger.to))
    setCurrentLineType(view, type)
    setLineType(type)
    setSlashMenu(null)
    setSlashIndex(0)
    view.focus()
  }
}

function blockInfoAt(state: EditorState, pos: number) {
  const resolved = state.doc.resolve(Math.max(1, Math.min(pos, state.doc.content.size)))
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const node = resolved.node(depth)
    const id = typeof node.attrs.id === 'string' ? node.attrs.id : undefined
    if (id) return { id, type: node.type.name }
  }
  return undefined
}

export function selectionReferenceFromView(view: EditorView, filePath: string, workspaceRoot: string | null): SelectionReference | null {
  const { selection } = view.state
  if (selection.empty) return null
  const from = Math.min(selection.from, selection.to)
  const to = Math.max(selection.from, selection.to)
  if (to <= from) return null
  const start = blockInfoAt(view.state, from)
  const end = blockInfoAt(view.state, Math.max(from, to - 1))
  return {
    filePath,
    relPath: workspaceRelativePath(filePath, workspaceRoot),
    from,
    to,
    startBlockId: start?.id,
    endBlockId: end?.id,
    startBlockType: start?.type,
    endBlockType: end?.type
  }
}

function currentLineType(state: EditorState): ScreenplayLineType {
  const name = state.selection.$from.parent.type.name
  if (name === 'scene_heading') return 'scene'
  if (name === 'character' || name === 'paren') return 'dialogue'
  if (['action', 'dialogue', 'transition'].includes(name)) return name as ScreenplayLineType
  return 'action'
}

function slashCommandMatches(query: string, label: string) {
  const normalized = query.trim()
  if (!normalized) return true
  return label.includes(normalized) || '新增一集'.includes(normalized) || '新建一集'.includes(normalized)
}

function screenplaySlashOptions(query: string): ScreenplaySlashOption[] {
  const options: ScreenplaySlashOption[] = []
  if (slashCommandMatches(query, '添加一集')) {
    options.push({ kind: 'addEpisode', key: 'addEpisode', label: '添加一集' })
  }
  for (const type of LINE_TYPES) {
    if (!query || SCREENPLAY_LABELS[type].includes(query)) {
      options.push({ kind: 'lineType', key: type, label: SCREENPLAY_LABELS[type], icon: LINE_TYPE_ICONS[type] })
    }
  }
  return options
}

export function screenplaySlashTriggerFromText(textBeforeCursor: string) {
  const lineStart = textBeforeCursor.lastIndexOf('\n') + 1
  const currentLine = textBeforeCursor.slice(lineStart)
  const match = currentLine.match(/^\/([^\s/]*)$/)
  if (!match) return null
  return { query: match[1], offset: lineStart }
}

function getSlashTrigger(view: EditorView): { query: string; from: number; to: number } | null {
  const { state } = view
  const { $from, empty } = state.selection
  if (!empty) return null
  const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const trigger = screenplaySlashTriggerFromText(text)
  if (!trigger) return null
  return { query: trigger.query, from: $from.start() + trigger.offset, to: $from.pos }
}
