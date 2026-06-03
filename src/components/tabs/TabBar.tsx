import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { requestUnsavedDocumentAction, useTabsStore, useWorkspaceStore, useChangesStore } from '@/store'
import { FILE_KIND, Ic } from '@/components/icons'

export function TabBar() {
  const { openTabs, activeFile, setActive, closeTab, closeOtherTabs, closeAllTabs } = useTabsStore()
  const dirtySet = useWorkspaceStore(s => s.dirtySet)
  const changes = useChangesStore(s => s.changes)
  const activeTabRef = useRef<HTMLDivElement | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; filePath: string } | null>(null)

  useLayoutEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeFile, openTabs])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  const openMenu = (event: MouseEvent<HTMLDivElement>, filePath: string) => {
    event.preventDefault()
    event.stopPropagation()
    setActive(filePath)
    setMenu({ x: event.clientX, y: event.clientY, filePath })
  }

  const closeCurrent = async (filePath: string) => {
    if (!(await requestUnsavedDocumentAction([filePath]))) return
    closeTab(filePath)
    setMenu(null)
  }

  const closeOthers = async (filePath: string) => {
    const targets = openTabs.filter(path => path !== filePath)
    if (!(await requestUnsavedDocumentAction(targets))) return
    closeOtherTabs(filePath)
    setMenu(null)
  }

  const closeAll = async () => {
    if (!(await requestUnsavedDocumentAction(openTabs))) return
    closeAllTabs()
    setMenu(null)
  }

  if (openTabs.length === 0) return <div className="tabbar" />

  return (
    <div className="tabbar">
      {openTabs.map(filePath => {
        const ext = filePath.split('.').pop() ?? ''
        const name = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? filePath
        const kind = FILE_KIND[ext] ?? { icon: Ic.fileScene, color: 'var(--accent)' }
        const dirty = dirtySet.has(filePath) || changes.has(filePath)
        const active = filePath === activeFile

        return (
          <div
            key={filePath}
            ref={active ? activeTabRef : undefined}
            className={`tab${active ? ' on' : ''}`}
            onClick={() => setActive(filePath)}
            onContextMenu={event => openMenu(event, filePath)}
            title={filePath}
          >
            <span className="tab-ico" style={{ color: kind.color }}>
              <kind.icon width={14} height={14} />
            </span>
            <span className="tab-name">
              {name}<span className="tab-ext">.{ext}</span>
            </span>
            <button
              className={`tab-close${dirty ? ' dirty' : ''}`}
              onClick={e => { e.stopPropagation(); void closeCurrent(filePath) }}
              title="关闭"
            >
              <span className="tab-dirty-dot" />
              <Ic.x width={12} height={12} />
            </button>
          </div>
        )
      })}
      {menu && (
        <div className="tree-menu tab-menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
          <button onClick={() => { void closeCurrent(menu.filePath) }}>关闭</button>
          <button disabled={openTabs.length <= 1} onClick={() => { void closeOthers(menu.filePath) }}>关闭其他</button>
          <button disabled={openTabs.length === 0} onClick={() => { void closeAll() }}>关闭所有</button>
        </div>
      )}
    </div>
  )
}
