import { useEffect, useRef, useState } from 'react'
import { requestUnsavedDocumentAction, useUiStore, useWorkspaceStore } from '@/store'
import { useTabsStore } from '@/store'
import { workspaceIpc } from '@/ipc/workspace'
import { Ic } from '@/components/icons'
import storyclawLogo from '@/assets/storyclaw-logo.png'
import type { UpdateSnapshot } from '@/types'

type MenuItem = {
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  onSelect?: () => void
}

type MenuGroup = {
  id: string
  label: string
  items: MenuItem[]
}

export function Titlebar({ onNewProject }: { onNewProject?: () => void }) {
  const {
    view, setView, theme, setTheme,
    toggleLeft, toggleRight, leftOpen, rightOpen,
    leftPanel, setLeftPanel, openSettings
  } = useUiStore()
  const { root, openWorkspace, closeWorkspace } = useWorkspaceStore()
  const activeFile = useTabsStore(s => s.activeFile)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [appVersion, setAppVersion] = useState('0.0.0')
  const [updateStatus, setUpdateStatus] = useState<UpdateSnapshot | null>(null)
  const [dismissedUpdateNotice, setDismissedUpdateNotice] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const platform = window.api?.app.platform ?? 'win32'
  const isMac = platform === 'darwin'

  const title = root ? root.split(/[\\/]/).pop() ?? 'StoryClaw' : 'StoryClaw'
  const fileTitle = activeFile ? activeFile.split(/[\\/]/).pop() : '未打开文件'
  const isScreenplayFile = activeFile?.toLowerCase().endsWith('.ep') ?? false
  const canUseAgent = Boolean(root)

  const handleOpen = async () => {
    const dir = await workspaceIpc.openDialog()
    if (dir) openWorkspace(dir)
  }

  const exportStory = () => {
    if (!activeFile || !isScreenplayFile) return
    void workspaceIpc.exportStory(activeFile)
  }

  const handleCloseWorkspace = async () => {
    const tabs = useTabsStore.getState().openTabs
    if (!(await requestUnsavedDocumentAction(tabs))) return
    await closeWorkspace()
    setView('editor')
  }

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }

    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    let removeUpdaterListener: (() => void) | undefined

    window.api?.app.getVersion()
      .then(setAppVersion)
      .catch(() => {})

    window.api?.updater.getStatus()
      .then(setUpdateStatus)
      .catch(() => {})

    removeUpdaterListener = window.api?.updater.onStatus(setUpdateStatus)
    return () => removeUpdaterListener?.()
  }, [])

  useEffect(() => {
    let removeListener: (() => void) | undefined

    window.api?.window.isMaximized()
      .then(setIsMaximized)
      .catch(() => setIsMaximized(false))

    removeListener = window.api?.window.onMaximizedChange(setIsMaximized)
    return () => removeListener?.()
  }, [])

  const runMenuAction = (item: MenuItem) => {
    if (item.disabled) return
    setOpenMenu(null)
    item.onSelect?.()
  }

  const windowControls = {
    minimize: () => { void window.api?.window.minimize() },
    toggleMaximize: () => {
      window.api?.window.toggleMaximize()
        .then(setIsMaximized)
        .catch(() => {})
    },
    close: () => { void window.api?.window.close() }
  }

  const checkUpdates = () => {
    setDismissedUpdateNotice('')
    void window.api?.updater.check().then(setUpdateStatus)
  }

  const installUpdates = () => {
    void window.api?.updater.install()
  }

  const updateNoticeKey = updateStatus
    ? `${updateStatus.status}:${updateStatus.latestVersion ?? ''}:${updateStatus.message ?? ''}:${updateStatus.progress ?? ''}`
    : ''
  const showUpdateNotice = Boolean(updateStatus && updateStatus.status !== 'idle' && updateNoticeKey !== dismissedUpdateNotice)

  const menus: MenuGroup[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        { label: '新建项目', shortcut: 'Ctrl+Shift+N', disabled: !onNewProject, onSelect: onNewProject },
        { label: '打开文件夹...', shortcut: 'Ctrl+O', onSelect: () => { void handleOpen() } },
        { label: '保存当前文件', shortcut: 'Ctrl+S', disabled: true },
        { divider: true, label: 'divider-file' },
        { label: '导出剧本...', disabled: !isScreenplayFile, onSelect: exportStory },
        { divider: true, label: 'divider-file-settings' },
        { label: '设置...', shortcut: 'Ctrl+,', onSelect: () => openSettings() },
        { label: '关闭工作区', disabled: !root, onSelect: () => { void handleCloseWorkspace() } }
      ]
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        { label: '撤销', shortcut: 'Ctrl+Z', disabled: true },
        { label: '重做', shortcut: 'Ctrl+Y', disabled: true },
        { divider: true, label: 'divider-edit' },
        { label: '查找', shortcut: 'Ctrl+F', onSelect: () => setLeftPanel('search') },
        { label: '全局替换', disabled: true }
      ]
    },
    {
      id: 'view',
      label: '视图',
      items: [
        { label: view === 'editor' ? '切换到 Agent' : '切换到编辑器', shortcut: 'Ctrl+`', disabled: view === 'editor' && !canUseAgent, onSelect: () => setView(view === 'editor' ? 'agent' : 'editor') },
        { label: leftOpen ? '隐藏左侧栏' : '显示左侧栏', shortcut: 'Ctrl+B', onSelect: toggleLeft },
        { label: rightOpen ? '隐藏 Copilot' : '显示 Copilot', onSelect: toggleRight },
        { divider: true, label: 'divider-view' },
        { label: theme === 'dark' ? '切换浅色主题' : '切换深色主题', onSelect: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
      ]
    },
    {
      id: 'screenplay',
      label: '剧本',
      items: [
        { label: '插入场次头', shortcut: 'Ctrl+Enter', disabled: !activeFile },
        { label: '切换为动作段落', disabled: !activeFile },
        { label: '切换为对白', disabled: !activeFile },
        { divider: true, label: 'divider-script' },
        { label: '分页预览', disabled: !activeFile },
        { label: '场次导航', onSelect: () => setLeftPanel('explorer') }
      ]
    },
    {
      id: 'agent',
      label: 'Agent',
      items: [
        { label: '打开 Agent 工作台', disabled: !canUseAgent, onSelect: () => setView('agent') },
        { label: rightOpen ? '隐藏 Copilot' : '显示 Copilot', onSelect: toggleRight },
        { divider: true, label: 'divider-agent' },
        { label: '续写本场', disabled: !activeFile },
        { label: '一致性检查', disabled: !root }
      ]
    },
    {
      id: 'help',
      label: '帮助',
      items: [
        { label: '命令面板', shortcut: 'Ctrl+Shift+P', disabled: true },
        { label: '快捷键参考', disabled: true },
        { label: '开发者工具', shortcut: isMac ? 'Cmd+Option+I' : 'F12', onSelect: () => { void window.api?.window.toggleDevTools() } },
        { divider: true, label: 'divider-help' },
        { label: '检查更新', onSelect: checkUpdates },
        { label: '安装已下载更新', disabled: updateStatus?.status !== 'downloaded', onSelect: installUpdates },
        { divider: true, label: 'divider-help-version' },
        { label: `关于 StoryClaw v${appVersion}`, disabled: true }
      ]
    }
  ]

  const switchView = (nextView: typeof view) => {
    if (nextView === 'agent' && !canUseAgent) return
    setView(nextView)
  }

  return (
    <div className={`titlebar platform-${platform}`}>
      <div className="tb-left">
        <div className="tb-mark" title="StoryClaw">
          <img src={storyclawLogo} alt="" />
        </div>
        <div className="tb-menu" ref={menuRef}>
          {menus.map(menu => (
            <div className="tb-menu-slot" key={menu.id}>
              <button
                className={`tb-menu-btn${openMenu === menu.id ? ' on' : ''}`}
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                onMouseEnter={() => { if (openMenu) setOpenMenu(menu.id) }}
              >
                {menu.label}
              </button>
              {openMenu === menu.id && (
                <div className="tb-menu-pop">
                  {menu.items.map((item, index) => item.divider ? (
                    <div className="tb-menu-divider" key={`${menu.id}-${index}`} />
                  ) : (
                    <button
                      key={item.label}
                      className={`tb-menu-item${item.disabled ? ' disabled' : ''}${item.danger ? ' danger' : ''}`}
                      disabled={item.disabled}
                      onClick={() => runMenuAction(item)}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <kbd>{item.shortcut}</kbd>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="tb-center">
        <button className="tb-command" title="命令面板">
          <Ic.search width={14} height={14} />
          <span className="tb-command-main">{fileTitle}</span>
          <span className="tb-command-sub">
            {root ? `《${title}》` : '打开项目开始创作'}
          </span>
        </button>
      </div>

      <div className="tb-right">
        <div className="viewseg">
          <button className={view === 'editor' ? 'on' : ''} onClick={() => switchView('editor')}>
            <Ic.split width={14} height={14} /> 编辑器
          </button>
          <button className={view === 'agent' ? 'on' : ''} disabled={!canUseAgent} title={canUseAgent ? 'Agent' : '请先打开项目'} onClick={() => switchView('agent')}>
            <Ic.spark width={14} height={14} /> Agent
          </button>
        </div>
        <button className="tb-icon" title="切换主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Ic.sun width={16} height={16} /> : <Ic.moon width={16} height={16} />}
        </button>
        <span className="tb-vsep" />
        <button className={`tb-icon${leftOpen ? ' on' : ''}`} title="显示/隐藏左侧栏" onClick={toggleLeft}>
          <Ic.panelLeft width={16} height={16} />
        </button>
        <button className={`tb-icon${rightOpen ? ' on' : ''}`} title="显示/隐藏右侧栏" onClick={toggleRight}>
          <Ic.panelRight width={16} height={16} />
        </button>
        {!isMac && (
          <div className="window-controls" aria-label="窗口控制">
            <button className="win-btn" title="最小化" onClick={windowControls.minimize} aria-label="最小化">
              <span className="win-min" />
            </button>
            <button
              className="win-btn"
              title={isMaximized ? '还原' : '最大化'}
              onClick={windowControls.toggleMaximize}
              aria-label={isMaximized ? '还原' : '最大化'}
            >
              <span className={isMaximized ? 'win-restore' : 'win-max'} />
            </button>
            <button className="win-btn close" title="关闭" onClick={windowControls.close} aria-label="关闭">
              <span className="win-close" />
            </button>
          </div>
        )}
      </div>
      {showUpdateNotice && (
        <div className={`update-toast ${updateStatus.status}`}>
          <span className="update-toast-dot" />
          <span className="update-toast-text">{updateStatus.message ?? '更新状态已变更'}</span>
          {updateStatus.status === 'downloaded' && (
            <button type="button" onClick={installUpdates}>安装</button>
          )}
          <button
            type="button"
            className="update-toast-close"
            title="关闭"
            aria-label="关闭更新提示"
            onClick={() => setDismissedUpdateNotice(updateNoticeKey)}
          >
            <Ic.x width={13} height={13} />
          </button>
        </div>
      )}
    </div>
  )
}
