import { useMemo } from 'react'
import { marked, Renderer } from 'marked'

const renderer = new Renderer()
renderer.link = ({ href, title, text }) =>
  `<a href="${href ?? ''}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`

marked.use({ renderer, gfm: true, breaks: true })

/** 复用全局 .md-body 样式的轻量 Markdown 渲染组件。 */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => marked.parse(text, { async: false }) as string, [text])
  return (
    <div className={`md-body${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
