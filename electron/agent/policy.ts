import type { AgentMode } from '../../src/types'

/** 工作区文件工具——主会话与阶段子代理共用。 */
export const WORKSPACE_TOOL_NAMES = [
  'list_workspace',
  'read_screenplay',
  'read_reference',
  'write_screenplay'
] as const

/** 主会话暴露的全部工具（含阶段专家子代理派发工具）。 */
export const STORYCLAW_TOOL_NAMES = [
  ...WORKSPACE_TOOL_NAMES,
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
  'read_reference'
]

const MODE_CONFIG: Record<AgentMode, AgentModeConfig> = {
  craft: {
    mode: 'craft',
    allowedTools: [...READ_ONLY_TOOLS, 'write_screenplay', 'spawn_subagent'],
    systemSuffix: '当前模式：Craft。可以读取资料并生成剧本改动，必须通过 write_screenplay 生成待审核 diff；可通过 spawn_subagent 调度各阶段专家子代理。'
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
