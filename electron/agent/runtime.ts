import fs from 'fs/promises'
import path from 'path'
import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory
} from '@earendil-works/pi-coding-agent'
import type { BrowserWindow } from 'electron'
import type { AgentMode, AgentPermission } from '../../src/types'
import { ALL_TOOLS, initTools, setAgentToolMode, setAgentPermission } from './tools'
import { setupStreaming } from './streaming'
import { getModeConfig, STORYCLAW_TOOL_NAMES } from './policy'
import { loadAgentConfig, prepareAgentModelRuntime, saveAgentConfig } from './config'
import { initSubagentRuntime, spawnSubagent, getMainSessionSkillDirs } from './skills'
import { readTextFile } from '../fs/workspace'

const BASE_SYSTEM_PROMPT = `你是 StoryClaw 的 AI 剧本创作助手。
你运行在一个 Electron 剧本编辑器里，面向中文影视创作者。

## 文件格式规则
- .md 文件（大纲）：内容是纯 Markdown 文本，读取时直接返回 Markdown，写入时 content 填写完整 Markdown 字符串（不要写 JSON）
- .ep 文件（剧集剧本）：轻标记纯文本格式，不是 JSON
  - 必须包含文件头：@episode、@title、@status，可选 @logline
  - 一个 .ep 可以是单集，也可以是多集合集；多集时可在文件顶部写 @series，并用多个 @episode 段分隔
  - 多集 .ep 中每一集都必须各自包含 @episode、@title、@status，然后再写该集正文
  - # 开头表示场次标题，例如 # 第 1 场 咖啡馆 内景 夜
  - > 开头表示转场，例如 > 切至、淡入淡出、叠化、甩镜、闪黑、缩放等：
  - 人物名（可选说明）：对白内容 表示对白，例如 张山（笑着说）：你还是落到我手上啦
  - 其他普通段落默认视为动作描述
  - 不要输出连续空白行；块之间最多 1 个空行；不要用 Markdown 列表写剧本正文
- .chr 文件（人物卡）：只输出完整 JSON，字段至少包含 version/name/role/age/color/tagline/traits/arc/voice/appearsIn
- .wld 文件（项目唯一设定总表）：只输出完整 JSON，字段为 version/title/sections；sections 必须包含 premise、timeAndPlace、rules、socialRelations、keySpaces、backstoryAndMaterials 六个 Markdown 字符串分区
- 项目配置.cfg：根目录项目配置 JSON，字段包含 name/type/genre/synopsis/episodes/episodeDurationMinutes/screenplayLayout。创作前应优先遵循它；短剧默认用单个 .ep 包含多集，电视剧默认一集一个 .ep，电影默认单个电影剧本文件。

## 工具使用规则
- 先用 list_workspace 了解项目结构，再用 read_screenplay 读取具体文件
- 只有在 Craft 模式下才可以使用 write_screenplay
- Craft 模式下可用 fetch_url 访问公开网页，可用 bash 在当前工作区执行终端命令；外部 Skill 如要求浏览网页、Shell、Python、Node.js、npx 或生成 .docx/.pdf 等文件，可通过这些工具完成。默认权限会请求用户确认，完全放开权限会自动执行；不要把“需要确认”误解为隔离沙箱或无权限。
- 文件会直接写入磁盘（default 权限模式需用户逐次授权）
- 使用 read_reference 读取参考/目录下的参考资料（支持 pdf/docx/txt/md/rtf/csv/json 等文档）

## 输出规范
- 回复默认使用中文，解释要具体、可执行
- 生成大纲时使用 Markdown 格式（# 标题、## 幕、- 节拍点）
- 生成剧本时必须遵循中文轻标记剧本格式，不要输出 JSON；如果用户要短剧合集，可在同一个 .ep 内连续输出多个 @episode 段；生成人物/世界观时必须输出对应 JSON，不要包裹代码块
- 生成或修改剧本、分集大纲、人物、设定时，先参考本轮消息中自动附带的「项目配置」，按项目类型、集数、单集时长和剧本组织方式决定产出粒度，具体换算规则如下。

## 时长与篇幅换算规则
创作前请调用 duration-rules 技能换算时长→字数→场次。核心流程：
1. 从项目配置读取 episodeDurationMinutes → 匹配区间 → 确定字数上限与场次上下限
2. 产出前告知用户预计字数与场次数，获得确认后再执行
3. 超出时优先缩减弱张力场次，而非硬性截断
完整换算表见 duration-rules 技能。

## 专家子代理（spawn_subagent）
你可以在合适的时候用 spawn_subagent 把某个剧本创作专家拉起来处理一段聚焦的工作，它会带上该领域的 Skill：
- 【创意】core-strategist 核心策略 / market-analyst 市场评估 / ip-developer IP衍生
- 【设定】research-analyst 资料研究 / worldbuilder 世界观设定 / character-designer 人物设定
- 【写作】story-restructurer 故事框架 / plot-designer 情节设计 / scene-planner 分场规划 / scene-to-script 剧本创作 / dialogue-optimizer 对白优化 / plot-to-screenplay 叙事美学
- 【审核】chief-editor 责编 / logic-checker 逻辑校对 / drama-reviewer 戏剧冲突 / compliance-reviewer 合规风控 / feasibility-analyst 制片可行性
按需调用即可，没有强制顺序——用户要哪步就调哪个，也可以你自己判断当前任务最适合交给哪个专家。
注意：子代理是隔离会话、不记得本对话，调用时务必把所需上下文（含前序产出、项目配置 与「角色创作约束卡」）写进 task。
创作/设定/写作类子代理的产出会自动经过程序化质检（非空、格式、字数等），不合格时自动重试修正；审核类子代理跳过质检直接返回。
你自己也已加载全套创作 Skill（ABCD 体系、情境为王、先挖坑再填坑、对白优化等），简单任务可直接按 Skill 描述自行处理，不必都派发。

## 用户消息中的显式指令（来自输入框选择器）
- \`/skill:<技能名>\`：用户要求你运用该创作技能——按对应 Skill 的约束处理本请求。
- \`@agent:<专家名>\`：用户要求把本请求交给该阶段专家——请用 spawn_subagent 调度它，并在 task 中带上必要上下文。
- \`@[文件路径]\` 或「文件名」：用户引用了该文件，其内容已在消息末尾「用户引用文件的内容」中自动附上，直接据此作答；如需更多内容再用 read_screenplay/read_reference 读取。`

export class StoryClawAgentRuntime {
  private runtime: AgentSessionRuntime | null = null
  private unsubscribe: (() => void) | null = null
  private currentMode: AgentMode = 'craft'
  private workspaceRoot: string | null = null
  private activeModelId: string | null = null
  private activeModel: any | undefined = undefined
  private sessionId: string = ''

  async start(workspaceRoot: string, win: BrowserWindow, sessionId: string): Promise<AgentSession> {
    this.sessionId = sessionId
    await this.dispose()

    this.currentMode = 'craft'
    this.workspaceRoot = workspaceRoot
    setAgentToolMode(this.currentMode)
    initTools(workspaceRoot, win)

    const agentDir = path.join(workspaceRoot, '.storyclaw', 'pi-agent')
    const sessionDir = path.join(agentDir, 'sessions')
    await fs.mkdir(sessionDir, { recursive: true })
    const config = await loadAgentConfig()
    this.activeModelId = config.activeModelId

    const createRuntime: CreateAgentSessionRuntimeFactory = async ({
      cwd,
      agentDir,
      sessionManager,
      sessionStartEvent
    }) => {
      const modelRuntime = await prepareAgentModelRuntime(cwd, this.activeModelId ?? undefined)
      this.activeModel = modelRuntime.model
      const settingsManager = SettingsManager.create(cwd, agentDir)
      const services = await createAgentSessionServices({
        cwd,
        agentDir,
        authStorage: modelRuntime.authStorage,
        modelRegistry: modelRuntime.modelRegistry,
        settingsManager,
        resourceLoaderOptions: {
          // 加载随应用分发、用户全局与当前项目下的 Skill。
          additionalSkillPaths: getMainSessionSkillDirs(cwd),
          systemPromptOverride: () => BASE_SYSTEM_PROMPT
        }
      })
      // 初始化子代理运行时上下文：spawn_subagent 用它启动临时专家会话。
      initSubagentRuntime({
        cwd,
        agentDir,
        authStorage: modelRuntime.authStorage,
        modelRegistry: modelRuntime.modelRegistry,
        getModel: () => this.activeModel,
        win
      })
      return {
        ...(await createAgentSessionFromServices({
          services,
          sessionManager,
          sessionStartEvent,
          model: modelRuntime.model,
          scopedModels: this.getScopedModels(modelRuntime.modelRegistry, modelRuntime.config.models),
          noTools: 'builtin',
          tools: [...STORYCLAW_TOOL_NAMES],
          customTools: [...ALL_TOOLS, spawnSubagent]
        })),
        services,
        diagnostics: services.diagnostics
      }
    }

    this.runtime = await createAgentSessionRuntime(createRuntime, {
      cwd: workspaceRoot,
      agentDir,
      sessionManager: SessionManager.continueRecent(workspaceRoot, sessionDir)
    })
    this.runtime.setRebindSession(async session => {
      await this.bindSession(session, win)
    })
    await this.bindSession(this.runtime.session, win)
    return this.runtime.session
  }

  async prompt(text: string, mode: AgentMode, permission: AgentPermission, modelId?: string): Promise<void> {
    const session = this.requireSession()
    if (modelId && modelId !== this.activeModelId) await this.setModel(modelId)
    this.applyMode(mode)
    setAgentPermission(permission)
    const { cleanText, attachments } = await this.resolveFileMentions(text)
    const projectConfig = await this.readProjectConfigBlock()
    const context = [getModeConfig(mode).systemSuffix, buildPermissionInstruction(mode, permission), projectConfig].filter(Boolean).join('\n\n')
    const body = buildPromptBody(cleanText, context, attachments)
    await session.prompt(body)
  }

  /**
   * Resolve `@[相对路径]` file references inside the user message.
   * Reads each referenced file on the backend (handles spaces in names) and
   * inlines its content, so the model never has to parse an ambiguous path or
   * guess where to find the file. Returns the cleaned message text and a
   * combined attachments block.
   */
  private async resolveFileMentions(text: string): Promise<{ cleanText: string; attachments: string }> {
    const root = this.workspaceRoot
    if (!root) return { cleanText: text, attachments: '' }

    const mentionRe = /@\[([^\]]+)\]/g
    const relPaths = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = mentionRe.exec(text)) !== null) relPaths.add(m[1].trim())
    if (relPaths.size === 0) return { cleanText: text, attachments: '' }

    const MAX_CHARS = 16000
    const blocks: string[] = []
    for (const rel of relPaths) {
      const normalized = rel.replace(/[\\/]+/g, path.sep)
      const abs = path.resolve(root, normalized)
      const relative = path.relative(root, abs)
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue // escape guard

      let content: string
      try {
        content = await readTextFile(abs)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        blocks.push(`【文件：${rel}】读取失败：${msg}`)
        continue
      }
      if (content.length > MAX_CHARS) content = content.slice(0, MAX_CHARS) + '\n…（内容已截断）'
      blocks.push(`【文件：${rel}】\n${content || '（文件为空）'}`)
    }

    // Replace each @[path] token with a plain filename reference for readability
    const cleanText = text.replace(mentionRe, (_full, p: string) => {
      const name = p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p
      return `「${name}」`
    })

    const attachments = blocks.length
      ? `以下是用户引用文件的内容，请据此作答：\n\n${blocks.join('\n\n---\n\n')}`
      : ''
    return { cleanText, attachments }
  }

  private async readProjectConfigBlock(): Promise<string> {
    const root = this.workspaceRoot
    if (!root) return ''
    try {
      const configPath = path.join(root, '项目配置.cfg')
      const content = await readTextFile(configPath)
      if (!content.trim()) return ''
      return `项目配置（来自根目录 项目配置.cfg，请优先遵循）：\n${content}`
    } catch {
      return ''
    }
  }

  async setModel(modelId: string): Promise<void> {
    if (!this.workspaceRoot) throw new Error('Agent workspace is not initialized')
    const config = await loadAgentConfig()
    const nextConfig = { ...config, activeModelId: modelId }
    await saveAgentConfig(nextConfig)
    this.activeModelId = modelId

    if (!this.runtime) return
    const { model } = await prepareAgentModelRuntime(this.workspaceRoot, modelId)
    if (!model) throw new Error(`Model not found or disabled: ${modelId}`)
    this.activeModel = model
    await this.runtime.session.setModel(model)
  }

  async newSession(): Promise<void> {
    if (!this.runtime) return
    await this.runtime.newSession()
  }

  /**
   * Headless 一次性提问：用于 IM 机器人等无渲染端的场景。
   * 直接订阅 session 事件收集助手回复文本，到 agent_end 时结算返回。
   * 默认用 ask 只读模式（不触发需 UI 审核的写入）。
   */
  async promptOnce(text: string, mode: AgentMode = 'ask', extraInstruction?: string): Promise<string> {
    const session = this.requireSession()
    this.applyMode(mode)
    setAgentPermission('default')
    const { cleanText, attachments } = await this.resolveFileMentions(text)
    const projectConfig = await this.readProjectConfigBlock()
    const context = [getModeConfig(mode).systemSuffix, buildPermissionInstruction(mode, 'default'), projectConfig, extraInstruction].filter(Boolean).join('\n\n')
    const body = buildPromptBody(cleanText, context, attachments)

    return await new Promise<string>((resolve, reject) => {
      let collected = ''
      let settled = false
      let timer: NodeJS.Timeout

      // 空闲超时：每有事件就重置，仅在「持续 90s 无任何活动」时兜底结束，
      // 避免长回复被固定总时长截断。
      const IDLE_MS = 90000
      const resetIdle = () => {
        clearTimeout(timer)
        timer = setTimeout(() => finish(), IDLE_MS)
      }

      const finish = (errText?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try { unsub?.() } catch { /* ignore */ }
        if (errText) reject(new Error(errText))
        else resolve(collected.trim())
      }

      const unsub: (() => void) | undefined = (session as any).subscribe((event: any) => {
        resetIdle() // 任何事件都视为活跃
        switch (event.type) {
          case 'message_update': {
            const ae = event.assistantMessageEvent
            if (ae?.type === 'text_delta' && typeof ae.delta === 'string') collected += ae.delta
            break
          }
          case 'agent_end': {
            if (event.willRetry) break
            if (!collected.trim()) {
              const errMsg: string | undefined = (session as any)?.state?.errorMessage
              if (errMsg) collected = `⚠️ ${errMsg}`
            }
            finish()
            break
          }
          default:
            break
        }
      })

      resetIdle()
      session.prompt(body).catch((err: any) => finish(err?.message ?? String(err)))
    })
  }

  async stop(): Promise<void> {
    if (!this.runtime) return
    await this.runtime.session.abort()
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.runtime) await this.runtime.dispose()
    this.runtime = null
    this.workspaceRoot = null
  }

  get session(): AgentSession | null {
    return this.runtime?.session ?? null
  }

  private async bindSession(session: AgentSession, win: BrowserWindow): Promise<void> {
    this.unsubscribe?.()
    await session.bindExtensions({})
    this.applyMode(this.currentMode)
    this.unsubscribe = setupStreaming(session, win, this.sessionId)
  }

  private applyMode(mode: AgentMode): void {
    this.currentMode = mode
    setAgentToolMode(mode)
    this.runtime?.session.setActiveToolsByName(getModeConfig(mode).allowedTools)
  }

  private requireSession(): AgentSession {
    if (!this.runtime) throw new Error('Agent session not initialized — please open a workspace first')
    return this.runtime.session
  }

  private getScopedModels(
    modelRegistry: ModelRegistry,
    models: Array<{ id: string; providerId: string; model: string; enabled: boolean }>
  ): Array<{ model: NonNullable<ReturnType<ModelRegistry['find']>> }> {
    return models
      .filter(model => model.enabled)
      .map(model => {
        const resolved = modelRegistry.find(model.providerId, model.model)
        return resolved ? { model: resolved } : null
      })
      .filter((item): item is { model: NonNullable<ReturnType<ModelRegistry['find']>> } => Boolean(item))
  }
}

export function extractExplicitSkillRequest(text: string): { skillName: string; requestText: string } | null {
  const trimmed = text.trim()
  const slash = trimmed.match(/^\/skill:([^\s]+)(?:\s+([\s\S]*))?$/)
  if (slash) {
    return {
      skillName: slash[1],
      requestText: slash[2]?.trim() ?? ''
    }
  }

  const mention = trimmed.match(/(?:^|\s)@skill:([^\s|]+)(?:\|[^\s]+)?/)
  if (!mention) return null
  return {
    skillName: mention[1],
    requestText: trimmed.replace(mention[0], mention[0].startsWith(' ') ? ' ' : '').replace(/\s+/g, ' ').trim()
  }
}

export function buildPromptBody(cleanText: string, context: string, attachments: string): string {
  const skill = extractExplicitSkillRequest(cleanText)
  const requestText = skill?.requestText || cleanText
  const payload = attachments
    ? `${context}\n\n用户请求：${requestText}\n\n${attachments}`
    : `${context}\n\n用户请求：${requestText}`
  return skill ? `/skill:${skill.skillName} ${payload}` : payload
}

export function buildPermissionInstruction(mode: AgentMode, permission: AgentPermission): string {
  if (mode !== 'craft') {
    return '权限说明：当前不是 Craft 模式，不能调用 bash、fetch_url 或写入工具。若任务需要命令执行、联网检索或安装技能，请明确提示用户切换到 Craft 模式。'
  }
  if (permission === 'full') {
    return '权限说明：当前是 Craft + 完全放开。需要命令执行、联网检索、npx、Python/Node 脚本或文件生成时，直接调用 bash 或 fetch_url；不要声称无 Shell 权限、无互联网、处于沙箱或无法执行。只有工具实际返回错误后，才报告具体错误。'
  }
  return '权限说明：当前是 Craft + 默认权限。你拥有 bash 和 fetch_url，但每次调用会自动弹出用户授权框；这不是无权限，也不是隔离沙箱。需要执行命令、访问互联网、运行 npx、Python/Node 脚本或安装/检索 Skill 时，必须先调用对应工具触发授权，不要在未调用工具前回复“无权限”“无法访问互联网”“无法执行 npx”或类似拒绝。若用户拒绝授权或工具返回错误，再把具体原因告诉用户。'
}
