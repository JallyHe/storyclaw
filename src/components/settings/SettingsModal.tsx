import { useEffect } from 'react'
import { useUiStore, type SettingsTab } from '@/store'
import { Ic } from '@/components/icons'
import { ModelSettingsPanel } from './ModelSettingsPanel'
import { EditorSettingsPanel } from './EditorSettingsPanel'
import { IntegrationsPanel } from './IntegrationsPanel'
import { AccountSettingsPanel } from './AccountSettingsPanel'
import './settings.css'

const NAV: Array<{ id: SettingsTab; label: string; icon: keyof typeof Ic }> = [
  { id: 'account', label: '账户管理', icon: 'user' },
  { id: 'model', label: '模型', icon: 'cube' },
  { id: 'editor', label: '编辑器', icon: 'edit' },
  { id: 'integrations', label: '接入平台', icon: 'robot' }
]

export function SettingsModal() {
  const { settingsOpen, settingsTab, setSettingsTab, closeSettings } = useUiStore()

  useEffect(() => {
    if (!settingsOpen) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    <div className="set-backdrop" onClick={closeSettings}>
      <div className="set-modal" onClick={e => e.stopPropagation()}>
        <nav className="set-nav">
          <div className="set-nav-title">设置</div>
          {NAV.map(item => {
            const Icon = Ic[item.icon] as (props: { width?: number; height?: number }) => JSX.Element
            return (
              <button
                key={item.id}
                className={`set-nav-item${settingsTab === item.id ? ' on' : ''}`}
                onClick={() => setSettingsTab(item.id)}
              >
                <Icon width={16} height={16} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="set-content">
          <button className="set-close" title="关闭" onClick={closeSettings}>
            <Ic.x width={16} height={16} />
          </button>
          {settingsTab === 'account' && <AccountSettingsPanel />}
          {settingsTab === 'model' && <ModelSettingsPanel />}
          {settingsTab === 'editor' && <EditorSettingsPanel />}
          {settingsTab === 'integrations' && <IntegrationsPanel />}
        </div>
      </div>
    </div>
  )
}
