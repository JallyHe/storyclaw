import { useEffect, useLayoutEffect, useState } from 'react'
import { requestUnsavedDocumentAction, useEditorSaveStore, useUiStore, useTabsStore, useWorkspaceStore, useSessionsStore } from '@/store'
import { imIpc } from '@/ipc/im'
import { Titlebar } from '@/components/shell/Titlebar'
import { ActivityBar } from '@/components/shell/ActivityBar'
import { ResizeHandle } from '@/components/shell/ResizeHandle'
import { Explorer } from '@/components/explorer/Explorer'
import { SearchPanel } from '@/components/explorer/SearchPanel'
import { ScmPanel } from '@/components/explorer/ScmPanel'
import { WelcomeScreen, addRecentProject } from '@/components/shell/WelcomeScreen'
import { TabBar } from '@/components/tabs/TabBar'
import { Breadcrumb } from '@/components/tabs/Breadcrumb'
import { FileEditor } from '@/components/editors/FileEditor'
import { Copilot } from '@/components/copilot/Copilot'
import { AgentView } from '@/components/agent/AgentView'
import { Wizard } from '@/components/wizard/Wizard'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { useAgentPersistence } from '@/hooks/useAgentPersistence'
import { updateEditorKeepAliveList } from '@/components/editors/editorKeepAlive'

export default function App() {
  useAgentPersistence()
  const {
    theme, view, leftOpen, rightOpen, leftPanel,
    explorerWidth, setExplorerWidth,
    copilotWidth, setCopilotWidth
  } = useUiStore()
  const activeFile = useTabsStore(s => s.activeFile)
  const openTabs = useTabsStore(s => s.openTabs)
  const root = useWorkspaceStore(s => s.root)
  const [showWizard, setShowWizard] = useState(false)
  const [mountedEditors, setMountedEditors] = useState<string[]>([])

  // track recently opened workspaces
  useEffect(() => {
    if (root) addRecentProject(root)
  }, [root])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useLayoutEffect(() => {
    setMountedEditors(current => updateEditorKeepAliveList(current, activeFile, openTabs))
  }, [activeFile, openTabs])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (!isSave || !activeFile) return
      event.preventDefault()
      void useEditorSaveStore.getState().saveDocument(activeFile)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeFile])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (useWorkspaceStore.getState().dirtySet.size === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    return window.api?.window.onCloseRequest?.(async () => {
      const tabs = useTabsStore.getState().openTabs
      if (await requestUnsavedDocumentAction(tabs)) {
        await window.api?.window.confirmClose?.()
      }
    })
  }, [])

  // 全局订阅机器人会话事件：并入现有会话列表（标记为 imbot，桌面端只读）
  useEffect(() => {
    return imIpc.onMessage(event => useSessionsStore.getState().ingestImEvent(event))
  }, [])

  // 机器人会话记录：启动时加载历史，变化时防抖全局保存（与工作区无关）
  useEffect(() => {
    imIpc.loadConversations()
      .then(saved => { if (saved.length) useSessionsStore.getState().restoreImSessions(saved) })
      .catch(() => {})

    let timer: ReturnType<typeof setTimeout> | null = null
    let last = ''
    const unsub = useSessionsStore.subscribe(() => {
      const imbot = useSessionsStore.getState().sessions.filter(s => s.kind === 'imbot')
      const serialized = JSON.stringify(imbot)
      if (serialized === last) return
      last = serialized
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void imIpc.saveConversations(imbot) }, 400)
    })
    return () => { if (timer) clearTimeout(timer); unsub() }
  }, [])

  // show welcome screen when no workspace is open
  const showWelcome = !root

  return (
    <div className="app">
      <Titlebar onNewProject={() => setShowWizard(true)} />
      <div className="body">
        {view === 'editor' && (
          <>
            <ActivityBar />

            {/* Left panel */}
            {leftOpen && (
              <>
                {leftPanel === 'explorer' && (
                  <Explorer width={explorerWidth} />
                )}
                {leftPanel === 'search' && (
                  <SearchPanel width={explorerWidth} />
                )}
                {leftPanel === 'scm' && (
                  <ScmPanel width={explorerWidth} />
                )}
                <ResizeHandle
                  width={explorerWidth}
                  setWidth={setExplorerWidth}
                  edge="right"
                  min={200}
                  max={480}
                />
              </>
            )}

            {/* Main editor area */}
            <div className="editor-wrap">
              {showWelcome ? (
                <WelcomeScreen onNewProject={() => setShowWizard(true)} />
              ) : (
                <>
                  <TabBar />
                  <Breadcrumb />
                  {activeFile
                    ? mountedEditors.map(filePath => (
                        <div
                          key={filePath}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            display: filePath === activeFile ? 'flex' : 'none',
                            flexDirection: 'column'
                          }}
                        >
                          <FileEditor filePath={filePath} />
                        </div>
                      ))
                    : (
                      <div className="empty-editor">
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 13, marginBottom: 6 }}>从左侧文件树打开文件</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            支持 .ep · .chr · .md · 项目设定
                          </div>
                        </div>
                      </div>
                    )
                  }
                </>
              )}
            </div>

            {/* Right copilot */}
            {rightOpen && !showWelcome && (
              <>
                <ResizeHandle
                  width={copilotWidth}
                  setWidth={setCopilotWidth}
                  edge="left"
                  min={320}
                  max={560}
                />
                <Copilot width={copilotWidth} />
              </>
            )}
          </>
        )}

        {view === 'agent' && <AgentView />}
      </div>

      {showWizard && (
        <Wizard onClose={() => setShowWizard(false)} />
      )}

      <SettingsModal />
    </div>
  )
}
