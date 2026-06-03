import { useEffect, useState } from 'react'
import type { IMConfigSnapshot, IMPlatform, IMPlatformConfig, IMStatusSnapshot } from '@/im/types'
import { PLATFORM_REGISTRY, type PlatformDescriptor } from '@/im/registry'
import { imIpc } from '@/ipc/im'
import { PlatformConfigModal } from './PlatformConfigModal'

const STATUS_TEXT: Record<IMStatusSnapshot['status'], string> = {
  idle: '未连接',
  connecting: '连接中',
  connected: '已连接',
  error: '错误'
}

export function IntegrationsPanel() {
  const [config, setConfig] = useState<IMConfigSnapshot | null>(null)
  const [statuses, setStatuses] = useState<Record<string, IMStatusSnapshot>>({})
  const [editing, setEditing] = useState<PlatformDescriptor | null>(null)

  useEffect(() => {
    void imIpc.getConfig().then(setConfig).catch(() => {})
    void imIpc.getStatuses().then(list => {
      setStatuses(Object.fromEntries(list.map(s => [s.platform, s])))
    }).catch(() => {})
    const off = imIpc.onStatus(s => setStatuses(cur => ({ ...cur, [s.platform]: s })))
    return off
  }, [])

  const platformConfig = (id: IMPlatform): IMPlatformConfig | undefined => config?.platforms[id]

  const handleSubmit = async (descriptor: PlatformDescriptor, next: IMPlatformConfig) => {
    const base: IMConfigSnapshot = config ?? { version: 1, platforms: {} }
    const merged: IMConfigSnapshot = {
      version: 1,
      platforms: { ...base.platforms, [descriptor.id]: next }
    }
    const saved = await imIpc.saveConfig(merged)
    setConfig(saved)
    setEditing(null)
  }

  return (
    <div className="set-section">
      <div className="set-section-head">
        <div>
          <h3>接入平台</h3>
          <p className="set-section-desc">将 StoryClaw 助手接入 IM 平台，在聊天中收发消息。</p>
        </div>
      </div>

      <div className="int-list">
        {PLATFORM_REGISTRY.map(p => {
          const cfg = platformConfig(p.id)
          const status = statuses[p.id]?.status ?? (cfg?.enabled ? 'connecting' : 'idle')
          return (
            <div key={p.id} className={`int-card${p.available ? '' : ' disabled'}`}>
              <div className="int-card-main">
                <div className="int-card-title">
                  {p.name}
                  {p.available && <span className={`int-dot ${status}`} title={STATUS_TEXT[status]} />}
                  {!p.available && <span className="set-tag muted">敬请期待</span>}
                  {p.available && cfg?.enabled && <span className="set-tag ok">{STATUS_TEXT[status]}</span>}
                </div>
                <div className="int-card-desc">{p.description}</div>
                <button className="int-guide" onClick={() => window.open(p.guideUrl)}>配置指南</button>
              </div>
              <button
                className="set-btn"
                disabled={!p.available}
                onClick={() => setEditing(p)}
              >
                配置
              </button>
            </div>
          )
        })}
      </div>

      {editing && (
        <PlatformConfigModal
          descriptor={editing}
          initial={platformConfig(editing.id)}
          onCancel={() => setEditing(null)}
          onSubmit={next => handleSubmit(editing, next)}
        />
      )}
    </div>
  )
}
