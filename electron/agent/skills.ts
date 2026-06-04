import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { Type } from '@sinclair/typebox'
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  SessionManager,
  DefaultResourceLoader,
  createAgentSession,
  defineTool,
  stripFrontmatter
} from '@earendil-works/pi-coding-agent'
import type { BrowserWindow } from 'electron'
import { ALL_TOOLS, getAgentToolMode } from './tools'
import { assertToolAllowed, WORKSPACE_TOOL_NAMES } from './policy'
import type { AgentResource, AgentResources } from '../../src/types'

// ─────────────────────────────────────────────────────────────────────────────
// 内置创作技能 + 阶段专家子代理
//
// 7 个阶段专家被建模为「真子代理」：主 Agent 通过 spawn_subagent 工具按需启动一个
// 临时 AgentSession（in-memory），加载该专家的系统提示词（agents/<name>.md）与其
// 专属的 Skill 子集，跑完后把最终文本产出返回给主 Agent。子代理只拥有工作区文件
// 工具，不能再次派发（避免递归）。37 个创作 Skill 则在主会话里自动注入、模型按需调用。
// ─────────────────────────────────────────────────────────────────────────────

/** 内置专家子代理名（与 agents/<name>.md 一一对应），可被主 Agent 按需派发。 */
export const AGENT_NAMES = [
  // 创意
  'concept-planner', 'market-analyst', 'ip-developer',
  // 设定
  'research-analyst', 'worldbuilder', 'character-designer',
  // 写作
  'story-architect', 'episode-outliner', 'scene-writer', 'dialogue-polisher',
  // 审核
  'chief-editor', 'logic-checker', 'drama-reviewer', 'compliance-reviewer', 'feasibility-analyst'
] as const

export type AgentName = typeof AGENT_NAMES[number]

/** 可被主 Agent 派发的专家。 */
export const DISPATCHABLE_AGENT_NAMES: readonly AgentName[] = AGENT_NAMES

// ── 质检：Agent 分类 ──────────────────────────────────────────────────────────
/** 创意/设定/写作类专家——产出内容，需经过质检。 */
const CREATIVE_AGENTS: readonly AgentName[] = [
  'concept-planner', 'market-analyst', 'ip-developer',
  'research-analyst', 'worldbuilder', 'character-designer',
  'story-architect', 'episode-outliner', 'scene-writer', 'dialogue-polisher'
]

/** 审核类专家——自身就是质检环节，跳过二次质检。 */
const REVIEW_AGENTS: readonly AgentName[] = [
  'chief-editor', 'logic-checker', 'drama-reviewer', 'compliance-reviewer', 'feasibility-analyst'
]

/** 程序化质检最低字符数阈值。 */
const MIN_OUTPUT_CHARS = 50
/** 质检失败最大自动重试次数。 */
const MAX_QA_RETRIES = 2

/** 质检结果 */
interface QAResult {
  passed: boolean
  score: number       // 0-100
  issues: string[]    // 不合格项描述
}

/** 根据 Agent 类型确定期望的输出格式标记 */
const EXPECTED_FORMAT_MARKERS: Partial<Record<AgentName, string[]>> = {
  'character-designer': ['name', 'role', 'traits'],        // .chr JSON 关键字段
  'worldbuilder': ['title', 'sections'],                    // .wld JSON 关键字段
  'story-architect': ['#', '##'],                           // Markdown 大纲
  'episode-outliner': ['#', '##'],                          // Markdown 大纲
  'scene-writer': ['@episode', '@title', '@status'],        // .ep 剧本标记
  'dialogue-polisher': ['@episode'],                        // .ep 剧本标记
  'concept-planner': ['#'],                                 // Markdown
  'market-analyst': ['#'],                                  // Markdown
  'ip-developer': ['#'],                                    // Markdown
  'research-analyst': ['#'],                                // Markdown
}

/** 错误输出标记（出现则判定不合格） */
const ERROR_MARKERS = [
  '抱歉，我无法',
  'I cannot',
  '作为 AI',
  'As an AI',
  '无法完成',
  '超出能力范围',
  '不符合相关规定',
]

/**
 * 内置资源所在的基准目录。
 * - 开发态：app.getAppPath() 指向项目根，资源在 electron/agent 下。
 * - 打包态：通过 electron-builder extraResources 复制到 resources/ 下。
 */
function resourceBaseDir(): string {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), 'electron', 'agent')
}

/** 创作 Skill 根目录（pi 的 additionalSkillPaths 指向这里）。 */
export function getSkillsDir(): string {
  return path.join(resourceBaseDir(), 'skills')
}

/** 当前项目的默认外部 Skill 目录。 */
export function getWorkspaceSkillsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.storyclaw', 'skills')
}

/** 阶段专家定义目录。 */
function getAgentsDir(): string {
  return path.join(resourceBaseDir(), 'agents')
}

/** 读取某专家的系统提示词（去除 frontmatter 的正文）。 */
export async function loadAgentDefinition(agent: AgentName): Promise<string> {
  const file = path.join(getAgentsDir(), `${agent}.md`)
  const raw = await fs.readFile(file, 'utf8')
  return stripFrontmatter(raw).trim()
}

/** 读取专家→Skill 映射（由 generate-skills.mjs 写出，单一事实来源）。 */
async function loadAgentSkillMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(path.join(resourceBaseDir(), 'agent-skills.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// ── 资源清单（供输入框选择器列出内置技能与专家）────────────────────────────────
export function parseFrontmatterField(md: string, field: string): string {
  const m = md.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return ''
  const line = m[1].split(/\r?\n/).find(l => l.trimStart().startsWith(`${field}:`))
  if (!line) return ''
  return line.slice(line.indexOf(':') + 1).trim().replace(/^"|"$/g, '')
}

async function readResource(file: string, fallbackName: string): Promise<AgentResource> {
  const md = await fs.readFile(file, 'utf8').catch(() => '')
  const name = parseFrontmatterField(md, 'name') || fallbackName
  return {
    name,
    title: parseFrontmatterField(md, 'title') || name,
    description: parseFrontmatterField(md, 'description'),
    category: parseFrontmatterField(md, 'category') || undefined
  }
}

async function readSkillResourcesFromDir(skillsDir: string): Promise<AgentResource[]> {
  let skillNames: string[] = []
  try {
    skillNames = (await fs.readdir(skillsDir, { withFileTypes: true }))
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
  } catch {
    return []
  }
  return Promise.all(
    skillNames.map(name => readResource(path.join(skillsDir, name, 'SKILL.md'), name))
  )
}

/** 列出内置与项目外部的专家/创作技能，供 UI 选择器展示。 */
export async function listAgentResources(workspaceRoot?: string | null): Promise<AgentResources> {
  const agents = await Promise.all(
    AGENT_NAMES.map(name => readResource(path.join(getAgentsDir(), `${name}.md`), name))
  )
  const skillsByName = new Map<string, AgentResource>()
  for (const skill of await readSkillResourcesFromDir(getSkillsDir())) {
    skillsByName.set(skill.name, skill)
  }
  if (workspaceRoot) {
    for (const skill of await readSkillResourcesFromDir(getWorkspaceSkillsDir(workspaceRoot))) {
      skillsByName.set(skill.name, skill)
    }
  }
  const skills = [...skillsByName.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { agents, skills }
}

// ── 子代理运行所需的会话级上下文 ──────────────────────────────────────────────
export interface SubagentContext {
  cwd: string
  agentDir: string
  authStorage: AuthStorage
  modelRegistry: ModelRegistry
  /** 取当前主会话使用的模型（可能随用户切换而变化）。 */
  getModel: () => any | undefined
  win: BrowserWindow | null
}

let ctx: SubagentContext | null = null

export function initSubagentRuntime(next: SubagentContext): void {
  ctx = next
}

function requireCtx(): SubagentContext {
  if (!ctx) throw new Error('子代理运行时未初始化——请先打开工作区。')
  return ctx
}

// ── 质检子系统 ────────────────────────────────────────────────────────────────

/**
 * 程序化质检：对子代理产出做快速规则检查（不依赖 LLM）。
 * - 所有 Agent：非空、最低字数、无错误标记
 * - 创意 Agent：额外检查格式标记
 * - 审核 Agent：检查是否有评审标记
 */
function inspectQuality(agent: AgentName, _task: string, output: string): QAResult {
  const issues: string[] = []
  const text = output.trim()

  // 1. 空输出
  if (text.length === 0) {
    return { passed: false, score: 0, issues: ['输出为空'] }
  }

  // 2. 过短输出
  if (text.length < MIN_OUTPUT_CHARS) {
    issues.push(`输出过短（${text.length} 字，最低要求 ${MIN_OUTPUT_CHARS} 字）`)
  }

  // 3. 错误标记检测
  const lower = text.toLowerCase()
  for (const marker of ERROR_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      issues.push(`输出包含拒绝/错误标记："${marker}"`)
      break // 一个就够了
    }
  }

  // 4. 创意 Agent：检查格式标记
  if (CREATIVE_AGENTS.includes(agent)) {
    const expectedMarkers = EXPECTED_FORMAT_MARKERS[agent]
    if (expectedMarkers && expectedMarkers.length > 0) {
      const missing = expectedMarkers.filter(m => !text.includes(m))
      if (missing.length === expectedMarkers.length) {
        // 全部缺失 → 可能输出被写入文件而非直接返回
        // 不强制判定失败，降分即可
        issues.push(`未检测到预期格式标记：${missing.join('、')}（可能已将内容写入文件）`)
      } else if (missing.length > 0) {
        issues.push(`缺少部分格式标记：${missing.join('、')}`)
      }
    }
  }

  // 5. 审核 Agent：检查评审标记
  if (REVIEW_AGENTS.includes(agent)) {
    const reviewMarkers = ['问题', '建议', '修改', '必须改', '通过', '不合格', '需']
    const hasReviewContent = reviewMarkers.some(m => text.includes(m))
    if (!hasReviewContent && text.length < 200) {
      issues.push('审核输出缺少具体评审意见（过短且无评审标记）')
    }
  }

  // 计分
  const score = issues.length === 0 ? 100
    : issues.length === 1 ? 70
    : issues.length === 2 ? 40
    : 10

  return {
    passed: issues.length === 0 || (issues.length === 1 && score >= 70),
    score,
    issues
  }
}

/**
 * 向子代理任务注入自查指令。
 * 让子代理在产出后自行检查质量，减少外部质检压力。
 */
function injectSelfReview(agent: AgentName, task: string): string {
  if (REVIEW_AGENTS.includes(agent)) return task // 审核 Agent 不需要自查注入

  const selfReviewBlock = `\n\n---\n[系统质检要求]\n完成以上任务后，请在最终回复前自检以下方面：\n1. 格式完整性：是否包含该类型产出必需的结构标记\n2. 内容完整性：任务要求的所有要点是否都已覆盖\n3. 字数达标：是否满足 duration-rules 中对应的字数区间要求\n如发现问题请修正后再输出最终结果。最终回复末尾请标注「✅ 已自检」。`
  return task + selfReviewBlock
}

/**
 * 启动一个专家子代理的核心逻辑（不含质检），跑到结束并返回其最终文本产出。
 * 子代理在临时（in-memory）会话中运行，仅加载该专家的 Skill 子集与工作区文件工具。
 */
async function runSubagentRaw(agent: AgentName, task: string): Promise<string> {
  const c = requireCtx()
  const model = c.getModel()
  if (!model) throw new Error('没有可用模型，无法派发子代理。请先在设置中配置模型。')

  const systemPrompt = await loadAgentDefinition(agent)
  const agentSkillMap = await loadAgentSkillMap()
  const skillNames = agentSkillMap[agent] ?? []
  const skillsDir = getSkillsDir()
  const additionalSkillPaths = skillNames.map(name => path.join(skillsDir, name))

  c.win?.webContents.send('agent:event', {
    type: 'subagent_start',
    agent,
    skills: skillNames
  })

  const settingsManager = SettingsManager.create(c.cwd, c.agentDir)
  const resourceLoader = new DefaultResourceLoader({
    cwd: c.cwd,
    agentDir: c.agentDir,
    settingsManager,
    additionalSkillPaths,
    systemPrompt,
    noContextFiles: true,
    noPromptTemplates: true,
    noThemes: true,
    noExtensions: true
  })
  await resourceLoader.reload()

  const { session } = await createAgentSession({
    cwd: c.cwd,
    agentDir: c.agentDir,
    authStorage: c.authStorage,
    modelRegistry: c.modelRegistry,
    model,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    noTools: 'builtin',
    tools: [...WORKSPACE_TOOL_NAMES],
    customTools: ALL_TOOLS
  })

  try {
    let finish: () => void = () => {}
    const ended = new Promise<void>(resolve => { finish = resolve })
    const unsubscribe = session.subscribe((event: any) => {
      if (event.type === 'agent_end' && !event.willRetry) finish()
    })
    try {
      await session.prompt(task)
    } finally {
      await ended
      unsubscribe()
    }
    const output = session.getLastAssistantText()?.trim()
    return output && output.length > 0 ? output : '（子代理没有产出文本内容）'
  } finally {
    session.dispose()
  }
}

/**
 * 启动一个专家子代理（含质检门禁），跑到结束并返回其最终文本产出。
 * 对创意/设定/写作类 Agent 自动注入自查指令并执行程序化质检，
 * 不合格时自动重试（最多 2 次），审核类 Agent 跳过质检。
 */
async function runSubagent(agent: AgentName, task: string): Promise<string> {
  const c = requireCtx()

  // 审核类 Agent 自身就是质检环节，直接运行
  if (REVIEW_AGENTS.includes(agent)) {
    return await runSubagentRaw(agent, task)
  }

  // 创意/设定/写作类 Agent：注入自查 + 质检门禁 + 自动重试
  const enrichedTask = injectSelfReview(agent, task)
  let output = await runSubagentRaw(agent, enrichedTask)

  c.win?.webContents.send('agent:event', { type: 'subagent_end', agent })

  // ── 程序化质检 ──
  let qaResult = inspectQuality(agent, task, output)
  c.win?.webContents.send('agent:event', {
    type: 'subagent_qa',
    agent,
    passed: qaResult.passed,
    score: qaResult.score,
    issues: qaResult.issues
  })

  // ── 不合格则自动重试 ──
  let retries = 0
  while (!qaResult.passed && retries < MAX_QA_RETRIES) {
    retries++
    const feedback = qaResult.issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')
    const retryTask = `${task}\n\n[质检反馈 - 第${retries}次修正]\n上一轮产出未通过程序化质检，请针对以下问题修正后重新产出：\n${feedback}\n\n重要：请确保修正上述所有问题后再输出最终结果。`

    c.win?.webContents.send('agent:event', {
      type: 'subagent_qa_retry',
      agent,
      retry: retries,
      reason: feedback
    })

    output = await runSubagentRaw(agent, injectSelfReview(agent, retryTask))
    qaResult = inspectQuality(agent, task, output)

    c.win?.webContents.send('agent:event', {
      type: 'subagent_qa',
      agent,
      passed: qaResult.passed,
      score: qaResult.score,
      issues: qaResult.issues,
      retry: retries
    })
  }

  // 即使最终未通过也返回（避免死循环），但附加警示
  if (!qaResult.passed) {
    output = `⚠️ [质检未通过，得分 ${qaResult.score}/100]\n${qaResult.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\n---\n${output}`
  }

  return output && output.length > 0 ? output : '（子代理没有产出文本内容）'
}

// ── spawn_subagent 工具 ───────────────────────────────────────────────────────
export const spawnSubagent = defineTool({
  name: 'spawn_subagent',
  label: '派发专家子代理',
  description: `把某个剧本创作专家拉起来干活，并返回它的完整产出。每个专家只带该领域的 Skill，上下文聚焦。按需调用，无强制顺序：
【创意】concept-planner 选题策划 / market-analyst 市场评估 / ip-developer IP衍生
【设定】research-analyst 资料研究 / worldbuilder 世界观设定 / character-designer 人物设定
【写作】story-architect 故事架构 / episode-outliner 分集大纲 / scene-writer 场景编剧 / dialogue-polisher 对白润色
【审核】chief-editor 责编 / logic-checker 逻辑校对 / drama-reviewer 戏剧冲突 / compliance-reviewer 合规风控 / feasibility-analyst 制片可行性
重要：子代理是隔离会话、不记得本对话任何内容。task 里必须自带它干活所需的全部上下文——尤其是前序产出与「角色创作约束卡」。创意/设定/写作类子代理的产出会自动经过程序化质检，不合格时会自动重试修正。`,
  parameters: Type.Object({
    agent: Type.String({
      description: `专家名，取值之一：${DISPATCHABLE_AGENT_NAMES.join(' / ')}`
    }),
    task: Type.String({
      description: '交给该专家的任务说明，需包含所需的全部上下文（前序产出、角色约束卡等）'
    })
  }),
  execute: async (_id, { agent, task }) => {
    assertToolAllowed(getAgentToolMode(), 'spawn_subagent')
    const name = String(agent) as AgentName
    if (!DISPATCHABLE_AGENT_NAMES.includes(name as any)) {
      throw new Error(`未知专家：${agent}。可选：${DISPATCHABLE_AGENT_NAMES.join(' / ')}`)
    }
    if (typeof task !== 'string' || task.trim().length === 0) {
      throw new Error('task 不能为空')
    }
    const output = await runSubagent(name, task)
    return {
      content: [{ type: 'text' as const, text: output }],
      details: { agent: name }
    }
  }
})
