import type { BrowserWindow } from 'electron'

const TOOL_LABELS: Record<string, string> = {
  read_screenplay:  '读取剧本文件',
  read_selection:   '读取选区文本',
  write_screenplay: '修改剧本文件',
  list_workspace:   '列出工作区',
  read_reference:   '读取参考资料',
  bash:             '执行终端命令',
  fetch_url:        '访问网页',
  spawn_subagent:   '调度阶段子代理'
}

export function setupStreaming(session: any, win: BrowserWindow, sessionId: string): () => void {
  let textReceived = false
  // Track whether the thinking indicator has been shown this turn,
  // so we only fire thinking_end once on the first real content event.
  let thinkingActive = false

  function endThinking() {
    if (!thinkingActive) return
    thinkingActive = false
    win.webContents.send('agent:event', { sessionId, type: 'thinking_end' })
  }

  return session.subscribe((event: any) => {
    console.log('[Pi Agent]', event.type)
    switch (event.type) {
      // ── Agent start ─────────────────────────────────────────────────────────
      case 'agent_start':
        textReceived = false
        thinkingActive = false
        break

      // ── Turn start: show "thinking" indicator ───────────────────────────────
      case 'turn_start':
        thinkingActive = true
        win.webContents.send('agent:event', { sessionId, type: 'thinking_start' })
        break

      // ── Text streaming ──────────────────────────────────────────────────────
      case 'message_update': {
        const ae = event.assistantMessageEvent
        if (ae?.type === 'text_delta') {
          endThinking()
          textReceived = true
          win.webContents.send('agent:event', { sessionId, type: 'text_delta', delta: ae.delta })
        } else if (ae?.type === 'thinking_delta') {
          // Forward reasoning deltas so the UI shows the model is actively working
          if (typeof ae.delta === 'string' && ae.delta) {
            win.webContents.send('agent:event', { sessionId, type: 'thinking_delta', delta: ae.delta })
          }
        } else {
          console.log('[Pi Agent] message_update assistantMessageEvent:', ae?.type, JSON.stringify(ae ?? event).slice(0, 200))
        }
        break
      }

      // ── Tool execution ───────────────────────────────────────────────────────
      case 'tool_execution_start':
        endThinking()
        win.webContents.send('agent:event', { sessionId,
          type: 'tool_start',
          tool: event.toolName,
          label: TOOL_LABELS[event.toolName] ?? event.toolName,
          // args is the correct field (not toolInput) per SDK types
          target: event.args?.path ?? event.args?.query ?? event.args?.command ?? event.args?.url ?? ''
        })
        break

      case 'tool_execution_end':
        win.webContents.send('agent:event', { sessionId,
          type: 'tool_end',
          tool: event.toolName,
          isError: !!event.isError
        })
        break

      // ── Agent lifecycle ──────────────────────────────────────────────────────
      case 'agent_end': {
        // willRetry means the session will immediately start another run (auto-retry).
        // Don't finalize the UI yet — wait for the final agent_end.
        if (event.willRetry) {
          console.log('[Pi Agent] agent_end willRetry=true, waiting for retry')
          break
        }

        // If the entire run produced no text, try to surface an error message
        // from agent state so the user isn't left with an empty reply.
        if (!textReceived) {
          const errMsg: string | undefined = session?.state?.errorMessage
          if (errMsg) {
            win.webContents.send('agent:event', { sessionId, type: 'text_delta', delta: `⚠️ ${errMsg}` })
          }
        }

        textReceived = false  // reset for next run
        win.webContents.send('agent:event', { sessionId, type: 'agent_end' })
        break
      }

      // ── Auto-retry ──────────────────────────────────────────────────────────
      case 'auto_retry_start':
        console.log('[Pi Agent] auto_retry_start attempt', event.attempt, '/', event.maxAttempts, '—', event.errorMessage)
        break

      case 'auto_retry_end':
        if (!event.success) {
          const errText = event.finalError ?? '请求失败，已达最大重试次数。'
          console.log('[Pi Agent] auto_retry_end failed:', errText)
          // The error text will be shown via agent_end handler above (errMsg from session state),
          // but send it here too as a belt-and-suspenders in case state isn't populated yet.
          if (!textReceived) {
            win.webContents.send('agent:event', { sessionId, type: 'text_delta', delta: `⚠️ ${errText}` })
            textReceived = true  // prevent double-send when agent_end also fires
          }
        }
        break

      // ── Turn end: extract error from failed assistant messages ───────────────
      case 'turn_end': {
        const msg = event.message
        // If the assistant message came back with no content and an error stop reason,
        // grab the errorMessage and push it to the UI so the user sees something useful.
        if (msg?.role === 'assistant' && !textReceived) {
          const stopReason: string = msg.stopReason ?? ''
          if (stopReason === 'error' || stopReason === 'aborted' || stopReason === 'cancelled') {
            const errText: string = msg.errorMessage ?? `模型请求失败（stopReason: ${stopReason}）`
            console.log('[Pi Agent] turn_end error:', errText)
            win.webContents.send('agent:event', { sessionId, type: 'text_delta', delta: `⚠️ ${errText}` })
            textReceived = true
          }
        }
        break
      }

      // ── Queue / session state ────────────────────────────────────────────────
      case 'queue_update':
        win.webContents.send('agent:event', { sessionId,
          type: 'queue_update',
          steering: event.steering,
          followUp: event.followUp
        })
        break

      case 'compaction_start':
      case 'compaction_end':
      case 'session_info_changed':
      case 'thinking_level_changed':
      case 'message_start':
      case 'message_end':
      case 'tool_execution_update':
        // intentionally ignored
        break

      default:
        console.log('[Pi Agent] unhandled event:', JSON.stringify(event).slice(0, 500))
    }
  })
}
