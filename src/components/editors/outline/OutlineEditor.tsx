import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceStore, useTabsStore } from '@/store'
import { workspaceIpc } from '@/ipc/workspace'
import { DocumentEditorShell, type DocOutlineItem } from '@/components/editors/DocumentEditorShell'
import {
  RichTextEditor,
  RichTextToolbar,
  type RichTextEditorHandle,
  type RichTextHeading
} from '@/components/editors/prosemirror/RichTextEditor'
import { revealMatchInElement } from '@/editors/revealMatch'

interface Props { filePath: string }

export function OutlineEditor({ filePath }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [outlineItems, setOutlineItems] = useState<DocOutlineItem[]>([])

  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const revealTarget = useTabsStore(s => s.revealTarget)
  const consumeReveal = useTabsStore(s => s.consumeReveal)
  // Track external writes (AI agent) so the editor reloads
  const fileVersion = useWorkspaceStore(s => s.fileVersions.get(filePath) ?? 0)

  useEffect(() => {
    workspaceIpc.readText(filePath)
      .then(text => setContent(text))
      .catch(() => setContent(''))
  }, [filePath, fileVersion])

  useEffect(() => {
    if (!revealTarget || revealTarget.path !== filePath) return
    const timer = setTimeout(() => {
      revealMatchInElement(editorRef.current?.getDom?.() ?? null, revealTarget.matchText)
      consumeReveal(filePath)
    }, 120)
    return () => clearTimeout(timer)
  }, [revealTarget, filePath, consumeReveal])

  const save = useCallback(async (markdown: string) => {
    setContent(markdown)
    await workspaceIpc.writeText(filePath, markdown)
  }, [filePath])

  const handleHeadingsChange = useCallback((headings: RichTextHeading[]) => {
    setOutlineItems(headings.map(h => ({
      key:    `h-${h.index}`,
      label:  h.text,
      indent: Math.max(0, h.level - 1),
      onClick: () => editorRef.current?.scrollToHeading(h.index)
    })))
  }, [])

  if (content === null) return null

  const toolbar = <RichTextToolbar editorRef={editorRef} />

  return (
    <DocumentEditorShell
      toolbar={toolbar}
      outlineItems={outlineItems.length > 0 ? outlineItems : undefined}
    >
      <div className="doc-paper outline-paper">
        <RichTextEditor
          ref={editorRef}
          key={filePath}
          value={content}
          onChange={save}
          placeholder="用标题、正文、列表直接编辑大纲…"
          onHeadingsChange={handleHeadingsChange}
        />
      </div>
    </DocumentEditorShell>
  )
}
