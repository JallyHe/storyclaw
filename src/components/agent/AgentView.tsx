import { useUiStore } from '@/store'
import { useAgentEvents } from '@/hooks/useAgentEvents'
import { SessionList } from './SessionList'
import { AgentMain } from './AgentMain'
import { ChangesPanel } from './ChangesPanel'
import { ResizeHandle } from '@/components/shell/ResizeHandle'

export function AgentView() {
  useAgentEvents()
  const { leftOpen, rightOpen, sessionsWidth, setSessionsWidth, changesWidth, setChangesWidth } = useUiStore()
  return (
    <div className="agent-view">
      {leftOpen && (
        <>
          <SessionList width={sessionsWidth} />
          <ResizeHandle width={sessionsWidth} setWidth={setSessionsWidth} edge="right" min={200} max={420} />
        </>
      )}
      <AgentMain />
      {rightOpen && (
        <>
          <ResizeHandle width={changesWidth} setWidth={setChangesWidth} edge="left" min={260} max={520} />
          <ChangesPanel width={changesWidth} />
        </>
      )}
    </div>
  )
}
