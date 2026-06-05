import { useEffect, useRef } from 'react'
import { useSessionsStore, useChangesStore, useWorkspaceStore } from '@/store'
import { agentIpc } from '@/ipc/agent'
import type { AgentEvent } from '@/types'

/** 专家子代理 → 中文展示名。 */
const STAGE_LABELS: Record<string, string> = {
  'concept-planner': '选题策划',
  'market-analyst': '市场评估',
  'ip-developer': 'IP衍生',
  'research-analyst': '资料研究',
  'worldbuilder': '世界观设定',
  'character-designer': '人物设定',
  'story-architect': '故事架构',
  'episode-outliner': '分集大纲',
  'scene-writer': '场景编剧',
  'dialogue-polisher': '对白润色',
  'chief-editor': '责编',
  'logic-checker': '逻辑校对',
  'drama-reviewer': '戏剧冲突',
  'compliance-reviewer': '合规风控',
  'feasibility-analyst': '制片可行性'
}

export function useAgentEvents() {
  const { appendDelta, addToolStep, addPermissionStep, completeToolStep, appendThinking, finalizeReply } = useSessionsStore()
  const { addChange } = useChangesStore()
  const invalidateFile = useWorkspaceStore(s => s.invalidateFile)
  // Keep a ref to activeId so the event handler can fall back to it if an event
  // arrives without a sessionId (e.g. from older code paths or permission errors).
  const activeIdRef = useRef(useSessionsStore.getState().activeId)
  useEffect(() => useSessionsStore.subscribe(s => { activeIdRef.current = s.activeId }), [])

  useEffect(() => {
    const unsub = agentIpc.onEvent((rawEvent: AgentEvent) => {
      const event = rawEvent as AgentEvent & { sessionId?: string }
      const sid = event.sessionId ?? activeIdRef.current

      switch (event.type) {
        case 'text_delta':
          appendDelta(sid, event.delta)
          break

        case 'thinking_start':
          addToolStep(sid, 'thinking', '正在思考…', '')
          break
        case 'thinking_delta':
          appendThinking(sid, event.delta)
          break
        case 'thinking_end':
          completeToolStep(sid, 'thinking', false)
          break

        case 'tool_start':
          addToolStep(sid, event.tool, event.label, event.target)
          break
        case 'tool_end':
          completeToolStep(sid, event.tool, event.isError)
          break

        case 'file_written': {
          const name = event.fileId.split(/[\\/]/).pop() ?? ''
          addToolStep(sid, 'file_written', '文件已更新', name)
          completeToolStep(sid, 'file_written', false)
          invalidateFile(event.fileId)
          addChange({ fileId: event.fileId, diffBlocks: [], applied: true, summary: '已更新（Markdown）' })
          break
        }

        case 'change':
          addChange({ fileId: event.fileId, diffBlocks: event.diffBlocks, newContent: event.newContent })
          break

        case 'permission_request':
          addPermissionStep(sid, event)
          break

        case 'queue_update':
          break

        case 'subagent_start':
          addToolStep(sid, `subagent:${event.agent}`, `调度子代理：${STAGE_LABELS[event.agent] ?? event.agent}`, '')
          break
        case 'subagent_end':
          completeToolStep(sid, `subagent:${event.agent}`, false)
          break

        case 'agent_end':
          finalizeReply(sid)
          break
      }
    })
    return unsub
  }, [appendDelta, addToolStep, addPermissionStep, completeToolStep, appendThinking, finalizeReply, addChange, invalidateFile])
}
