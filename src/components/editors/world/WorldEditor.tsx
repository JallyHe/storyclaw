import { useCallback, useEffect, useRef, useState } from 'react'
import type { WldFile } from '@/types'
import { useEditorSaveStore, useWorkspaceStore } from '@/store'
import { Ic } from '@/components/icons'
import {
  RichTextEditor,
  RichTextToolbar,
  type RichTextEditorHandle
} from '@/components/editors/prosemirror/RichTextEditor'
import { WORLD_SECTION_DEFS, type WorldSectionKey } from '@/editors/world/sections'

interface Props { filePath: string; file: WldFile }

export function WorldEditor({ filePath, file }: Props) {
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

  const updateDraft = useCallback(async (updated: WldFile) => {
    dataRef.current = updated
    setData(updated)
    markDirty(filePath)
    if (autoSave) await saveNow(updated)
  }, [autoSave, filePath, markDirty, saveNow])

  const saveTitle = useCallback((title: string) => {
    void updateDraft({ ...dataRef.current, title })
  }, [updateDraft])

  const saveSection = useCallback((key: WorldSectionKey, value: string) => {
    const current = dataRef.current
    void updateDraft({
      ...current,
      sections: {
        ...current.sections,
        [key]: value
      }
    })
  }, [updateDraft])

  return (
    <div className="world-editor-scroll">
      <div className="world-editor-page">
        <div className="form-hero compact">
          <span className="form-kind-badge" style={{ color: 'var(--c-world)' }}>
            <Ic.fileWorld width={22} height={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="form-title-input"
              defaultValue={data.title}
              onBlur={e => saveTitle(e.target.value)}
              placeholder="项目设定…"
              spellCheck={false}
            />
            <div className="form-sub">
              <span className="form-sub-dim">项目唯一设定总表 / Markdown 富文本</span>
            </div>
          </div>
        </div>

        <div className="world-section-list">
          {WORLD_SECTION_DEFS.map(section => (
            <WorldSectionEditor
              key={section.key}
              sectionKey={section.key}
              label={section.label}
              hint={section.hint}
              placeholder={section.placeholder}
              value={data.sections[section.key]}
              onChange={saveSection}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WorldSectionEditor({
  sectionKey,
  label,
  hint,
  placeholder,
  value,
  onChange
}: {
  sectionKey: WorldSectionKey
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (key: WorldSectionKey, value: string) => void
}) {
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const handleChange = useCallback((next: string) => {
    onChange(sectionKey, next)
  }, [onChange, sectionKey])

  return (
    <section className="world-section">
      <div className="world-section-head">
        <div>
          <h3>{label}</h3>
          <p>{hint}</p>
        </div>
      </div>
      <div className="world-section-editor">
        <div className="world-section-toolbar">
          <RichTextToolbar editorRef={editorRef} />
        </div>
        <RichTextEditor
          ref={editorRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          compact
        />
      </div>
    </section>
  )
}
