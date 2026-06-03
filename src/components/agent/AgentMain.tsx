import { useRef, useEffect } from 'react'
import { useSessionsStore, useWorkspaceStore } from '@/store'
import { Message } from '@/components/copilot/Message'
import { AgentComposer, type AgentComposerHandle } from '@/components/copilot/AgentComposer'
import { Ic } from '@/components/icons'
import storyclawLogo from '@/assets/storyclaw-logo.png'

const SUGGEST = [
  { id: 'continue',    t: '续写当前场景',   d: '我会先问你想要的基调，再把这场写下去。',               color: 'var(--accent)',    icon: Ic.feather, prompt: '请续写当前场景，保持人物语气和既有情节连贯。' },
  { id: 'breakdown',   t: '拆解本集（技能）', d: '调用 script-breakdown，分析场景与拍摄要素。',          color: 'var(--c-role)',    icon: Ic.scissors, prompt: '请拆解本集剧本，分析场景、人物行动、冲突推进和拍摄要素。' },
  { id: 'fromOutline', t: '据大纲续一场',   d: '读分集大纲，在对应剧集文档里续写新的一场。',             color: 'var(--c-outline)', icon: Ic.fileScene, prompt: '请根据分集大纲续写下一场剧本，并写入对应剧集文档。' },
  { id: 'plot',        t: '梳理全剧情节',   d: '分析三集结构、悬念曲线，给出修改建议。',                 color: 'var(--accent-ai)', icon: Ic.compass, prompt: '请梳理全剧情节，分析结构、悬念曲线、人物动机和可修改建议。' },
]

export function AgentMain() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<AgentComposerHandle>(null)
  const { sessions, activeId } = useSessionsStore()
  const root = useWorkspaceStore(s => s.root)
  const session = sessions.find(s => s.id === activeId)
  const messages = session?.messages ?? []
  const lastMsg = messages.at(-1)
  const busy = Boolean(lastMsg?.role === 'assistant' && lastMsg.typing)
  const empty = messages.length === 0
  const wsTitle = root ? root.split(/[\\/]/).pop() ?? '' : ''
  const isImbot = session?.kind === 'imbot'
  const platformLabel = ({ dingtalk: '钉钉', feishu: '飞书', wechat: '企微' } as Record<string, string>)[session?.platform ?? ''] ?? '机器人'

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="agent-main">
      <div className="agent-scroll" ref={scrollRef}>
        <div className="agent-hero">
          {empty ? (
            <div>
              <div className="agent-spark">
                <img src={storyclawLogo} alt="" />
              </div>
              <h1 className="agent-title">今晚想写哪一场？</h1>
              <p className="agent-sub">
                {root
                  ? `我已读取《${wsTitle}》工作区，告诉我你的想法，或从下面开始。`
                  : '请先打开工作区，再开始创作。'
                }
              </p>
              <div className="suggest-grid">
                {SUGGEST.map(s => (
                  <button key={s.id} className="suggest-card" disabled={busy} onClick={() => composerRef.current?.setText(s.prompt)}>
                    <div className="sc-i" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>
                      <s.icon width={16} height={16} />
                    </div>
                    <div className="sc-t">{s.t}</div>
                    <div className="sc-d">{s.d}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="agent-thread">
              {messages.map((m, i) => <Message key={i} m={m} sessionId={session?.id ?? ''} index={i} />)}
            </div>
          )}
        </div>
      </div>
      {isImbot ? (
        <div className="imbot-readonly-bar">
          <Ic.robot width={15} height={15} />
          <span>来自 {platformLabel} · {session?.peerName}：桌面端仅查看，回复请在 {platformLabel} 中进行。</span>
        </div>
      ) : (
        <div className="agent-composer-wrap">
          <div className="agent-composer">
            <AgentComposer
              ref={composerRef}
              busy={busy}
              placeholder="描述你想做的事；/ 调用技能，@ 引用文件…"
              big
            />
          </div>
        </div>
      )}
    </div>
  )
}
