import { baseKeymap, setBlockType } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { Fragment, Node, Slice } from 'prosemirror-model'
import { EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { inferScreenplayLineType, parseSceneHeading } from './convert'
import { cycleScreenplayLineType } from './controls'
import { episodeCodeFromNumber, episodeLabel, episodeNumberFromCode } from './episodeMeta'
import { nanoid } from './ids'
import { screenplaySchema, type ScreenplayLineType } from './schema'

const PAGE_HEIGHT = 1160
const FIRST_PAGE_TOP = 82
const PAGE_TOP = 82
const PAGE_BOTTOM = 1100

export function createScreenplayPlugins() {
  return [
    history(),
    createEnterFlowPlugin(),
    createShortcutPlugin(),
    createTabCyclePlugin(),
    createPastePlugin(),
    createEpisodeHeadingViewPlugin(),
    createSpeechHighlightPlugin(),
    createPaginationPlugin(),
    keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
    keymap(baseKeymap)
  ]
}

export function createReadonlyScreenplayPlugins() {
  return [
    createEpisodeHeadingViewPlugin(),
    createSpeechHighlightPlugin(),
    createPaginationPlugin()
  ]
}

function createEpisodeHeadingViewPlugin() {
  return new Plugin({
    props: {
      nodeViews: {
        episode_heading(node, view, getPos) {
          const dom = document.createElement('div')
          dom.className = 'pm-sp-episode-heading'
          dom.dataset.type = 'episode_heading'
          dom.dataset.id = node.attrs.id ?? ''
          dom.dataset.episode = node.attrs.episode ?? ''

          const label = document.createElement('label')
          label.className = 'pm-sp-episode-label'
          const prefix = document.createElement('span')
          prefix.textContent = '第'
          const input = document.createElement('input')
          input.className = 'pm-sp-episode-number'
          input.inputMode = 'numeric'
          input.pattern = '[0-9]*'
          input.value = episodeNumberFromCode(node.attrs.episode || '', 1)
          const suffix = document.createElement('span')
          suffix.textContent = '集'
          label.append(prefix, input, suffix)

          const contentDOM = document.createElement('span')
          contentDOM.className = 'pm-sp-episode-title'

          const side = document.createElement('span')
          side.className = 'pm-sp-episode-side'

          const commitEpisode = () => {
            const pos = typeof getPos === 'function' ? getPos() : undefined
            if (typeof pos !== 'number') return
            const number = input.value.replace(/\D/g, '')
            input.value = number || '1'
            const episode = episodeCodeFromNumber(input.value)
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, {
              ...view.state.doc.nodeAt(pos)?.attrs,
              episode,
              episodeLabel: episodeLabel(episode)
            }))
          }

          input.addEventListener('input', commitEpisode)
          dom.append(label, contentDOM, side)

          return {
            dom,
            contentDOM,
            update(nextNode) {
              if (nextNode.type !== node.type) return false
              node = nextNode
              dom.dataset.episode = nextNode.attrs.episode ?? ''
              input.value = episodeNumberFromCode(nextNode.attrs.episode || '', 1)
              return true
            },
            stopEvent(event) {
              return event.target === input
            },
            ignoreMutation(mutation) {
              return mutation.target === input
            }
          }
        }
      }
    }
  })
}

export function setCurrentLineType(view: EditorView, type: ScreenplayLineType) {
  const nodeType = nodeTypeForLine(type)
  if (!nodeType) return

  const tr = splitHardBreakSegmentAndSetType(view.state, nodeType)
  if (tr) {
    view.dispatch(tr)
  } else {
    setBlockType(nodeType)(view.state, view.dispatch)
  }
  view.focus()
}

// When the block under the cursor contains hard_break nodes, extract only the
// visual segment around the cursor as a new block of the target type, leaving
// the segments above and below as separate blocks of the original type.
function splitHardBreakSegmentAndSetType(state: EditorState, nodeType: ReturnType<typeof nodeTypeForLine>): ReturnType<typeof state.tr> | null {
  if (!nodeType) return null
  const { $from } = state.selection
  const block = $from.parent
  const blockPos = $from.before()
  const cursorOffset = $from.parentOffset

  // Check whether the block has any hard_breaks at all
  let hasHardBreak = false
  block.forEach(child => { if (child.type === screenplaySchema.nodes.hard_break) hasHardBreak = true })
  if (!hasHardBreak) return null

  // Find the content slice [segStart, segEnd) that surrounds the cursor
  let segStart = 0
  let segEnd = block.content.size
  block.forEach((child, childOffset) => {
    if (child.type !== screenplaySchema.nodes.hard_break) return
    const childEnd = childOffset + child.nodeSize
    if (childEnd <= cursorOffset) {
      segStart = childEnd
    } else if (childOffset >= cursorOffset && segEnd === block.content.size) {
      segEnd = childOffset
    }
  })

  const nodes: Node[] = []

  // Segment before cursor segment (same original type)
  if (segStart > 0) {
    const beforeContent = block.content.cut(0, segStart - 1)
    if (beforeContent.size > 0) {
      nodes.push(block.type.create({ id: nanoid() }, beforeContent))
    }
  }

  // The cursor's segment with the new target type
  const segContent = block.content.cut(segStart, segEnd)
  nodes.push(nodeType.create({ id: nanoid() }, segContent.size > 0 ? segContent : null))

  // Segment after cursor segment (same original type)
  if (segEnd < block.content.size) {
    const afterContent = block.content.cut(segEnd + 1)
    if (afterContent.size > 0) {
      nodes.push(block.type.create({ id: nanoid() }, afterContent))
    }
  }

  const tr = state.tr
  tr.replaceWith(blockPos, blockPos + block.nodeSize, nodes)

  // Place cursor inside the new target-type block
  const beforeSize = segStart > 0 && nodes.length > 1 ? nodes[0].nodeSize : 0
  const targetStart = blockPos + beforeSize
  tr.setSelection(TextSelection.near(tr.doc.resolve(targetStart + 1)))

  return tr
}

function createEnterFlowPlugin() {
  return keymap({
    Enter: (state, dispatch) => {
      const { selection } = state
      const { $from, empty } = selection
      if (!empty) return false

      const current = $from.parent.type.name
      const isEmpty = $from.parent.textContent.trim().length === 0
      if (current === 'episode_heading') {
        const nodeType = screenplaySchema.nodes.action
        const end = $from.end()
        const tr = state.tr.insert(end + 1, nodeType.create({ id: nanoid() }))
        tr.setSelection(TextSelection.near(tr.doc.resolve(end + 2)))
        dispatch(tr.scrollIntoView())
        return true
      }

      if ($from.parentOffset < $from.parent.content.size) {
        const currentType = $from.parent.type
        const tr = state.tr.split($from.pos, 1, [{ type: currentType, attrs: nextBlockAttrs(current, $from.parent.attrs) }])
        dispatch(tr.scrollIntoView())
        return true
      }

      if (!isEmpty && allowsTrailingLineBreak(current)) {
        const tr = state.tr.replaceSelectionWith(screenplaySchema.nodes.hard_break.create()).scrollIntoView()
        dispatch(tr)
        return true
      }

      const nextType = nextTypeAfter(current, isEmpty)
      const nodeType = screenplaySchema.nodes[nextType]
      if (!nodeType || !dispatch) return false

      const end = $from.end()
      const tr = state.tr.insert(end + 1, nodeType.create({ id: nanoid() }))
      tr.setSelection(TextSelection.near(tr.doc.resolve(end + 2)))
      dispatch(tr)
      return true
    }
  })
}

function allowsTrailingLineBreak(type: string) {
  return type === 'action' || type === 'dialogue' || type === 'paren'
}

function nextBlockAttrs(type: string, attrs: Record<string, unknown>) {
  if (type === 'scene_heading') {
    return {
      id: nanoid(),
      number: '',
      intext: attrs.intext ?? '',
      location: '',
      time: attrs.time ?? '',
      synopsis: ''
    }
  }
  if (type === 'character') return { id: nanoid(), name: '', ext: '' }
  return { id: nanoid() }
}

function createShortcutPlugin() {
  return keymap({
    'Mod-Shift-h': setBlockType(screenplaySchema.nodes.scene_heading),
    'Mod-Shift-a': setBlockType(screenplaySchema.nodes.action),
    'Mod-Shift-d': setBlockType(screenplaySchema.nodes.dialogue),
    'Mod-Shift-t': setBlockType(screenplaySchema.nodes.transition)
  })
}

function createTabCyclePlugin() {
  return keymap({
    Tab: (_state, _dispatch, view) => {
      if (!view) return false
      const type = currentLineType(view.state)
      setCurrentLineType(view, cycleScreenplayLineType(type))
      return true
    },
    'Shift-Tab': (_state, _dispatch, view) => {
      if (!view) return false
      const type = currentLineType(view.state)
      setCurrentLineType(view, cycleScreenplayLineType(type, -1))
      return true
    }
  })
}

function createPastePlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain')
        if (!text || !text.includes('\n')) return false
        const nodes = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .flatMap(line => createNodesFromLine(line))
        if (!nodes.length) return false
        event.preventDefault()
        view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)))
        return true
      }
    }
  })
}

type PaginationBlock = { pos: number; top: number; bottom: number }
type PaginationOptions = {
  pageHeight: number
  firstPageTop: number
  pageTop: number
  pageBottom: number
}
type PaginationSpacer = { pos: number; height: number }

export function normalizePaginationMeasurement(value: number, zoom: number): number {
  return zoom > 0 ? value / zoom : value
}

function readPaginationZoom(view: EditorView): number {
  const zoomRoot = view.dom.closest('.doc-shell-canvas-inner') as HTMLElement | null
  if (!zoomRoot) return 1
  const style = window.getComputedStyle(zoomRoot)
  const raw = String((style as CSSStyleDeclaration & { zoom?: string }).zoom || '1')
  const zoom = Number.parseFloat(raw)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

export function buildScreenplayPaginationPlan(
  blocks: PaginationBlock[],
  options: PaginationOptions
): PaginationSpacer[] {
  const spacers: PaginationSpacer[] = []
  let addedHeight = 0

  for (const block of blocks) {
    let top = block.top + addedHeight
    let bottom = block.bottom + addedHeight
    let page = Math.floor(Math.max(0, top) / options.pageHeight)
    const pageTop = page === 0 ? options.firstPageTop : page * options.pageHeight + options.pageTop
    const pageBottom = page * options.pageHeight + options.pageBottom

    if (top < pageTop) {
      const height = pageTop - top
      spacers.push({ pos: block.pos, height })
      addedHeight += height
      top += height
      bottom += height
    }

    if (bottom > pageBottom && top > pageTop) {
      page += 1
      const nextTop = page * options.pageHeight + options.pageTop
      const height = nextTop - top
      spacers.push({ pos: block.pos, height })
      addedHeight += height
    }
  }

  return spacers
}

const paginationKey = new PluginKey<DecorationSet>('storyclaw-screenplay-pagination')

function createPaginationPlugin() {
  return new Plugin({
    key: paginationKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const next = tr.getMeta(paginationKey)
        if (next) return next
        return old.map(tr.mapping, tr.doc)
      }
    },
    view(view) {
      let frame = 0
      let destroyed = false
      const observer = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => update())
        : null
      const update = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          if (destroyed) return
          const blocks = collectPaginationBlocks(view)
          const spacers = buildScreenplayPaginationPlan(blocks, {
            pageHeight: PAGE_HEIGHT,
            firstPageTop: FIRST_PAGE_TOP,
            pageTop: PAGE_TOP,
            pageBottom: PAGE_BOTTOM
          })
          const decorations = spacers.map(spacer => Decoration.widget(
            spacer.pos,
            () => {
              const el = document.createElement('div')
              el.className = 'pm-page-flow-spacer'
              el.style.height = `${Math.max(0, Math.ceil(spacer.height))}px`
              return el
            },
            {
              key: `page-spacer-${spacer.pos}-${Math.ceil(spacer.height)}`,
              side: -1,
              ignoreSelection: true,
              height: Math.ceil(spacer.height)
            }
          ))
          const nextSet = DecorationSet.create(view.state.doc, decorations)
          if (!sameDecorations(paginationKey.getState(view.state), nextSet)) {
            view.dispatch(view.state.tr.setMeta(paginationKey, nextSet))
          }
        })
      }
      observer?.observe(view.dom)
      update()
      return {
        update,
        destroy() {
          destroyed = true
          observer?.disconnect()
          cancelAnimationFrame(frame)
        }
      }
    },
    props: {
      decorations(state) {
        return paginationKey.getState(state)
      }
    }
  })
}

function collectPaginationBlocks(view: EditorView): PaginationBlock[] {
  const blocks: PaginationBlock[] = []
  const paper = view.dom.closest('.pm-paper') as HTMLElement | null
  const paperTop = paper?.getBoundingClientRect().top ?? view.dom.getBoundingClientRect().top
  const zoom = readPaginationZoom(view)
  let spacerHeightBefore = 0
  const spacers = (paginationKey.getState(view.state)?.find() ?? [])
    .map(item => ({ pos: item.from, height: Number(item.type.spec.height) || 0 }))
    .sort((a, b) => a.pos - b.pos)
  let spacerIndex = 0
  view.state.doc.forEach((_node, pos) => {
    const dom = view.nodeDOM(pos) as HTMLElement | null
    if (!dom) return
    while (spacerIndex < spacers.length && spacers[spacerIndex].pos <= pos) {
      spacerHeightBefore += spacers[spacerIndex].height
      spacerIndex += 1
    }
    const rect = dom.getBoundingClientRect()
    blocks.push({
      pos,
      top: normalizePaginationMeasurement(rect.top - paperTop, zoom) - spacerHeightBefore,
      bottom: normalizePaginationMeasurement(rect.bottom - paperTop, zoom) - spacerHeightBefore
    })
  })
  return blocks
}

function createNodesFromLine(line: string) {
  const type = inferScreenplayLineType(line)
  if (type === 'scene') {
    const parsed = parseSceneHeading(line)
    return [screenplaySchema.nodes.scene_heading.create({ id: nanoid(), ...parsed, synopsis: '' }, screenplaySchema.text(line))]
  }
  if (type === 'dialogue') {
    return [screenplaySchema.nodes.dialogue.create({ id: nanoid() }, screenplaySchema.text(line))]
  }
  const nodeType = nodeTypeForLine(type)
  return [nodeType.create({ id: nanoid() }, line ? screenplaySchema.text(line) : undefined)]
}

function nodeTypeForLine(type: ScreenplayLineType) {
  const map = {
    scene: screenplaySchema.nodes.scene_heading,
    action: screenplaySchema.nodes.action,
    dialogue: screenplaySchema.nodes.dialogue,
    character: screenplaySchema.nodes.dialogue,
    paren: screenplaySchema.nodes.dialogue,
    transition: screenplaySchema.nodes.transition
  } satisfies Record<ScreenplayLineType, typeof screenplaySchema.nodes.action>
  return map[type]
}

function nextTypeAfter(type: string, isEmpty: boolean) {
  if (type === 'scene_heading') return 'action'
  if (type === 'dialogue' && isEmpty) return 'action'
  if (type === 'transition') return 'scene_heading'
  return type
}

function currentLineType(state: { selection: { $from: { parent: { type: { name: string } } } } }): ScreenplayLineType {
  const typeName = state.selection.$from.parent.type.name
  if (typeName === 'scene_heading') return 'scene'
  if (
    typeName === 'action' ||
    typeName === 'dialogue' ||
    typeName === 'transition'
  ) {
    return typeName
  }
  if (typeName === 'character' || typeName === 'paren') return 'dialogue'
  return 'action'
}

function createSpeechHighlightPlugin() {
  return new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'dialogue') return
          const text = node.textContent
          const match = text.match(/^([\u4e00-\u9fa5A-Za-z·\s]{1,16})([（(][^）)]{1,24}[）)])?([：:])/)
          if (!match) return
          const start = pos + 1
          const speakerEnd = start + match[1].length
          decorations.push(Decoration.inline(start, speakerEnd, { class: 'pm-speech-speaker' }))
          if (match[2]) {
            decorations.push(Decoration.inline(speakerEnd, speakerEnd + match[2].length, { class: 'pm-speech-paren' }))
          }
          const colonStart = speakerEnd + (match[2]?.length ?? 0)
          const colonEnd = colonStart + match[3].length
          decorations.push(Decoration.inline(colonStart, colonEnd, { class: 'pm-speech-colon' }))
        })
        return DecorationSet.create(state.doc, decorations)
      }
    }
  })
}

function sameDecorations(a?: DecorationSet, b?: DecorationSet) {
  const left = a?.find() ?? []
  const right = b?.find() ?? []
  if (left.length !== right.length) return false
  return left.every((item, index) => {
    const other = right[index]
    return item.from === other.from && item.to === other.to && item.type.spec.height === other.type.spec.height
  })
}
