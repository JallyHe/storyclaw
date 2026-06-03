/**
 * DOM-based text search used for non-ProseMirror content (DOCX preview).
 * Safe to use on docx-preview's static HTML — no MutationObserver interference.
 */

export function injectDomHighlights(
  container: HTMLElement,
  query: string,
  opts: { caseSensitive: boolean }
): HTMLSpanElement[] {
  const spans: HTMLSpanElement[] = []
  const needle = opts.caseSensitive ? query : query.toLowerCase()
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)

  for (const textNode of nodes) {
    const text = textNode.nodeValue ?? ''
    const haystack = opts.caseSensitive ? text : text.toLowerCase()
    const offsets: Array<{ start: number; end: number }> = []
    let pos = 0
    while (true) {
      const idx = haystack.indexOf(needle, pos)
      if (idx === -1) break
      offsets.push({ start: idx, end: idx + needle.length })
      pos = idx + 1
    }
    if (!offsets.length) continue

    let cur: Text = textNode
    // Process from last match to first to keep offsets valid
    for (let i = offsets.length - 1; i >= 0; i--) {
      const { start, end } = offsets[i]
      try {
        const after = cur.splitText(end)
        const match = cur.splitText(start)
        const span = document.createElement('span')
        span.className = 'find-highlight'
        match.parentNode!.insertBefore(span, after)
        span.appendChild(match)
        spans.unshift(span)
        // `cur` is now the text before this match — used for next iteration
      } catch { /* skip malformed nodes */ }
    }
  }

  if (spans[0]) spans[0].className = 'find-highlight-current'
  return spans
}

export function clearDomSpans(spans: HTMLSpanElement[]) {
  for (const span of spans) {
    const parent = span.parentNode
    if (!parent) continue
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    if (parent.nodeType === Node.ELEMENT_NODE) (parent as Element).normalize()
  }
}
