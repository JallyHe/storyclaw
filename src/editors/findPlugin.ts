import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'

export interface FindPluginState {
  matches: Array<{ from: number; to: number }>
  current: number
}

export const findPluginKey = new PluginKey<FindPluginState>('find')

export function createFindPlugin() {
  return new Plugin<FindPluginState>({
    key: findPluginKey,
    state: {
      init: () => ({ matches: [], current: 0 }),
      apply(tr, prev) {
        const meta = tr.getMeta(findPluginKey) as FindPluginState | null
        if (meta !== undefined && meta !== null) return meta
        if (!tr.docChanged) return prev
        // Remap positions after document changes (e.g. during replace)
        return {
          matches: prev.matches
            .map(m => ({ from: tr.mapping.map(m.from), to: tr.mapping.map(m.to) }))
            .filter(m => m.from < m.to),
          current: Math.min(prev.current, Math.max(0, prev.matches.length - 1))
        }
      }
    },
    props: {
      decorations(state) {
        const s = findPluginKey.getState(state)
        if (!s || !s.matches.length) return DecorationSet.empty
        const decos = s.matches.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class: i === s.current ? 'find-highlight-current' : 'find-highlight'
          })
        )
        return DecorationSet.create(state.doc, decos)
      }
    }
  })
}

// ── Helpers used by editors ───────────────────────────────────────────────────

export function collectDocPositions(
  doc: PmNode,
  query: string,
  opts: { caseSensitive: boolean }
): Array<{ from: number; to: number }> {
  const results: Array<{ from: number; to: number }> = []
  const needle = opts.caseSensitive ? query : query.toLowerCase()
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text
    const haystack = opts.caseSensitive ? text : text.toLowerCase()
    let idx = 0
    while (true) {
      const found = haystack.indexOf(needle, idx)
      if (found === -1) break
      results.push({ from: pos + found, to: pos + found + needle.length })
      idx = found + 1
    }
  })
  return results
}

export function scrollFindMatchIntoView(view: EditorView, match: { from: number; to: number }) {
  try {
    const { node } = view.domAtPos(match.from)
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch { /* ignore */ }
}
