import { useLayoutEffect, useState, useMemo, useRef } from 'react'
import { marked, Renderer } from 'marked'
import type { Message as MessageType, ToolStep } from '@/types'
import { Ic } from '@/components/icons'
import { useSessionsStore } from '@/store'
import storyclawLogo from '@/assets/storyclaw-logo.png'

// ── Markdown renderer ────────────────────────────────────────────────────────

const renderer = new Renderer()
// Open links in the system browser (Electron)
renderer.link = ({ href, title, text }) =>
  `<a href="${href ?? ''}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`

marked.use({ renderer, gfm: true, breaks: true })

function MarkdownBody({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(
    () => marked.parse(text, { async: false }) as string,
    [text]
  )
  return (
    <div
      className={`md-body${streaming ? ' streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── User message token renderer ─────────────────────────────────────────────
// The serialized text contains raw tokens like `@agent:name`, `@skill:name`,
// `@/path/to/file.ep`. Parse and render them as inline chips.

type MsgSegment =
  | { t: 'text';  v: string }
  | { t: 'agent'; v: string }
  | { t: 'skill'; v: string }
  | { t: 'file';  v: string }

// Single tokenizer that recognises the three chip token forms (which may contain
// spaces, e.g. a bracketed file path) plus plain text in between.
//  - @[相对/路径 含空格.pdf]   → file
//  - @agent:id|中文标题         → agent
//  - @skill:id|中文标题         → skill
const TOKEN_RE = /@\[([^\]]+)\]|@agent:([^\s|]+)(?:\|(\S+))?|@skill:([^\s|]+)(?:\|(\S+))?/g

function parseUserText(raw: string): MsgSegment[] {
  const segs: MsgSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(raw)) !== null) {
    if (m.index > last) segs.push({ t: 'text', v: raw.slice(last, m.index) })
    if (m[1] !== undefined) {
      // file: show only the basename
      const basename = m[1].replace(/[\\/]+$/, '').replace(/\\/g, '/').split('/').pop() ?? m[1]
      segs.push({ t: 'file', v: basename })
    } else if (m[2] !== undefined) {
      segs.push({ t: 'agent', v: m[3] ?? m[2] })
    } else if (m[4] !== undefined) {
      segs.push({ t: 'skill', v: m[5] ?? m[4] })
    }
    last = TOKEN_RE.lastIndex
  }
  if (last < raw.length) segs.push({ t: 'text', v: raw.slice(last) })
  return segs
}

function UserBubble({ text }: { text: string }) {
  const segs = useMemo(() => parseUserText(text), [text])
  return (
    <div className="bubble-user">
      {segs.map((seg, i) => {
        if (seg.t === 'text') return <span key={i}>{seg.v}</span>
        if (seg.t === 'agent') return (
          <span key={i} className="msg-chip agent">
            <Ic.robot width={10} height={10} />{seg.v}
          </span>
        )
        if (seg.t === 'skill') return (
          <span key={i} className="msg-chip skill">
            <Ic.wand width={10} height={10} />{seg.v}
          </span>
        )
        // file
        return (
          <span key={i} className="msg-chip file">
            <Ic.fileScene width={10} height={10} />{seg.v}
          </span>
        )
      })}
    </div>
  )
}

// ── Tool step row ────────────────────────────────────────────────────────────

const TOOL_ICO: Record<string, React.FC<any>> = {
  read_screenplay:  Ic.read,
  read_selection:   Ic.read,
  read_reference:   Ic.read,
  list_workspace:   Ic.list,
  write_screenplay: Ic.edit,
  file_written:     Ic.edit,
  thinking:         Ic.spark,
  search:           Ic.search,
}

const TOOL_COLOR: Record<string, string> = {
  read_screenplay:  'var(--accent)',
  read_selection:   'var(--accent)',
  read_reference:   'var(--accent)',
  list_workspace:   'var(--text-2)',
  write_screenplay: 'var(--accent-ai)',
  file_written:     'var(--accent-ai)',
  thinking:         'var(--accent-ai)',
  search:           'var(--c-outline)',
}

function StepRow({ step }: { step: ToolStep }) {
  const IcoComp = TOOL_ICO[step.kind] ?? Ic.read
  const color   = TOOL_COLOR[step.kind] ?? 'var(--text-2)'
  const pending = step.isError === undefined
  const isError = step.isError === true
  const isThinking = step.kind === 'thinking'
  const [showThinking, setShowThinking] = useState(false)
  const thinkingRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!showThinking) return
    const el = thinkingRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [showThinking, step.thinking])

  return (
    <>
      <div
        className={`step-row${isError ? ' err' : pending ? ' pend' : ' ok'}${isThinking && step.thinking ? ' has-thinking' : ''}`}
        onClick={isThinking && step.thinking ? () => setShowThinking(v => !v) : undefined}
        style={isThinking && step.thinking ? { cursor: 'pointer' } : undefined}
      >
        {/* status badge */}
        <span className="step-status">
          {pending ? (
            <span className="step-spin" />
          ) : isError ? (
            <Ic.x width={10} height={10} />
          ) : (
            <Ic.check width={10} height={10} />
          )}
        </span>

        {/* tool icon */}
        <span className="step-tool-ico" style={{ color }}>
          <IcoComp width={13} height={13} />
        </span>

        {/* label */}
        <span className="step-lbl">{step.label}</span>

        {/* target path / query */}
        {!isThinking && step.target && (
          <span className="step-tgt" title={step.target}>
            {step.target.length > 40 ? `…${step.target.slice(-38)}` : step.target}
          </span>
        )}

        {/* expand chevron for thinking */}
        {isThinking && step.thinking && (
          <Ic.chevD
            width={10}
            height={10}
            className={`step-think-chev${showThinking ? ' open' : ''}`}
            style={{ color: 'var(--text-3)', flex: 'none' }}
          />
        )}
      </div>

      {/* thinking content panel */}
      {isThinking && showThinking && step.thinking && (
        <div className="step-thinking-body">
          <div ref={thinkingRef} className="step-thinking-text">{step.thinking}</div>
        </div>
      )}
    </>
  )
}

// ── Step list with toggle ────────────────────────────────────────────────────

function StepList({ steps, busy }: { steps: ToolStep[]; busy: boolean }) {
  const [open, setOpen] = useState(true)
  const doneCount  = steps.filter(s => s.isError !== undefined).length
  const errorCount = steps.filter(s => s.isError === true).length

  return (
    <div className="step-list">
      {/* header row */}
      <button
        className={`step-list-hd${errorCount > 0 ? ' has-err' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="slh-ico">
          {busy ? (
            <span className="step-spin sm" />
          ) : errorCount > 0 ? (
            <Ic.x width={11} height={11} />
          ) : (
            <Ic.check width={11} height={11} />
          )}
        </span>
        <span className="slh-lbl">
          {busy
            ? `正在执行… (${doneCount}/${steps.length})`
            : errorCount > 0
              ? `${steps.length} 步完成，${errorCount} 个错误`
              : `${steps.length} 步完成`}
        </span>
        <Ic.chevD width={12} height={12} className={`slh-chev${open ? ' open' : ''}`} />
      </button>

      {/* step rows */}
      {open && (
        <div className="step-rows">
          {steps.map((s, i) => <StepRow key={i} step={s} />)}
        </div>
      )}
    </div>
  )
}

// ── Message actions ──────────────────────────────────────────────────────────

function MsgActions({ sessionId, index, copyText }: {
  sessionId: string
  index: number
  copyText: string
}) {
  const deleteMessage = useSessionsStore(s => s.deleteMessage)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className="msg-actions">
      <button className="msg-act-btn" title="复制" onClick={handleCopy}>
        {copied ? <Ic.check width={13} height={13} /> : <Ic.copy width={13} height={13} />}
      </button>
      <button className="msg-act-btn danger" title="删除" onClick={() => deleteMessage(sessionId, index)}>
        <Ic.trash width={13} height={13} />
      </button>
    </div>
  )
}

// ── Message ──────────────────────────────────────────────────────────────────

export function Message({ m, sessionId, index }: {
  m: MessageType
  sessionId?: string
  index?: number
}) {
  const canAct = sessionId !== undefined && index !== undefined

  if (m.role === 'user') {
    return (
      <div className="msg user fade-in">
        {canAct && <MsgActions sessionId={sessionId} index={index} copyText={m.text ?? ''} />}
        <UserBubble text={m.text ?? ''} />
      </div>
    )
  }

  const hasSteps = m.steps.length > 0
  const replyText = m.reply.join('\n\n').trim()
  const hasReply  = replyText.length > 0
  const toolsBusy = m.typing && hasSteps && m.steps.at(-1)?.isError === undefined

  return (
    <div className="msg fade-in">
      {/* header + actions */}
      <div className="who">
        <span className="cp-spark" style={{ width: 18, height: 18 }}>
          <img src={storyclawLogo} alt="" />
        </span>
        剧本 Agent
        {canAct && !m.typing && (
          <MsgActions sessionId={sessionId} index={index} copyText={replyText} />
        )}
      </div>

      {/* tool steps */}
      {hasSteps && <StepList steps={m.steps} busy={toolsBusy} />}

      {/* reply or status */}
      {m.typing && !hasReply ? (
        <div className="typing"><i /><i /><i /></div>
      ) : hasReply ? (
        <MarkdownBody text={replyText} streaming={m.typing} />
      ) : !m.typing && !hasSteps ? (
        <div className="ai-empty">（未收到回复，请检查模型配置与 API Key）</div>
      ) : null}
    </div>
  )
}
