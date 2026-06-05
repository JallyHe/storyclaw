import type { AgentMode } from '../../src/types'

/** 工作区文件工具——主会话与阶段子代理共用。 */
export const WORKSPACE_TOOL_NAMES = [
  'list_workspace',
  'read_screenplay',
  'read_selection',
  'read_reference',
  'write_screenplay',
  'match_screenplay_format',
  'apply_format_template',
  'save_format_template'
] as const

/** 主会话暴露的全部工具（含阶段专家子代理派发工具）。 */
export const STORYCLAW_TOOL_NAMES = [
  ...WORKSPACE_TOOL_NAMES,
  'bash',
  'fetch_url',
  'spawn_subagent'
] as const

export type StoryClawToolName = typeof STORYCLAW_TOOL_NAMES[number]

export interface AgentModeConfig {
  mode: AgentMode
  allowedTools: StoryClawToolName[]
  systemSuffix: string
}

const READ_ONLY_TOOLS: StoryClawToolName[] = [
  'list_workspace',
  'read_screenplay',
  'read_selection',
  'read_reference',
  // 格式匹配/试跑只产出文本、不写文件，各模式均可用
  'match_screenplay_format',
  'apply_format_template'
]

const MODE_CONFIG: Record<AgentMode, AgentModeConfig> = {
  craft: {
    mode: 'craft',
    // save_format_template 持久化学到的模板，仅 Craft 允许
    allowedTools: [...READ_ONLY_TOOLS, 'bash', 'fetch_url', 'write_screenplay', 'spawn_subagent', 'save_format_template'],
    systemSuffix: '当前模式：Craft。可以读取资料、访问公开网页、执行工作区终端命令并生成文件改动；剧本类改动优先通过 write_screenplay 生成待审核 diff；外部 Skill 如需浏览网页可用 fetch_url，如需 Python/Node/npx/脚本可用 bash 在当前工作区内执行；可通过 spawn_subagent 调度各阶段专家子代理。不要因为权限模式叫“默认权限”或需要用户确认就声称自己处于隔离沙箱；先尝试可用工具，失败时报告具体工具错误。'
  },
  plan: {
    mode: 'plan',
    allowedTools: READ_ONLY_TOOLS,
    systemSuffix: '当前模式：Plan。只制定计划和建议，可以读取文件，但不能调用写入工具或生成待审核改动。'
  },
  ask: {
    mode: 'ask',
    allowedTools: READ_ONLY_TOOLS,
    systemSuffix: '当前模式：Ask。只回答问题，可以读取文件辅助判断，回答要简洁，不生成改动。'
  }
}

export function getModeConfig(mode: AgentMode): AgentModeConfig {
  return {
    ...MODE_CONFIG[mode],
    allowedTools: [...MODE_CONFIG[mode].allowedTools]
  }
}

export function assertToolAllowed(mode: AgentMode, toolName: string): void {
  const config = MODE_CONFIG[mode]
  if (config.allowedTools.includes(toolName as StoryClawToolName)) return

  const modeName = mode[0].toUpperCase() + mode.slice(1)
  throw new Error(`${modeName} mode does not allow ${toolName}`)
}
