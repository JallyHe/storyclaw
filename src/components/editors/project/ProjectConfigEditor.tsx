import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectConfigFile, ProjectType, ScreenplayLayout } from '@/types'
import { useEditorSaveStore, useWorkspaceStore } from '@/store'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-field">
      <div className="ff-label">{label}</div>
      {children}
    </div>
  )
}

interface Props { filePath: string; file: ProjectConfigFile }

export function ProjectConfigEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const dataRef = useRef(file)
  const savedRef = useRef(file)
  const { saveFile, markDirty, clearDirty } = useWorkspaceStore()
  const autoSave = useEditorSaveStore(s => s.autoSave)
  const registerSaveHandler = useEditorSaveStore(s => s.registerHandler)

  useEffect(() => {
    dataRef.current = file
    savedRef.current = file
    setData(file)
    clearDirty(filePath)
  }, [clearDirty, file, filePath])

  const saveNow = useCallback(async (updated = dataRef.current) => {
    await saveFile(filePath, updated)
    savedRef.current = updated
    clearDirty(filePath)
  }, [clearDirty, filePath, saveFile])

  useEffect(() => registerSaveHandler(filePath, {
    save: () => saveNow(),
    discard: () => {
      dataRef.current = savedRef.current
      setData(savedRef.current)
      clearDirty(filePath)
    }
  }), [clearDirty, filePath, registerSaveHandler, saveNow])

  const patch = useCallback(async (patchData: Partial<ProjectConfigFile>) => {
    const updated = { ...dataRef.current, ...patchData, kind: 'storyclaw-project' as const, version: 1 as const }
    dataRef.current = updated
    setData(updated)
    markDirty(filePath)
    if (autoSave) await saveNow(updated)
  }, [autoSave, filePath, markDirty, saveNow])

  const updateLocal = useCallback((patchData: Partial<ProjectConfigFile>) => {
    setData(current => {
      const updated = { ...current, ...patchData, kind: 'storyclaw-project' as const, version: 1 as const }
      dataRef.current = updated
      return updated
    })
    markDirty(filePath)
  }, [filePath, markDirty])

  const patchType = (type: ProjectType) => {
    const screenplayLayout: ScreenplayLayout = type === 'short'
      ? 'single-file-multi-episode'
      : type === 'film'
        ? 'single-film-file'
        : 'one-file-per-episode'
    void patch({
      type,
      episodes: type === 'film' ? 1 : dataRef.current.episodes,
      episodeDurationMinutes: type === 'film' ? 100 : type === 'short' ? 3 : 45,
      screenplayLayout
    })
  }

  return (
    <div className="form-scroll">
      <div className="form-page">
        <div className="form-hero">
          <span className="char-avatar" style={{ background: 'var(--accent)' }}>配</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="form-title-input"
              value={data.name}
              onChange={e => updateLocal({ name: e.target.value })}
              onBlur={e => void patch({ name: e.target.value })}
              spellCheck={false}
            />
            <div className="form-sub">
              <span className="pill">{projectTypeLabel(data.type)}</span>
              <span className="form-sub-dim">{data.genre || '未填写题材'}</span>
              <span className="form-sub-dim">{data.episodes} 集 · {data.episodeDurationMinutes} 分钟</span>
            </div>
          </div>
        </div>

        <div className="form-grid two">
          <Field label="类型">
            <select className="ff-input" value={data.type} onChange={e => patchType(e.target.value as ProjectType)}>
              <option value="film">电影</option>
              <option value="series">电视剧</option>
              <option value="short">短剧</option>
            </select>
          </Field>
          <Field label="题材">
            <input className="ff-input" value={data.genre} onChange={e => updateLocal({ genre: e.target.value })} onBlur={e => void patch({ genre: e.target.value })} placeholder="青春偶像、悬疑、古装喜剧…" />
          </Field>
          <Field label="集数">
            <input className="ff-input" type="number" min={1} value={data.episodes} onChange={e => updateLocal({ episodes: Math.max(1, Number(e.target.value) || 1) })} onBlur={e => void patch({ episodes: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="每集时长（分钟）">
            <input className="ff-input" type="number" min={1} value={data.episodeDurationMinutes} onChange={e => updateLocal({ episodeDurationMinutes: Math.max(1, Number(e.target.value) || 1) })} onBlur={e => void patch({ episodeDurationMinutes: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        </div>

        <Field label="剧本组织方式">
          <select className="ff-input" value={data.screenplayLayout} onChange={e => void patch({ screenplayLayout: e.target.value as ScreenplayLayout })}>
            <option value="single-file-multi-episode">一个剧本文件包含多集</option>
            <option value="one-file-per-episode">一集一个剧本文件</option>
            <option value="single-film-file">电影单文件</option>
          </select>
        </Field>

        <Field label="简介">
          <textarea className="ff-input" rows={6} value={data.synopsis} onChange={e => updateLocal({ synopsis: e.target.value })} onBlur={e => void patch({ synopsis: e.target.value })} placeholder="项目故事简介、核心卖点、设定说明…" />
        </Field>
      </div>
    </div>
  )
}

function projectTypeLabel(type: ProjectType) {
  if (type === 'film') return '电影'
  if (type === 'short') return '短剧'
  return '电视剧'
}
