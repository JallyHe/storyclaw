import { useState } from 'react'
import type { IMConnectionMode, IMPlatformConfig } from '@/im/types'
import type { PlatformDescriptor } from '@/im/registry'

interface Props {
  descriptor: PlatformDescriptor
  initial?: IMPlatformConfig
  onCancel: () => void
  onSubmit: (config: IMPlatformConfig) => Promise<void>
}

export function PlatformConfigModal({ descriptor, initial, onCancel, onSubmit }: Props) {
  const firstMode = descriptor.connections.find(c => !c.disabled)?.mode ?? descriptor.connections[0]?.mode ?? 'stream'
  const [mode, setMode] = useState<IMConnectionMode>(initial?.mode ?? firstMode)
  const [credentials, setCredentials] = useState<Record<string, string>>(initial?.credentials ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setField = (key: string, value: string) =>
    setCredentials(cur => ({ ...cur, [key]: value }))

  const missingRequired = descriptor.fields
    .filter(f => f.required)
    .some(f => !(credentials[f.key]?.trim()))

  const submit = async (enabled: boolean) => {
    setError('')
    setBusy(true)
    try {
      await onSubmit({ enabled, mode, credentials })
    } catch (err: any) {
      setError(err?.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <div className="pcm-backdrop" onClick={onCancel}>
      <div className="pcm" onClick={e => e.stopPropagation()}>
        <h3 className="pcm-title">{descriptor.modalTitle}</h3>
        <p className="pcm-desc">{descriptor.modalDescription}</p>
        <button className="pcm-guide" onClick={() => window.open(descriptor.guideUrl)}>配置指南</button>

        {descriptor.connections.length > 1 && (
          <div className="pcm-modes">
            {descriptor.connections.map(conn => (
              <label key={conn.mode} className={`pcm-mode${conn.disabled ? ' disabled' : ''}`} title={conn.hint}>
                <input
                  type="radio"
                  name="conn-mode"
                  checked={mode === conn.mode}
                  disabled={conn.disabled}
                  onChange={() => setMode(conn.mode)}
                />
                {conn.label}
              </label>
            ))}
          </div>
        )}

        <div className="pcm-fields">
          {descriptor.fields.map(field => (
            <input
              key={field.key}
              className="pcm-input"
              type={field.secret ? 'password' : 'text'}
              placeholder={field.placeholder ?? field.label}
              value={credentials[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
            />
          ))}
        </div>

        {error && <div className="pcm-error">{error}</div>}

        <div className="pcm-actions">
          {initial?.enabled && (
            <button className="set-btn ghost danger" disabled={busy} onClick={() => submit(false)}>停用</button>
          )}
          <div style={{ flex: 1 }} />
          <button className="set-btn" disabled={busy} onClick={onCancel}>取消</button>
          <button className="set-btn primary" disabled={busy || missingRequired} onClick={() => submit(true)}>
            {busy ? '连接中…' : '注册'}
          </button>
        </div>
      </div>
    </div>
  )
}
