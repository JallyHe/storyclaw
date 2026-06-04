import { richTextSchema, type RichTextDocJSON } from './schema'

export function markdownToRichTextDoc(markdown: string): RichTextDocJSON {
  // Normalize Windows line endings so \r never ends up inside paragraph text
  const normalized = normalizeMarkdownTableSpacing(markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  const blocks = normalized.split(/\n{2,}/).flatMap(chunkToNodes)
  return {
    type: 'doc',
    content: blocks.length ? blocks : [{ type: 'paragraph' }]
  }
}

export function richTextDocToMarkdown(doc: RichTextDocJSON): string {
  return (doc.content ?? [])
    .map(node => nodeToMarkdown(node))
    .join('\n')
}

// ── Chunk dispatch ───────────────────────────────────────────────────────────

function normalizeMarkdownTableSpacing(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const prev = previousNonEmpty(out)
    const next = nextNonEmpty(lines, i + 1)

    if (line.trim() === '' && prev && next && isPipeTableLine(prev) && isPipeTableLine(next)) {
      continue
    }

    out.push(line)
  }

  return out.join('\n')
}

function previousNonEmpty(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim() !== '') return lines[i]
  }
  return null
}

function nextNonEmpty(lines: string[], from: number): string | null {
  for (let i = from; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') return lines[i]
  }
  return null
}

function isPipeTableLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')
}

function chunkToNodes(chunk: string): RichTextDocJSON[] {
  const lines = chunk.split('\n').filter(l => l.trim() !== '' || false)
  if (isTableChunk(lines)) return [parseMarkdownTable(lines)]

  const nodes: RichTextDocJSON[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (isTableStart(lines, i)) {
      const tableLines = [lines[i], lines[i + 1]]
      i += 2
      while (i < lines.length && isPipeTableLine(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      i -= 1
      nodes.push(parseMarkdownTable(tableLines))
    } else {
      nodes.push(lineToNode(lines[i]))
    }
  }

  return nodes
}

// A chunk is a markdown table when it has ≥2 lines and the second line is
// a separator row (cells of dashes/colons between pipes).
function isTableChunk(lines: string[]): boolean {
  if (lines.length < 2) return false
  return /^\s*\|?[\s\-:]+(\|[\s\-:]+)+\|?\s*$/.test(lines[1])
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length) return false
  return isPipeTableLine(lines[index]) && isTableChunk(lines.slice(index, index + 2))
}

// ── Table parsing ────────────────────────────────────────────────────────────

function splitCells(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim())
}

function parseMarkdownTable(lines: string[]): RichTextDocJSON {
  const headers = splitCells(lines[0])
  // lines[1] is the separator — skip
  const dataRows = lines.slice(2).filter(l => l.includes('|'))

  return {
    type: 'table',
    content: [
      {
        type: 'table_row',
        content: headers.map(text => ({
          type: 'table_header',
          attrs: { align: 'left' },
          content: inlineContent(text) ?? []
        }))
      },
      ...dataRows.map(line => ({
        type: 'table_row',
        content: splitCells(line).map(text => ({
          type: 'table_cell',
          attrs: { align: 'left' },
          content: inlineContent(text) ?? []
        }))
      }))
    ]
  }
}

// ── Node serialization ───────────────────────────────────────────────────────

function nodeToMarkdown(node: RichTextDocJSON): string {
  if (node.type === 'table') return tableToMarkdown(node)
  const text = inlineMarkdown(node.content ?? [])
  if (node.type === 'heading') return `${'#'.repeat(node.attrs?.level ?? 1)} ${text}`
  if (node.type === 'bullet_item') return `- ${text}`
  return text
}

function tableToMarkdown(node: RichTextDocJSON): string {
  const rows: RichTextDocJSON[] = node.content ?? []
  const lines: string[] = []

  rows.forEach((row: RichTextDocJSON, i: number) => {
    const cells = (row.content ?? []).map((cell: RichTextDocJSON) =>
      inlineMarkdown(cell.content ?? [])
    )
    lines.push('| ' + cells.join(' | ') + ' |')
    if (i === 0) {
      lines.push('| ' + cells.map(() => '---').join(' | ') + ' |')
    }
  })

  return lines.join('\n')
}

// ── Line parsing ─────────────────────────────────────────────────────────────

function lineToNode(line: string): RichTextDocJSON {
  const heading = line.match(/^(#{1,3})\s+(.*)$/)
  if (heading) {
    return {
      type: 'heading',
      attrs: { level: heading[1].length },
      content: inlineContent(heading[2])
    }
  }
  const bullet = line.match(/^-\s+(.*)$/)
  if (bullet) {
    return { type: 'bullet_item', content: inlineContent(bullet[1]) }
  }
  return { type: 'paragraph', content: inlineContent(line) }
}

// ── Inline content ───────────────────────────────────────────────────────────

function inlineContent(text: string) {
  const nodes: RichTextDocJSON[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|<u>.*?<\/u>)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) nodes.push({ type: 'text', text: text.slice(cursor, match.index) })
    const raw = match[0]
    if (raw.startsWith('**')) {
      nodes.push({ type: 'text', text: raw.slice(2, -2), marks: [{ type: 'strong' }] })
    } else if (raw.startsWith('*')) {
      nodes.push({ type: 'text', text: raw.slice(1, -1), marks: [{ type: 'em' }] })
    } else {
      nodes.push({ type: 'text', text: raw.slice(3, -4), marks: [{ type: 'underline' }] })
    }
    cursor = match.index + raw.length
  }
  if (cursor < text.length) nodes.push({ type: 'text', text: text.slice(cursor) })
  return nodes.length ? nodes : undefined
}

function inlineMarkdown(content: RichTextDocJSON[]): string {
  return content.map(node => {
    if (node.type !== 'text') return ''
    const markTypes = (node.marks ?? []).map((mark: any) => mark.type)
    if (markTypes.includes('strong')) return `**${node.text}**`
    if (markTypes.includes('em')) return `*${node.text}*`
    if (markTypes.includes('underline')) return `<u>${node.text}</u>`
    return node.text ?? ''
  }).join('')
}

export function richTextNodeType(type: string) {
  return richTextSchema.nodes[type]
}
