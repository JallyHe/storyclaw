import { useState, useCallback } from 'react'
import type { WldFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import { Ic } from '@/components/icons'

interface Props { filePath: string; file: WldFile }

export function WorldEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const { saveFile, markDirty } = useWorkspaceStore()

  const save = useCallback(async (patch: Partial<WldFile>) => {
    const updated = { ...data, ...patch }
    setData(updated)
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [data, filePath, saveFile, markDirty])

  return (
    <div className="form-scroll">
      <div className="form-page">
        <div className="form-hero compact">
          <span className="form-kind-badge" style={{ color: 'var(--c-world)' }}>
            <Ic.fileWorld width={22} height={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="form-title-input"
              defaultValue={data.title}
              onBlur={e => save({ title: e.target.value })}
              placeholder="设定标题…"
              spellCheck={false}
            />
            <div className="form-sub">
              <span className="form-sub-dim">世界观 / 设定集</span>
            </div>
          </div>
        </div>

        <div className="form-field">
          <div className="ff-label">正文</div>
          <textarea
            className="ff-input world-body"
            rows={12}
            defaultValue={data.body}
            onBlur={e => save({ body: e.target.value })}
            placeholder="描述这条世界观设定…"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
