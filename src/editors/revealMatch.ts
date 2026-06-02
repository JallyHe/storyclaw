/**
 * Best-effort reveal of a matched string inside a rendered editor.
 * Walks the container's text nodes, finds the first occurrence of `matchText`,
 * scrolls it into view and briefly highlights it via the native selection.
 *
 * Used by rich editors (screenplay / outline) where search line numbers from the
 * raw on-disk file don't map cleanly to ProseMirror positions.
 */
export function revealMatchInElement(container: HTMLElement | null | undefined, matchText: string): boolean {
  if (!container || !matchText || !matchText.trim()) return false

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? ''
    const idx = text.indexOf(matchText)
    if (idx === -1) continue

    try {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + matchText.length)

      // Scroll the match roughly to the center of the scroll container
      const rect = range.getBoundingClientRect()
      const scrollParent = findScrollParent(container)
      if (scrollParent && rect.height > 0) {
        const parentRect = scrollParent.getBoundingClientRect()
        const delta = rect.top - parentRect.top - scrollParent.clientHeight / 2
        scrollParent.scrollBy({ top: delta, behavior: 'smooth' })
      } else {
        ;(node.parentElement as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }

      // Briefly highlight via the browser selection
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
        // Clear the selection after a short flash so it doesn't linger
        window.setTimeout(() => {
          if (sel.rangeCount && sel.getRangeAt(0) === range) sel.removeAllRanges()
        }, 1400)
      }
      return true
    } catch {
      return false
    }
  }
  return false
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el
  while (cur) {
    const style = getComputedStyle(cur)
    if (/(auto|scroll)/.test(style.overflowY) && cur.scrollHeight > cur.clientHeight) return cur
    cur = cur.parentElement
  }
  return null
}
