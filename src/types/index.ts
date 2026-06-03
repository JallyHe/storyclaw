// ─── File format types ────────────────────────────────────────────────────────
import type { WorldSections } from '../editors/world/sections'

export type BlockType = 'scene' | 'action' | 'character' | 'dialogue' | 'paren' | 'transition'

export interface SceneBlock {
  id: string; type: 'scene'
  number: string; intext: string; location: string; time: string; synopsis: string
}
export interface ActionBlock  { id: string; type: 'action';    text: string }
export interface CharBlock    { id: string; type: 'character'; name: string; ext?: string }
export interface DialogueBlock{ id: string; type: 'dialogue'; text: string }
export interface ParenBlock   { id: string; type: 'paren';    text: string }
export interface TransitionBlock { id: string; type: 'transition'; text: string }

export type Block = SceneBlock | ActionBlock | CharBlock | DialogueBlock | ParenBlock | TransitionBlock

export interface EpFile {
  version: 1; episode: string; title: string
  status: 'todo' | 'wip' | 'done'; logline: string; blocks: Block[]
  series?: string
  episodes?: EpFile[]
}

export interface ChrFile {
  version: 1; name: string; role: string; age: number; color: string
  gender?: string; alias?: string; occupation?: string; relationship?: string
  tagline: string; traits: string[]; arc: string; voice: string; appearsIn: string[]
  background?: string; motivation?: string; secret?: string; appearance?: string
}

export interface WldFile { version: 1; title: string; sections: WorldSections }

export type ProjectType = 'film' | 'series' | 'short'
export type ScreenplayLayout = 'single-file-multi-episode' | 'one-file-per-episode' | 'single-film-file'

export interface ProjectConfigFile {
  version: 1
  kind: 'storyclaw-project'
  name: string
  type: ProjectType
  genre: string
  synopsis: string
  episodes: number
  episodeDurationMinutes: number
  screenplayLayout: ScreenplayLayout
}

export type StoryFile = EpFile | ChrFile | WldFile | ProjectConfigFile

// ─── File tree ────────────────────────────────────────────────────────────────

export type FileExt = 'ep' | 'chr' | 'md' | 'wld' | 'txt' | 'pdf' | string

export interface FileNode {
  id: string          // absolute path
  name: string        // display name (without extension)
  ext: FileExt
  kind: 'file'
  badge?: string      // e.g. "已完成"
}

export interface FolderNode {
  id: string          // absolute path
  name: string
  kind: 'folder'
  children: TreeNode[]
}

export type TreeNode = FileNode | FolderNode

// ─── Diff / changes ───────────────────────────────────────────────────────────

export type DiffStatus = 'add' | 'del' | null

export interface DiffBlock { blk: Block; diff: DiffStatus }

export interface PendingChange {
  fileId: string        // absolute path
  diffBlocks: DiffBlock[]
  newContent?: StoryFile
  focusAfter?: string   // block id to scroll to after accept
  applied?: boolean     // true = already written to disk by the agent (info-only record)
  summary?: string      // human-readable note, e.g. "已更新大纲（Markdown）"
}

// ─── Agent session ────────────────────────────────────────────────────────────

export interface ToolStep {
  kind: string
  label: string
  target: string
  isError?: boolean
  thinking?: string  // full thinking content for 'thinking' steps
}

export interface AssistantMessage {
  role: 'assistant'
  steps: ToolStep[]
  reply: string[]
  typing: boolean
}

export interface UserMessage {
  role: 'user'
  text: string
}

export type Message = UserMessage | AssistantMessage

export interface Session {
  id: string
  title: string
  group: string
  /** ISO timestamp for backward-compatible persistence; display text is derived at render time. */
  time: string
  createdAt?: string
  updatedAt?: string
  messages: Message[]
  archived?: boolean
  titleEdited?: boolean
  /** 会话类型：默认 agent；imbot = 来自 IM 平台的机器人会话（桌面端只读） */
  kind?: 'agent' | 'imbot'
  /** imbot 会话的对方名称（如钉钉发送人昵称） */
  peerName?: string
  /** imbot 会话来源平台 id（dingtalk/feishu/wechat） */
  platform?: string
}

export interface AgentSnapshot {
  version: 1
  activeSessionId: string
  modeBySessionId: Record<string, AgentMode>
  sessions: Session[]
  pendingChanges: PendingChange[]
}

// ─── IPC / agent events ───────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'text_delta';         delta: string }
  | { type: 'tool_start';         tool: string; label: string; target: string }
  | { type: 'tool_end';           tool: string; isError: boolean }
  | { type: 'change';             fileId: string; diffBlocks: DiffBlock[]; newContent: StoryFile }
  | { type: 'file_written';       fileId: string }
  | { type: 'thinking_start' }
  | { type: 'thinking_delta';     delta: string }
  | { type: 'thinking_end' }
  | { type: 'permission_request'; requestId: string; tool: string; target: string; description: string }
  | { type: 'queue_update';       steering: readonly string[]; followUp: readonly string[] }
  | { type: 'subagent_start';     agent: string; skills: string[] }
  | { type: 'subagent_end';       agent: string }
  | { type: 'agent_end' }

export type AgentPermission = 'default' | 'full'

// ─── Built-in agent resources (creative skills & stage sub-agents) ────────────

export interface AgentResource {
  name: string
  title: string
  description: string
  /** 专家所属类别（creative/setting/writing/review）；技能无类别。 */
  category?: string
}

export interface AgentResources {
  agents: AgentResource[]
  skills: AgentResource[]
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type AppView = 'editor' | 'agent'
export type LeftPanel = 'explorer' | 'search' | 'scm'
export type AgentMode = 'craft' | 'plan' | 'ask'
export type ThemeKey = 'dark' | 'light'

// ─── Agent model configuration ───────────────────────────────────────────────

export type AgentProviderApi =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'

export interface AgentModelConfig {
  id: string
  providerId: string
  displayName: string
  model: string
  api?: AgentProviderApi
  baseUrl?: string
  apiKey?: string
  enabled: boolean
  reasoning: boolean
  defaultMode: AgentMode
  supportsTools?: boolean
  supportsVision?: boolean
  customProtocol?: boolean
  inputWindow?: string
  outputWindow?: string
}

export interface AgentConfigSnapshot {
  version: 1
  activeModelId: string
  models: AgentModelConfig[]
}

export interface AgentModelOption {
  id: string
  label: string
  sub: string
  provider: string
  model: string
  configured: boolean
  enabled: boolean
  isDefault: boolean
}

export interface AgentConnectionTestResult {
  ok: boolean
  message: string
}

// ─── Local version records ───────────────────────────────────────────────────

export type VersionLineKind = 'main' | 'director' | 'platform'

export interface VersionRecord {
  id: string
  shortId: string
  message: string
  createdAt: string
  changedFiles: string[]
  lineName: string
  isFinal: boolean
  label?: string
}

export interface VersionLine {
  id: string
  name: string
  current: boolean
}

export interface VersionWorkingFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
}

export interface VersionSnapshot {
  currentLine: string
  hasChanges: boolean
  lines: VersionLine[]
  currentFiles: VersionWorkingFile[]
  records: VersionRecord[]
}

export interface VersionDiffFile {
  path: string
  additions: number
  deletions: number
}

export interface VersionDiff {
  fromId: string
  toId: string
  files: VersionDiffFile[]
  patch: string
}

// ─── Workspace IPC contracts ─────────────────────────────────────────────────

export interface SearchMatch {
  line: number
  column: number
  length: number
  lineText: string
}

export interface FileSearchResult {
  path: string
  relPath: string
  name: string
  ext: string
  matches: SearchMatch[]
}

export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export interface NewProjectOptions {
  name: string
  type: ProjectType
  episodes: number
  episodeDurationMinutes?: number
  genre?: string
  synopsis?: string
  screenplayLayout?: ScreenplayLayout
  episodeTitles: string[]
  targetDir: string
}

export interface UploadedReference {
  absPath: string
  relPath: string
  name: string
}

// ─── Desktop updater ─────────────────────────────────────────────────────────

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateSnapshot {
  currentVersion: string
  status: UpdateStatus
  latestVersion?: string
  message?: string
  progress?: number
}
