import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FindHandlers } from '@/components/editors/FindBar'
import { useEditorSaveStore, useWorkspaceStore, useTabsStore } from '@/store'
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
  const contentRef = useRef('')
  const savedContentRef = useRef('')

  const findHandlers = useMemo<FindHandlers>(() => ({
    find(query, opts) { return editorRef.current?.findInEditor(query, opts) ?? 0 },
    next() { editorRef.current?.findNext() },
    prev() { editorRef.current?.findPrev() },
    replace(replacement) { editorRef.current?.replaceMatch(replacement) },
    replaceAll(query, replacement, opts) {
      return editorRef.current?.replaceAllMatches(query, replacement, opts) ?? 0
    },
    clear() { editorRef.current?.clearHighlights() }
  }), [])
  const revealTarget = useTabsStore(s => s.revealTarget)
  const consumeReveal = useTabsStore(s => s.consumeReveal)
  const markDirty = useWorkspaceStore(s => s.markDirty)
  const clearDirty = useWorkspaceStore(s => s.clearDirty)
  const autoSave = useEditorSaveStore(s => s.autoSave)
  const registerSaveHandler = useEditorSaveStore(s => s.registerHandler)
  // Track external writes (AI agent) so the editor reloads
  const fileVersion = useWorkspaceStore(s => s.fileVersions.get(filePath) ?? 0)

  useEffect(() => {
    workspaceIpc.readText(filePath)
      .then(text => {
        contentRef.current = text
        savedContentRef.current = text
        setContent(text)
        clearDirty(filePath)
      })
      .catch(() => setContent(''))
  }, [clearDirty, filePath, fileVersion])

  useEffect(() => {
    if (!revealTarget || revealTarget.path !== filePath) return
    const timer = setTimeout(() => {
      revealMatchInElement(editorRef.current?.getDom?.() ?? null, revealTarget.matchText)
      consumeReveal(filePath)
    }, 120)
    return () => clearTimeout(timer)
  }, [revealTarget, filePath, consumeReveal])

  const saveNow = useCallback(async (markdown = contentRef.current) => {
    await workspaceIpc.writeText(filePath, markdown)
    savedContentRef.current = markdown
    clearDirty(filePath)
  }, [clearDirty, filePath])

  useEffect(() => {
    return registerSaveHandler(filePath, {
      save: () => saveNow(),
      discard: () => {
        contentRef.current = savedContentRef.current
        setContent(savedContentRef.current)
        clearDirty(filePath)
      }
    })
  }, [clearDirty, filePath, registerSaveHandler, saveNow])

  const handleChange = useCallback(async (markdown: string) => {
    contentRef.current = markdown
    setContent(markdown)
    markDirty(filePath)
    if (autoSave) await saveNow(markdown)
  }, [autoSave, filePath, markDirty, saveNow])

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
      findHandlers={findHandlers}
    >
      <div className="doc-paper outline-paper">
        <RichTextEditor
          ref={editorRef}
          key={filePath}
          value={content}
          onChange={handleChange}
          placeholder="用标题、正文、列表直接编辑大纲…"
          onHeadingsChange={handleHeadingsChange}
        />
      </div>
    </DocumentEditorShell>
  )
}
