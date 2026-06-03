import { useEditorSaveStore } from '@/store'

export function EditorSettingsPanel() {
  const autoSave = useEditorSaveStore(s => s.autoSave)
  const setAutoSave = useEditorSaveStore(s => s.setAutoSave)

  return (
    <section className="set-section">
      <div className="set-section-head">
        <div>
          <h3>编辑器</h3>
          <p className="set-section-desc">保存策略会应用到所有项目。</p>
        </div>
      </div>

      <label className="set-toggle-row">
        <input
          type="checkbox"
          checked={autoSave}
          onChange={event => setAutoSave(event.target.checked)}
        />
        <span>
          <strong>自动保存</strong>
          <small>{autoSave ? '编辑后自动写入文件' : '关闭文件或窗口前询问是否保存'}</small>
        </span>
      </label>
    </section>
  )
}
