import { DOMParser as ProseMirrorDOMParser, DOMSerializer } from 'prosemirror-model'
import { richTextSchema, type RichTextDocJSON } from './schema'

export function htmlToRichTextDoc(html: string): RichTextDocJSON {
  const parser = new window.DOMParser()
  const doc = parser.parseFromString(normalizeHtml(html), 'text/html')
  return ProseMirrorDOMParser.fromSchema(richTextSchema).parse(doc.body).toJSON()
}

export function richTextDocToHtml(doc: RichTextDocJSON): string {
  const serializer = DOMSerializer.fromSchema(richTextSchema)
  const wrapper = document.createElement('div')
  const fragment = serializer.serializeFragment(richTextSchema.nodeFromJSON(doc).content)
  wrapper.appendChild(fragment)
  return wrapper.innerHTML.trim()
}

function normalizeHtml(html: string): string {
  const trimmed = html.trim()
  return trimmed ? trimmed : '<p></p>'
}
