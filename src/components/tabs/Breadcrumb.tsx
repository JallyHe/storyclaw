import { useTabsStore, useWorkspaceStore } from '@/store'
import { Ic } from '@/components/icons'

export function Breadcrumb() {
  const activeFile = useTabsStore(s => s.activeFile)
  const root = useWorkspaceStore(s => s.root)

  if (!activeFile) return <div className="breadcrumb" />

  const relative = root && activeFile.startsWith(root)
    ? activeFile.slice(root.length).replace(/^[\\/]/, '')
    : activeFile
  const parts = relative.split(/[\\/]/)

  return (
    <div className="breadcrumb">
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {i > 0 && (
            <span className="bc-sep">
              <Ic.chevRight width={12} height={12} />
            </span>
          )}
          <span className={i === parts.length - 1 ? 'bc-cur' : ''}>{part}</span>
        </span>
      ))}
    </div>
  )
}
