import { forwardRef, useImperativeHandle, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { agentIpc } from '@/ipc/agent'
import { workspaceIpc } from '@/ipc/workspace'
import { useSessionsStore, useWorkspaceStore, useUiStore } from '@/store'
import type { AgentConfigSnapshot, AgentMode, AgentModelConfig, AgentModelOption, AgentProviderApi, FileNode, FolderNode, AgentResources } from '@/types'
import { FILE_KIND, Ic } from '@/components/icons'

/** 输入框选择器里的一个可选项：内置专家（agent）或创作技能（skill）。 */
interface PickEntry {
  id: string
  kind: 'agent' | 'skill'
  name: string
  title: string
  desc: string
  token: string
  color: string
  icon: typeof Ic.hammer
  category?: string
}

const ENTRY_STYLE = {
  agent: { color: '#9b7cf6', icon: Ic.robot },   // purple robot = AI expert
  skill: { color: '#5fb59a', icon: Ic.wand }     // teal wand    = creative skill
} as const

/** 专家类别 → 中文分组标题（与生成器 category 对应）。 */
const CATEGORY_LABELS: Record<string, string> = {
  creative: '创意',
  setting: '设定',
  writing: '写作',
  review: '审核'
}
const CATEGORY_ORDER = ['creative', 'setting', 'writing', 'review']

/** 把筛选后的可选项分组：专家按类别分组在前，技能合为一组在后。 */
function groupPickEntries(entries: PickEntry[]): Array<{ label: string; items: PickEntry[] }> {
  const groups: Array<{ label: string; items: PickEntry[] }> = []
  for (const cat of CATEGORY_ORDER) {
    const items = entries.filter(e => e.kind === 'agent' && (e.category ?? '') === cat)
    if (items.length) groups.push({ label: `${CATEGORY_LABELS[cat]}专家`, items })
  }
  const looseAgents = entries.filter(e => e.kind === 'agent' && !CATEGORY_ORDER.includes(e.category ?? ''))
  if (looseAgents.length) groups.push({ label: '专家', items: looseAgents })
  const skills = entries.filter(e => e.kind === 'skill')
  if (skills.length) groups.push({ label: '技能', items: skills })
  return groups
}

const AGENT_MODES = [
  { id: 'craft' as AgentMode, name: 'Craft', icon: Ic.hammer, color: '#e0a458', desc: '可执行文件与系统操作——完整的创作执行能力。' },
  { id: 'plan'  as AgentMode, name: 'Plan',  icon: Ic.bulb,   color: '#8b7cf6', desc: '先规划、后执行，不直接改动文件。' },
  { id: 'ask'   as AgentMode, name: 'Ask',   icon: Ic.eye,    color: '#6f9bd1', desc: '只读模式——仅读取文件回答问题。' }
]

const AGENT_PERMISSIONS = [
  { id: 'default', name: '默认权限', sub: '安全沙箱', icon: Ic.shield, desc: 'Agent 执行命令前需逐次授权。' },
  { id: 'full', name: '完全放开', sub: '自动执行', icon: Ic.terminal, desc: 'Agent 可自动执行所有操作，请谨慎使用。' }
]

type ProviderTemplate = {
  id: string
  name: string
  description: string
  api?: AgentProviderApi
  baseUrl?: string
  providerId?: string
  apiKeyPlaceholder?: string
  baseUrlPlaceholder?: string
  builtin?: boolean
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'custom-openai',
    name: '自定义 OpenAI 接口',
    description: '默认入口。兼容百炼、腾讯兼容层、代理网关、LiteLLM、vLLM 等。',
    api: 'openai-completions',
    baseUrl: 'https://api.example.com/v1',
    providerId: 'custom-openai',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.example.com/v1'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '使用 Pi 内置 OpenAI provider，可一次配置多个模型。',
    api: 'openai-responses',
    builtin: true,
    apiKeyPlaceholder: 'sk-proj-...'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 官方接口，使用 Pi 内置 provider。',
    api: 'anthropic-messages',
    builtin: true,
    apiKeyPlaceholder: 'sk-ant-...'
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini / Google Generative AI 接口。',
    api: 'google-generative-ai',
    builtin: true,
    apiKeyPlaceholder: 'AIza...'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 官方 provider，模型可单独启用或停用。',
    api: 'openai-completions',
    builtin: true,
    apiKeyPlaceholder: 'sk-...'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '通过 OpenRouter 聚合多家模型。',
    api: 'openai-completions',
    builtin: true,
    apiKeyPlaceholder: 'sk-or-...'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '本地模型。默认连接本机 Ollama OpenAI 兼容接口。',
    api: 'openai-completions',
    baseUrl: 'http://localhost:11434/v1',
    providerId: 'ollama',
    apiKeyPlaceholder: 'ollama',
    baseUrlPlaceholder: 'http://localhost:11434/v1'
  }
]

const PROVIDER_TEMPLATE_MAP = Object.fromEntries(PROVIDER_TEMPLATES.map(provider => [provider.id, provider])) as Record<string, ProviderTemplate>

function Dropdown({ id, open, setOpen, className = '', children, render }: {
  id: string
  open: boolean
  setOpen: (id: string | null) => void
  className?: string
  children: React.ReactNode
  render: (toggle: () => void) => React.ReactNode
}) {
  return (
    <div className={`ac-dd${className ? ` ${className}` : ''}`}>
      {render(() => setOpen(open ? null : id))}
      {open && <div className="ac-pop">{children}</div>}
    </div>
  )
}

function getProviderLabel(providerId: string): string {
  return PROVIDER_TEMPLATE_MAP[providerId]?.name ?? PROVIDER_TEMPLATE_MAP['custom-openai'].name
}

function getConfigMessage(option: AgentModelOption | undefined): string {
  if (!option) return '还没有配置任何模型，请先添加一个模型。'
  if (!option.configured) return '当前模型没有 API Key，无法发送请求。'
  return ''
}

type BrowserSpeechRecognitionAlternative = {
  transcript: string
}

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  [index: number]: BrowserSpeechRecognitionAlternative
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
}

interface Props {
  busy: boolean
  placeholder?: string
  big?: boolean
}

export interface AgentComposerHandle {
  setText(text: string): void
}

export const AgentComposer = forwardRef<AgentComposerHandle, Props>(function AgentComposer({ busy, placeholder, big }, ref) {
  const [pop, setPop] = useState<string | null>(null)
  const [mode, setMode] = useState<AgentMode>('craft')
  const [model, setModel] = useState('')
  const [agentConfig, setAgentConfig] = useState<AgentConfigSnapshot | null>(null)
  const [modelList, setModelList] = useState<AgentModelOption[]>([])
  const [permission, setPermission] = useState('default')
  const [listening, setListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [voiceUnsupported, setVoiceUnsupported] = useState(false)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const [skillQuery, setSkillQuery] = useState('')
  const [resources, setResources] = useState<AgentResources>({ agents: [], skills: [] })
  const [hasContent, setHasContent] = useState(false)
  const [trigger, setTrigger] = useState<{ kind: 'slash' | 'mention'; query: string } | null>(null)
  const [triggerIndex, setTriggerIndex] = useState(0)
  const [mPath, setMPath] = useState<string[]>([])

  const [uploading, setUploading] = useState(false)

  const edRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const root = useWorkspaceStore(s => s.root)
  const tree = useWorkspaceStore(s => s.tree)
  const { addMessage, activeId } = useSessionsStore()
  const openSettings = useUiStore(s => s.openSettings)

  const curMode = AGENT_MODES.find(item => item.id === mode) ?? AGENT_MODES[0]
  const curModelOption = modelList.find(item => item.id === model)
  const curModel = agentConfig?.models.find(item => item.id === model)
  const curPerm = AGENT_PERMISSIONS.find(item => item.id === permission) ?? AGENT_PERMISSIONS[0]
  const hasSelectedModel = Boolean(curModelOption && curModel)
  const isConfigured = !root || Boolean(curModelOption?.configured)
  const modelWarning = root ? getConfigMessage(curModelOption) : ''
  const pickEntries = useMemo<PickEntry[]>(() => {
    const toEntry = (kind: 'agent' | 'skill') => (r: { name: string; title: string; description: string; category?: string }): PickEntry => ({
      id: `${kind}:${r.name}`,
      kind,
      name: r.name,
      title: r.title || r.name,
      desc: r.description,
      token: kind === 'agent' ? `@agent:${r.name}` : `@skill:${r.name}`,
      color: ENTRY_STYLE[kind].color,
      icon: ENTRY_STYLE[kind].icon,
      category: r.category
    })
    // 专家排在技能前面
    return [...resources.agents.map(toEntry('agent')), ...resources.skills.map(toEntry('skill'))]
  }, [resources])

  const matchEntry = (entry: PickEntry, q: string) =>
    !q || entry.title.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || entry.desc.toLowerCase().includes(q)

  const filteredSkills = pickEntries.filter(entry => matchEntry(entry, skillQuery.toLowerCase()))
  const filteredSkillGroups = groupPickEntries(filteredSkills)


  const treeIndex = useMemo(() => {
    const index: Record<string, FileNode | FolderNode> = {}
    function walk(nodes: typeof tree) {
      for (const node of nodes) {
        index[node.id] = node as FileNode | FolderNode
        if (node.kind === 'folder') walk(node.children)
      }
    }
    walk(tree)
    return index
  }, [tree])

  const mentionNodes = useMemo(() => {
    const base = mPath.length > 0 ? ((treeIndex[mPath[mPath.length - 1]] as FolderNode)?.children ?? []) : tree
    const q = trigger?.kind === 'mention' ? trigger.query.toLowerCase() : ''
    return base.filter(node => !q || node.name.toLowerCase().includes(q))
  }, [mPath, tree, treeIndex, trigger])

  const slashSkills = useMemo(() => {
    const q = trigger?.kind === 'slash' ? trigger.query.toLowerCase() : ''
    return pickEntries.filter(entry => matchEntry(entry, q))
  }, [trigger, pickEntries])
  const slashGroups = useMemo(() => groupPickEntries(slashSkills), [slashSkills])
  const triggerItems = trigger?.kind === 'slash' ? slashSkills : mentionNodes

  const reloadModels = useCallback((workspaceRoot: string) => {
    void agentIpc.getConfig(workspaceRoot).then(config => {
      setAgentConfig(config)
      setModel(config.activeModelId)
      const activeModel = config.models.find(item => item.id === config.activeModelId)
      if (activeModel) setMode(activeModel.defaultMode)
    }).catch(() => {})
    void agentIpc.listModels(workspaceRoot).then(setModelList).catch(() => {})
  }, [])

  useEffect(() => {
    if (!root) {
      setAgentConfig(null)
      setModelList([])
      setModel('')
      return
    }
    reloadModels(root)
  }, [root, reloadModels])

  useEffect(() => {
    void agentIpc.listResources().then(setResources).catch(() => {})
  }, [])

  useEffect(() => {
    setTriggerIndex(0)
  }, [trigger?.kind, trigger?.query, mPath])

  useEffect(() => {
    if (triggerIndex >= triggerItems.length) setTriggerIndex(Math.max(0, triggerItems.length - 1))
  }, [triggerIndex, triggerItems.length])

  useEffect(() => {
    if (!listRef.current || !trigger) return
    const activeItem = listRef.current.querySelector('.atp-item.active') as HTMLElement | null
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest' })
  }, [triggerIndex, trigger])

  const sync = useCallback(() => {
    const editor = edRef.current
    setHasContent(Boolean(editor && (editor.textContent?.trim() || editor.querySelector('.ac-tag-chip'))))
  }, [])

  function placeCaret(node: Node, offset: number) {
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }

  const setComposerText = useCallback((text: string) => {
    const editor = edRef.current
    if (!editor) return
    editor.textContent = text
    setHasContent(Boolean(text.trim()))
    setTrigger(null)
    setMPath([])
    editor.focus()
    const node = editor.firstChild ?? editor.appendChild(document.createTextNode(''))
    placeCaret(node, node.textContent?.length ?? 0)
  }, [])

  useImperativeHandle(ref, () => ({
    setText: setComposerText
  }), [setComposerText])

  function makeChip(kind: 'skill' | 'agent' | 'file', label: string, token: string, color?: string) {
    const span = document.createElement('span')
    span.className = `ac-tag-chip ${kind === 'file' ? 'file' : 'skill'}`
    span.contentEditable = 'false'
    span.dataset.token = token
    span.dataset.label = label   // human-readable display name (Chinese title)
    if (color) span.style.setProperty('--chip-c', color)

    // Only show the @ prefix for file chips; skill/agent chips need no sigil
    if (kind === 'file') {
      const pre = document.createElement('span')
      pre.className = 'tagc-pre'
      pre.textContent = '@'
      span.appendChild(pre)
    }

    const txt = document.createElement('span')
    txt.className = 'tagc-label'
    txt.textContent = label

    const x = document.createElement('button')
    x.className = 'tagc-x'
    x.type = 'button'
    // Use an inline SVG so the icon is always perfectly centered
    x.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    x.addEventListener('mousedown', event => {
      event.preventDefault()
      event.stopPropagation()
      span.remove()
      sync()
      edRef.current?.focus()
    })

    span.appendChild(txt)
    span.appendChild(x)
    return span
  }

  function insertChip(kind: 'skill' | 'agent' | 'file', label: string, token: string, color?: string) {
    const editor = edRef.current
    if (!editor) return
    const selection = window.getSelection()
    const chip = makeChip(kind, label, token, color)
    const space = document.createTextNode(' ')
    if (selection && selection.rangeCount && editor.contains(selection.anchorNode) && selection.anchorNode?.nodeType === 3) {
      const node = selection.anchorNode as Text
      const offset = selection.anchorOffset
      const text = node.textContent ?? ''
      const before = text.slice(0, offset)
      const match = before.match(/[\/@][^\s\/@]*$/)
      const head = match ? before.slice(0, before.length - match[0].length) : before
      const tail = text.slice(offset)
      node.textContent = head
      const parent = node.parentNode!
      parent.insertBefore(chip, node.nextSibling)
      parent.insertBefore(space, chip.nextSibling)
      if (tail) parent.insertBefore(document.createTextNode(tail), space.nextSibling)
    } else {
      editor.appendChild(chip)
      editor.appendChild(space)
    }
    placeCaret(space, 1)
    setTrigger(null)
    setMPath([])
    sync()
  }

  function pickEntry(entry: PickEntry) {
    insertChip(entry.kind, entry.title, entry.token, entry.color)
  }

  // Convert an absolute workspace path to a root-relative path (forward slashes)
  function toRelPath(absPath: string): string {
    if (!root) return absPath
    let rel = absPath.startsWith(root) ? absPath.slice(root.length) : absPath
    return rel.replace(/^[\\/]+/, '').replace(/\\/g, '/')
  }

  function pickFile(node: FileNode) {
    const kind = FILE_KIND[node.ext]
    const label = `${node.name}${node.ext ? `.${node.ext}` : ''}`
    // Use a bracketed relative path so spaces in names survive parsing
    insertChip('file', label, `@[${toRelPath(node.id)}]`, kind?.color)
  }

  function getTrigger(): { kind: 'slash' | 'mention'; query: string } | null {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return null
    const node = selection.anchorNode
    if (!node || node.nodeType !== 3 || !edRef.current?.contains(node)) return null
    const before = (node as Text).textContent?.slice(0, selection.anchorOffset) ?? ''
    const match = before.match(/(?:^|\s)([\/@])([^\s\/@]*)$/)
    if (!match) return null
    return { kind: match[1] === '/' ? 'slash' : 'mention', query: match[2] }
  }

  function serialize() {
    const editor = edRef.current
    if (!editor) return ''
    let out = ''
    editor.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        out += (node as Text).textContent
      } else if ((node as Element).classList?.contains('ac-tag-chip')) {
        const el = node as HTMLElement
        const token = el.dataset.token ?? ''
        const label = el.dataset.label ?? ''
        const isNamedChip = token.startsWith('@agent:') || token.startsWith('@skill:')
        out += ` ${isNamedChip && label ? `${token}|${label}` : token} `
      } else if ((node as Element).tagName === 'BR') {
        out += '\n'
      } else {
        out += (node as Element).textContent ?? ''
      }
    })
    return out.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  }

  /** Strip the |label suffix before sending to the AI model. */
  function stripLabels(text: string): string {
    return text.replace(/(@(?:agent|skill):[^\s|]+)\|[^\s]+/g, '$1')
  }

  const submit = useCallback(async () => {
    const text = serialize()
    if (!text || busy || !isConfigured || !hasSelectedModel) return
    if (edRef.current) edRef.current.innerHTML = ''
    setHasContent(false)
    setTrigger(null)
    setMPath([])
    addMessage({ role: 'user', text })
    addMessage({ role: 'assistant', steps: [], reply: [], typing: true })
    // Strip display labels (|中文名) before sending to the AI model
    await agentIpc.send(activeId, stripLabels(text), mode, permission, model || undefined)
  }, [activeId, addMessage, busy, hasSelectedModel, isConfigured, mode, model, permission])

  const stop = useCallback(async () => {
    await agentIpc.stop(activeId)
  }, [activeId])

  const handleUpload = useCallback(async () => {
    if (!root || uploading) return
    setUploading(true)
    try {
      // Chat uploads go to the hidden .storyclaw/attachments/ dir (conversation
      // scratch files), so they don't pollute the project tree. No refreshTree needed.
      const uploaded = await workspaceIpc.uploadAttachments(root)
      for (const file of uploaded) {
        const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
        const kind = FILE_KIND[ext]
        // file.relPath is root-relative (e.g. .storyclaw/attachments/原著.pdf)
        insertChip('file', file.name, `@[${file.relPath}]`, kind?.color)
      }
      if (uploaded.length > 0) edRef.current?.focus()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [root, uploading])

  function insertVoiceText(text: string) {
    const editor = edRef.current
    if (!editor || !text.trim()) return
    editor.focus()
    // Place caret at end if not already inside
    const sel = window.getSelection()
    if (!sel || !editor.contains(sel.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    document.execCommand('insertText', false, text.trim())
    sync()
    setTrigger(getTrigger())
  }

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setListening(false)
      setInterimTranscript('')
      return
    }

    const speechWindow = window as SpeechRecognitionWindow
    const SRCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!SRCtor) {
      setVoiceUnsupported(true)
      setTimeout(() => setVoiceUnsupported(false), 3000)
      return
    }

    const rec = new SRCtor()
    rec.lang = navigator.language || 'zh-CN'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          insertVoiceText(result[0].transcript)
          setInterimTranscript('')
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) setInterimTranscript(interim)
    }

    rec.onerror = () => {
      recognitionRef.current = null
      setListening(false)
      setInterimTranscript('')
    }

    rec.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  const onInput = () => {
    setTrigger(getTrigger())
    sync()
  }

  // Strip all HTML formatting on paste — only plain text is accepted.
  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    if (!text) return
    document.execCommand('insertText', false, text)
    sync()
    setTrigger(getTrigger())
  }

  const onKey = (event: React.KeyboardEvent) => {
    // Block browser rich-text formatting shortcuts (Ctrl/Cmd + B/I/U)
    if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
      event.preventDefault()
      return
    }

    if (trigger) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (triggerItems.length === 0) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setTriggerIndex(index => (index + delta + triggerItems.length) % triggerItems.length)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setTrigger(null)
        setMPath([])
        setTriggerIndex(0)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (trigger.kind === 'slash') {
          const entry = slashSkills[Math.min(triggerIndex, slashSkills.length - 1)]
          if (entry) pickEntry(entry)
        } else {
          const node = mentionNodes[Math.min(triggerIndex, mentionNodes.length - 1)]
          if (node) {
            if (node.kind === 'folder') {
              setMPath(path => [...path, node.id])
              setTriggerIndex(0)
            } else {
              pickFile(node as FileNode)
            }
          }
        }
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  const chooseModel = async (modelId: string) => {
    setModel(modelId)
    setPop(null)
    if (!root || !agentConfig) return
    const saved = await agentIpc.saveConfig(root, { ...agentConfig, activeModelId: modelId })
    setAgentConfig(saved)
    const activeModel = saved.models.find(item => item.id === modelId)
    if (activeModel) setMode(activeModel.defaultMode)
    reloadModels(root)
  }

  return (
    <div className={`acomposer${big ? ' big' : ''}`}>
      {root && modelWarning && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          marginBottom: 6,
          background: 'color-mix(in srgb, var(--diff-del-fg) 10%, var(--bg-2))',
          borderRadius: 8,
          fontSize: 12.5
        }}>
          <Ic.shield width={13} height={13} style={{ flexShrink: 0, color: 'var(--diff-del-fg)' }} />
          <span style={{ flex: 1, color: 'var(--text-1)' }}>{modelWarning}</span>
          <button
            style={{
              background: 'var(--accent)',
              color: '#1a1205',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => openSettings('model')}
          >
            {hasSelectedModel ? '配置模型' : '添加模型'}
          </button>
        </div>
      )}

      <div className="ac-input-wrap">
        {trigger?.kind === 'slash' && (
          <div className="ac-trigger-pop">
            <div className="atp-head">
              <Ic.wand  width={12} height={12} style={{ color: '#5fb59a' }} />
              <Ic.robot width={12} height={12} style={{ color: '#9b7cf6' }} />
              技能与专家 · 输入以筛选
            </div>
            <div className="atp-list" ref={listRef}>
              {slashGroups.map(group => (
                <div key={group.label}>
                  <div className="atp-group">{group.label}</div>
                  {group.items.map(entry => {
                    const active = slashSkills[triggerIndex]?.id === entry.id
                    return (
                    <div key={entry.id} className={`atp-item${active ? ' active' : ''}`} onMouseDown={event => { event.preventDefault(); pickEntry(entry) }}>
                      <span className="atp-ico" style={{ color: entry.color }}><entry.icon width={15} height={15} /></span>
                      <span className="atp-name">{entry.title}</span>
                      <span className="atp-desc">{entry.desc}</span>
                    </div>
                    )
                  })}
                </div>
              ))}
              {slashSkills.length === 0 && <div className="atp-empty">无匹配技能或专家</div>}
            </div>
          </div>
        )}

        {trigger?.kind === 'mention' && (
          <div className="ac-trigger-pop">
            <div className="atp-head">
              <Ic.at width={12} height={12} />
              <span className="atp-crumb">
                <span className="atc" onMouseDown={event => { event.preventDefault(); setMPath([]) }}>根目录</span>
                {mPath.map((id, index) => (
                  <span key={id} style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="atc-sep">/</span>
                    <span className="atc" onMouseDown={event => { event.preventDefault(); setMPath(mPath.slice(0, index + 1)) }}>
                      {treeIndex[id]?.name ?? id}
                    </span>
                  </span>
                ))}
              </span>
            </div>
            <div className="atp-list" ref={listRef}>
              {mentionNodes.map((node, index) => node.kind === 'folder' ? (
                <div
                  key={node.id}
                  className={`atp-item folder${index === triggerIndex ? ' active' : ''}`}
                  onMouseDown={event => { event.preventDefault(); setMPath(path => [...path, node.id]); setTriggerIndex(0) }}
                >
                  <span className="atp-ico" style={{ color: 'var(--text-2)' }}><Ic.folder width={15} height={15} /></span>
                  <span className="atp-name">{node.name}</span>
                  <span className="atp-chev"><Ic.chevRight width={14} height={14} /></span>
                </div>
              ) : (
                <div key={node.id} className={`atp-item${index === triggerIndex ? ' active' : ''}`} onMouseDown={event => { event.preventDefault(); pickFile(node as FileNode) }}>
                  {(() => {
                    const file = node as FileNode
                    const kind = FILE_KIND[file.ext]
                    const Icon = kind?.icon ?? Ic.fileScene
                    return (
                      <>
                        <span className="atp-ico" style={{ color: kind?.color ?? 'var(--accent)' }}>
                          <Icon width={15} height={15} />
                        </span>
                        <span className="atp-name">{file.name}<span className="atp-ext">.{file.ext}</span></span>
                      </>
                    )
                  })()}
                </div>
              ))}
              {mentionNodes.length === 0 && <div className="atp-empty">此目录为空</div>}
            </div>
          </div>
        )}

        <div
          ref={edRef}
          className="ac-rich"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-ph={placeholder ?? '描述你想做的事；/ 调用技能，@ 引用文件…'}
          onInput={onInput}
          onKeyDown={onKey}
          onKeyUp={() => { if (!trigger) setTrigger(getTrigger()) }}
          onPaste={onPaste}
        />
      </div>

      <div className="ac-toolbar">
        <Dropdown
          id="mode"
          open={pop === 'mode'}
          setOpen={setPop}
          render={toggle => (
            <button className="ac-btn mode" onClick={toggle} style={{ '--md-c': curMode.color } as any}>
              <curMode.icon width={14} height={14} />{curMode.name}<Ic.chevD width={12} height={12} />
            </button>
          )}
        >
          <div className="ac-pop-title">模式</div>
          {AGENT_MODES.map(item => (
            <div key={item.id} className={`ac-opt${item.id === mode ? ' on' : ''}`} onClick={() => { setMode(item.id); setPop(null) }}>
              <span className="ac-opt-ico" style={{ color: item.color }}><item.icon width={15} height={15} /></span>
              <div className="ac-opt-body">
                <div className="ac-opt-name">{item.name}{item.id === 'craft' && <span className="ac-tag">默认</span>}</div>
                <div className="ac-opt-desc">{item.desc}</div>
              </div>
              {item.id === mode && <span className="ac-opt-check"><Ic.check width={14} height={14} /></span>}
            </div>
          ))}
        </Dropdown>

        <Dropdown
          id="skills"
          open={pop === 'skills'}
          setOpen={setPop}
          render={toggle => (
            <button className="ac-btn" onClick={toggle}>
              <Ic.wand width={14} height={14} />技能与专家
            </button>
          )}
        >
          <div className="ac-skill-search">
            <Ic.search width={13} height={13} />
            <input placeholder="搜索技能或专家" value={skillQuery} onChange={event => setSkillQuery(event.target.value)} />
          </div>
          <div className="ac-skill-list">
            {filteredSkillGroups.map(group => (
              <div key={group.label}>
                <div className="atp-group">{group.label}</div>
                {group.items.map(entry => (
                  <div key={entry.id} className="ac-skill" onClick={() => { pickEntry(entry); setPop(null) }}>
                    <span className="ac-skill-ico" style={{ color: entry.color }}><entry.icon width={16} height={16} /></span>
                    <div>
                      <div className="ac-skill-name">{entry.title}</div>
                      <div className="ac-skill-desc">{entry.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filteredSkills.length === 0 && <div className="atp-empty">未加载到技能或专家</div>}
          </div>
          <div className="ac-skill-import" onClick={() => setPop(null)}>
            <Ic.download width={14} height={14} /> 共 {pickEntries.length} 项内置专家与技能
          </div>
        </Dropdown>

        <div style={{ flex: 1 }} />

        <button
          className="ac-icon-btn"
          title={root ? '上传文件（PDF / Word / TXT / Markdown 等，仅本次对话引用）' : '请先打开工作区'}
          onClick={() => void handleUpload()}
          disabled={!root || uploading}
        >
          {uploading ? <span className="ac-upload-spin" /> : <Ic.paperclip width={15} height={15} />}
        </button>

        <div className="ac-voice-wrap">
          {listening && interimTranscript && (
            <div className="ac-voice-interim">{interimTranscript}</div>
          )}
          {voiceUnsupported && (
            <div className="ac-voice-interim ac-voice-err">当前环境不支持语音识别</div>
          )}
          <button
            className={`ac-icon-btn${listening ? ' listening' : ''}`}
            title={listening ? '点击停止录音' : '语音输入（点击开始录音）'}
            onClick={toggleVoice}
          >
            {listening && <span className="mic-pulse" />}
            <Ic.mic width={15} height={15} />
          </button>
        </div>

        {busy
          ? <button className="ac-send stop" onClick={stop} title="停止"><Ic.stop width={14} height={14} /></button>
          : (
            <button
              className="ac-send"
              disabled={!hasContent || !isConfigured || !hasSelectedModel}
              onClick={() => void submit()}
              title={!hasSelectedModel ? '请先添加模型' : !isConfigured ? '请先设置 API Key' : '发送 (Enter)'}
            >
              <Ic.send width={15} height={15} />
            </button>
          )}
      </div>

      <div className="ac-permbar">
        <Dropdown
          id="perm"
          open={pop === 'perm'}
          setOpen={setPop}
          render={toggle => (
            <button className={`ac-perm${permission === 'full' ? ' full' : ''}`} onClick={toggle}>
              <curPerm.icon width={13} height={13} />
              {curPerm.name} · {curPerm.sub}
              <Ic.chevD width={11} height={11} />
            </button>
          )}
        >
          <div className="ac-pop-title">权限</div>
          {AGENT_PERMISSIONS.map(item => (
            <div key={item.id} className={`ac-opt${item.id === permission ? ' on' : ''}`} onClick={() => { setPermission(item.id); setPop(null) }}>
              <span className="ac-opt-ico" style={{ color: item.id === 'full' ? 'var(--diff-del-fg)' : 'var(--diff-add-fg)' }}>
                <item.icon width={14} height={14} />
              </span>
              <div className="ac-opt-body">
                <div className="ac-opt-name">{item.name} · {item.sub}</div>
                <div className="ac-opt-desc">{item.desc}</div>
              </div>
              {item.id === permission && <span className="ac-opt-check"><Ic.check width={14} height={14} /></span>}
            </div>
          ))}
        </Dropdown>
        <div style={{ flex: 1 }} />
        <Dropdown
          id="model"
          open={pop === 'model'}
          setOpen={setPop}
          render={toggle => (
            <button
              className="ac-btn"
              onClick={toggle}
              style={!isConfigured ? { color: 'var(--diff-del-fg)', borderColor: 'color-mix(in srgb, var(--diff-del-fg) 40%, var(--border))' } : undefined}
            >
              {!isConfigured ? <Ic.shield width={13} height={13} /> : <Ic.spark width={13} height={13} />}
              {curModelOption?.label ?? '添加模型'}
              {!isConfigured && <span style={{ fontSize: 10, marginLeft: 2 }}>{hasSelectedModel ? '⚠ 无 Key' : '⚠ 未配置'}</span>}
              <Ic.chevD width={12} height={12} />
            </button>
          )}
        >
          <div className="ac-pop-title">模型</div>
          {!root && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-3)' }}>打开工作区后可配置 Agent 模型。</div>}
          {modelList.length === 0 && root && (
            <div className="ac-model-empty">
              <div className="ac-model-empty-title">还没有配置任何模型</div>
              <div className="ac-model-empty-desc">先选择供应商，再一次添加多个模型；默认入口是自定义 OpenAI 接口。</div>
            </div>
          )}
          {modelList.map(item => (
            <div key={item.id} className={`ac-opt${item.id === model ? ' on' : ''}${!item.enabled ? ' disabled' : ''}`} onClick={() => { if (item.enabled) void chooseModel(item.id) }}>
              <span className="ac-opt-ico" style={{ color: item.configured ? 'var(--diff-add-fg)' : 'var(--diff-del-fg)' }}>
                {item.configured ? <Ic.checkCircle width={14} height={14} /> : <Ic.shield width={14} height={14} />}
              </span>
              <div className="ac-opt-body">
                <div className="ac-opt-name">
                  {item.label}
                  {item.id === agentConfig?.activeModelId && <span className="ac-tag">当前</span>}
                  {!item.configured && <span className="ac-tag" style={{ color: 'var(--diff-del-fg)', background: 'color-mix(in srgb, var(--diff-del-fg) 15%, transparent)' }}>需要 Key</span>}
                </div>
                <div className="ac-opt-desc ac-path">{getProviderLabel(item.provider)} / {item.model}</div>
              </div>
              {item.id === model && <span className="ac-opt-check"><Ic.check width={14} height={14} /></span>}
            </div>
          ))}
          <div className="ac-skill-import" onClick={() => { setPop(null); openSettings('model') }}>
            <Ic.sliders width={14} height={14} /> 管理供应商与模型
          </div>
        </Dropdown>
      </div>

      {(pop || trigger) && <div className="ac-backdrop" onClick={() => { setPop(null); setTrigger(null); setTriggerIndex(0); setMPath([]) }} />}

    </div>
  )
})
