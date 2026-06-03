import { useEffect, useState } from 'react'
import { useUiStore, useTabsStore, useWorkspaceStore, useImBotStore } from '@/store'
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
import { IMBotPanel } from '@/components/imbot/IMBotPanel'
import { Wizard } from '@/components/wizard/Wizard'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { useAgentPersistence } from '@/hooks/useAgentPersistence'

export default function App() {
  useAgentPersistence()
  const {
    theme, view, leftOpen, rightOpen, leftPanel,
    explorerWidth, setExplorerWidth,
    copilotWidth, setCopilotWidth
  } = useUiStore()
  const activeFile = useTabsStore(s => s.activeFile)
  const root = useWorkspaceStore(s => s.root)
  const [showWizard, setShowWizard] = useState(false)

  // track recently opened workspaces
  useEffect(() => {
    if (root) addRecentProject(root)
  }, [root])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 全局订阅机器人会话事件（即使面板未打开也持续收集）
  useEffect(() => {
    return imIpc.onMessage(event => useImBotStore.getState().push(event))
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
                {leftPanel === 'imbot' && (
                  <IMBotPanel width={explorerWidth} />
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
                    ? <FileEditor key={activeFile} filePath={activeFile} />
                    : (
                      <div className="empty-editor">
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 13, marginBottom: 6 }}>从左侧文件树打开文件</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            支持 .ep · .chr · .md · .wld
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
