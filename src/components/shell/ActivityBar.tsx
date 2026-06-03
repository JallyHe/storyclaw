import { useUiStore, useChangesStore, useImBotStore } from '@/store'
import { Ic } from '@/components/icons'

export function ActivityBar() {
  const { leftPanel, setLeftPanel, leftOpen, toggleLeft } = useUiStore()
  const changesCount = useChangesStore(s => s.changes.size)
  const imbotUnread = useImBotStore(s => s.unread)

  const select = (id: typeof leftPanel) => {
    if (leftPanel === id && leftOpen) { toggleLeft(); return }
    if (!leftOpen) toggleLeft()
    setLeftPanel(id)
  }

  const tabs = [
    { id: 'explorer' as const, icon: Ic.files,   label: '资源管理器' },
    { id: 'search'   as const, icon: Ic.search,  label: '搜索' },
    { id: 'scm'      as const, icon: Ic.history, label: '版本记录', badge: changesCount },
    { id: 'imbot'    as const, icon: Ic.robot,   label: '机器人会话', badge: imbotUnread },
  ]

  return (
    <div className="activitybar">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`ab-btn${leftPanel === t.id && leftOpen ? ' on' : ''}`}
          title={t.label}
          onClick={() => select(t.id)}
        >
          <t.icon width={23} height={23} />
          {(t.badge ?? 0) > 0 && <span className="ab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}
