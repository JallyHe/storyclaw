import { useCallback, useEffect, useState } from 'react'
import type { StoryFile, EpFile, ChrFile, WldFile, ProjectConfigFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import { useChangesStore } from '@/store'
import { ScreenplayProseMirrorEditor } from './prosemirror/ScreenplayProseMirrorEditor'
import { CharacterEditor } from './character/CharacterEditor'
import { OutlineEditor } from './outline/OutlineEditor'
import { WorldEditor } from './world/WorldEditor'
import { ProjectConfigEditor } from './project/ProjectConfigEditor'
import { RefViewer } from './reference/RefViewer'
import { PlainTextEditor } from './text/PlainTextEditor'

interface Props { filePath: string | null }

// Structured story files handled by their own editors
const STORY_EXTS = new Set(['ep', 'chr', 'wld', 'cfg'])
// Binary / extracted documents — read-only viewer
const BINARY_REF_EXTS = new Set(['pdf', 'docx', 'doc', 'rtf'])

export function FileEditor({ filePath }: Props) {
  const { getFile, saveFile } = useWorkspaceStore()
  const { changes, acceptChange, rejectChange } = useChangesStore()
  // Re-load when this file's version bumps (AI wrote to it outside the editor)
  const fileVersion = useWorkspaceStore(s => (filePath ? s.fileVersions.get(filePath) ?? 0 : 0))
  const [file, setFile] = useState<StoryFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const saveCurrentFile = useCallback((updated: StoryFile, options?: { updateLocalState?: boolean }) => {
    if (!filePath) return Promise.resolve()
    return saveFile(filePath, updated).then(() => {
      if (options?.updateLocalState !== false) setFile(updated)
    })
  }, [filePath, saveFile])

  useEffect(() => {
    if (!filePath) return
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    // Only structured story files are loaded via getFile (JSON/markup parsing)
    if (!STORY_EXTS.has(ext)) return
    setLoading(true)
    setLoadError(null)
    getFile(filePath).then(f => {
      setFile(f)
      setLoadedPath(filePath)
      setLoading(false)
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      const isNotFound = /ENOENT|no such file/i.test(msg)
      setLoadError(isNotFound ? `文件不存在：${filePath}` : `加载失败：${msg}`)
      setLoading(false)
    })
  }, [filePath, getFile, fileVersion])

  if (!filePath) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>打开文件开始编辑</div>

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

  // Binary / extracted documents → read-only viewer
  if (BINARY_REF_EXTS.has(ext)) return <div style={{ flex: 1, overflow: 'auto' }}><RefViewer filePath={filePath} /></div>

  // Markdown outline files — rich text editor manages its own loading
  if (ext === 'md') return <div style={{ flex: 1, overflow: 'auto' }}><OutlineEditor filePath={filePath} /></div>

  // Any non-story file (txt, csv, json, log, xml, unknown, no-ext…) → editable plain text
  if (!STORY_EXTS.has(ext)) return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><PlainTextEditor filePath={filePath} /></div>

  if (loadError) return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: 'var(--diff-del-fg)', fontSize: 13, fontWeight: 600 }}>无法打开文件</div>
      <div style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{loadError}</div>
    </div>
  )
  if (loading || !file || loadedPath !== filePath) return <div style={{ padding: 32, color: 'var(--text-3)' }}>加载中…</div>

  const change = changes.get(filePath)
  const scrollWrap = { flex: 1, overflow: 'auto' }

  switch (ext) {
    case 'ep':
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ScreenplayProseMirrorEditor
            filePath={filePath}
            fileVersion={fileVersion}
            file={file as EpFile}
            diffBlocks={change?.diffBlocks}
            onSave={saveCurrentFile}
            onAccept={() => acceptChange(filePath)}
            onReject={() => rejectChange(filePath)}
          />
        </div>
      )
    case 'chr': return <div style={scrollWrap}><CharacterEditor filePath={filePath} file={file as ChrFile} /></div>
    case 'wld': return <div style={scrollWrap}><WorldEditor     filePath={filePath} file={file as WldFile} /></div>
    case 'cfg': return <div style={scrollWrap}><ProjectConfigEditor filePath={filePath} file={file as ProjectConfigFile} /></div>
    default:    return <div style={{ padding: 32, color: 'var(--text-3)' }}>不支持的文件类型：.{ext}</div>
  }
}
