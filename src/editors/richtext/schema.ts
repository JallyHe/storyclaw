import { Schema } from 'prosemirror-model'

const alignAttr = { align: { default: 'left' } }

export const richTextSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: alignAttr,
      parseDOM: [{ tag: 'p', getAttrs: readBlockAttrs }],
      toDOM: node => ['p', blockAttrs(node.attrs), 0]
    },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 }, ...alignAttr },
      parseDOM: [
        { tag: 'h1', getAttrs: dom => ({ level: 1, ...readBlockAttrs(dom) }) },
        { tag: 'h2', getAttrs: dom => ({ level: 2, ...readBlockAttrs(dom) }) },
        { tag: 'h3', getAttrs: dom => ({ level: 3, ...readBlockAttrs(dom) }) }
      ],
      toDOM: node => [`h${node.attrs.level}`, blockAttrs(node.attrs), 0]
    },
    bullet_item: {
      group: 'block',
      content: 'inline*',
      attrs: alignAttr,
      parseDOM: [{ tag: 'li', getAttrs: readBlockAttrs }],
      toDOM: node => ['li', blockAttrs(node.attrs), 0]
    },
    table: {
      group: 'block',
      content: 'table_row+',
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', ['tbody', 0]]
    },
    table_row: {
      content: '(table_header | table_cell)+',
      parseDOM: [{ tag: 'tr' }],
      toDOM: () => ['tr', 0]
    },
    table_header: {
      content: 'inline*',
      attrs: alignAttr,
      parseDOM: [{ tag: 'th', getAttrs: readBlockAttrs }],
      toDOM: node => ['th', blockAttrs(node.attrs), 0]
    },
    table_cell: {
      content: 'inline*',
      attrs: alignAttr,
      parseDOM: [{ tag: 'td', getAttrs: readBlockAttrs }],
      toDOM: node => ['td', blockAttrs(node.attrs), 0]
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br']
    }
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0]
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0]
    },
    underline: {
      parseDOM: [{ tag: 'u' }],
      toDOM: () => ['u', 0]
    },
    text_style: {
      attrs: {
        color: { default: null },
        fontFamily: { default: null }
      },
      parseDOM: [{
        tag: 'span',
        getAttrs: dom => {
          const el = dom as HTMLElement
          return {
            color: el.style.color || null,
            fontFamily: el.style.fontFamily || null
          }
        }
      }],
      toDOM: mark => ['span', markAttrs(mark.attrs), 0]
    }
  }
})

export type RichTextDocJSON = any

function blockAttrs(attrs: { align?: string }) {
  return attrs.align && attrs.align !== 'left' ? { style: `text-align: ${attrs.align};` } : {}
}

function markAttrs(attrs: { color?: string | null; fontFamily?: string | null }) {
  const style = [
    attrs.color ? `color: ${attrs.color}` : '',
    attrs.fontFamily ? `font-family: ${attrs.fontFamily}` : ''
  ].filter(Boolean).join('; ')
  return style ? { style } : {}
}

function readBlockAttrs(dom: string | Node) {
  const el = dom as HTMLElement
  return { align: el.style.textAlign || 'left' }
}
