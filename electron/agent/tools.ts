import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { promisify } from 'util'
import { defineTool } from '@earendil-works/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { buildTree, readStoryFile, readTextFile } from '../fs/workspace'
import { parseFile } from '../fs/serializer'
import type { BrowserWindow } from 'electron'
import type { AgentMode, AgentPermission, Block, EpFile, StoryFile, DiffBlock } from '../../src/types'
import { assertToolAllowed } from './policy'

let workspaceRoot = ''
let currentWin: BrowserWindow | null = null
let currentMode: AgentMode = 'craft'
let currentPermission: AgentPermission = 'default'
const execFileAsync = promisify(execFile)

export function initTools(root: string, win: BrowserWindow) {
  workspaceRoot = root
  currentWin = win
}

export function setAgentToolMode(mode: AgentMode) {
  currentMode = mode
}

export function getAgentToolMode(): AgentMode {
  return currentMode
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setAgentPermission(permission: AgentPermission) {
  currentPermission = permission
}

function resolveWorkspacePath(relPath: string): string {
  const abs = path.resolve(workspaceRoot, relPath)
  const relative = path.relative(workspaceRoot, abs)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${relPath}`)
  }
  return abs
}

function requireString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required`)
  }
  return value
}

function clampSelection(from: number, to: number, size: number) {
  const start = Math.max(0, Math.min(Math.floor(from), size))
  const end = Math.max(start, Math.min(Math.floor(to), size))
  return { start, end }
}

export function readSelectionTextFromRaw(raw: string, ext: string, from: number, to: number): string {
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error('from/to must be numbers')
  const normalizedExt = ext.toLowerCase()
  if (normalizedExt === 'ep') {
    const file = parseFile('ep' as any, raw) as EpFile
    const text = screenplayPlainText(file)
    const { start, end } = clampSelection(from, to, text.length)
    return text.slice(start, end).trim()
  }
  const { start, end } = clampSelection(from, to, raw.length)
  return raw.slice(start, end).trim()
}

function screenplayPlainText(file: EpFile): string {
  const episodes = file.episodes && file.episodes.length > 1 ? file.episodes : [file]
  return episodes.map(episode => {
    const title = [episode.episode, episode.title].filter(Boolean).join(' ')
    const body = episode.blocks.map(blockText).filter(Boolean).join('\n\n')
    return [title, body].filter(Boolean).join('\n\n')
  }).join('\n\n')
}

function blockText(block: Block): string {
  if (block.type === 'scene') return [`第 ${block.number} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ')
  if (block.type === 'character') return block.ext ? `${block.name}（${block.ext}）` : block.name
  return block.text
}

function computeBlockDiff(oldFile: StoryFile, newFile: StoryFile): DiffBlock[] {
  if (!('blocks' in oldFile) || !('blocks' in newFile)) return []
  const oldBlocks = (oldFile as any).blocks as Block[]
  const newBlocks = (newFile as any).blocks as Block[]
  const oldIds = new Set(oldBlocks.map((b: Block) => b.id))
  const newIds = new Set(newBlocks.map((b: Block) => b.id))
  const result: DiffBlock[] = []
  for (const blk of newBlocks) result.push({ blk, diff: oldIds.has(blk.id) ? null : 'add' })
  for (const blk of oldBlocks) { if (!newIds.has(blk.id)) result.push({ blk, diff: 'del' }) }
  return result
}

async function requestToolPermission(tool: string, target: string, description: string): Promise<void> {
  if (currentPermission === 'full') return
  if (!currentWin) throw new Error('无法请求权限：窗口未初始化')
  const requestId = randomUUID()
  currentWin.webContents.send('agent:event', {
    type: 'permission_request',
    requestId,
    tool,
    target,
    description
  })
  const approved = await new Promise<boolean>(resolve => {
    ipcMain.once(`agent:permission-response:${requestId}`, (_event, value: boolean) => resolve(Boolean(value)))
  })
  if (!approved) throw new Error(`用户拒绝授权：${description}`)
}

function truncateOutput(text: string): string {
  const max = 16000
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n...（输出已截断）`
}

function requireHttpUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http/https URLs are supported: ${value}`)
  }
  return url
}

async function runWorkspaceCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  const options = {
    cwd: workspaceRoot,
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 8
  }
  if (process.platform === 'win32') {
    const { stdout, stderr } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command
    ], options)
    return { stdout, stderr }
  }
  const { stdout, stderr } = await execFileAsync('/bin/bash', ['-lc', command], options)
  return { stdout, stderr }
}

// ─────────────────────────────────────────────────────────────────────────────

export const bashTool = defineTool({
  name: 'bash',
  label: '执行终端命令',
  description: `在当前 StoryClaw 工作区内执行终端命令，用于外部 Skill 运行脚本、调用 Python/Node、生成 docx/pdf 等文件。
- Windows 下使用 PowerShell；macOS/Linux 下使用 bash。
- 工作目录固定为当前项目根目录。
- 仅 Craft 模式可用；默认权限会先请求用户确认，完全放开权限会自动执行。
- 命令应尽量只读写当前工作区内文件。`,
  parameters: Type.Object({
    command: Type.String({ description: '要执行的终端命令。Windows 项目中可写 PowerShell 命令，例如 python scripts/build.py 或 node scripts/build.mjs。' })
  }),
  execute: async (_id, { command }) => {
    assertToolAllowed(currentMode, 'bash')
    const cmd = requireString(command, 'command')
    await requestToolPermission('bash', cmd, `执行终端命令：${cmd}`)
    try {
      const { stdout, stderr } = await runWorkspaceCommand(cmd)
      const text = [
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : ''
      ].filter(Boolean).join('\n\n') || '命令执行完成，无输出。'
      return { content: [{ type: 'text' as const, text: truncateOutput(text) }], details: { command: cmd, isError: false } }
    } catch (err: any) {
      const stdout = err?.stdout ? `stdout:\n${err.stdout}` : ''
      const stderr = err?.stderr ? `stderr:\n${err.stderr}` : ''
      const message = [stdout, stderr, err?.message ? `error:\n${err.message}` : '命令执行失败'].filter(Boolean).join('\n\n')
      return { content: [{ type: 'text' as const, text: truncateOutput(message) }], details: { command: cmd, isError: true } }
    }
  }
})

export const fetchUrlTool = defineTool({
  name: 'fetch_url',
  label: '访问网页',
  description: `读取公开网页内容，用于外部 Skill 检索文档、skills.sh 页面或其他公开资料。
- 仅支持 http/https URL。
- 仅 Craft 模式可用；默认权限会先请求用户确认，完全放开权限会自动访问。
- 如 Skill 要求浏览 skills.sh，可先用本工具读取页面；如需要运行 npx，则改用 bash。`,
  parameters: Type.Object({
    url: Type.String({ description: '要访问的 http/https URL，例如 https://skills.sh/' })
  }),
  execute: async (_id, { url }) => {
    assertToolAllowed(currentMode, 'fetch_url')
    const target = requireHttpUrl(requireString(url, 'url')).toString()
    await requestToolPermission('fetch_url', target, `访问网页：${target}`)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'user-agent': 'StoryClaw-Agent/1.0'
        }
      })
      const contentType = res.headers.get('content-type') ?? ''
      const raw = await res.text()
      const text = [
        `status: ${res.status} ${res.statusText}`,
        contentType ? `content-type: ${contentType}` : '',
        '',
        raw
      ].filter(Boolean).join('\n')
      return { content: [{ type: 'text' as const, text: truncateOutput(text) }], details: { url: target, status: res.status, isError: !res.ok } }
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `访问失败：${err?.message ?? String(err)}` }],
        details: { url: target, status: 0, isError: true }
      }
    } finally {
      clearTimeout(timer)
    }
  }
})

export const readScreenplay = defineTool({
  name: 'read_screenplay',
  label: '读取剧本文件',
  description: `读取工作区内的剧本文件，返回内容。
- .md 大纲文件：返回纯 Markdown 文本（直接可读写）
- .ep 剧集文件：返回轻标记剧本文本，不是 JSON
- .chr 人物文件：返回 JSON
- .wld 项目设定文件：返回 JSON（含 sections 六个 Markdown 字符串分区）
- 项目配置.cfg：返回项目配置 JSON`,
  parameters: Type.Object({
    path: Type.String({ description: '相对于工作区根目录的路径，例如 大纲/EP01 大纲.md 或 剧集/EP01 第一集.ep' })
  }),
  execute: async (_id, { path: relPath }) => {
    assertToolAllowed(currentMode, 'read_screenplay')
    const abs = resolveWorkspacePath(requireString(relPath, 'path'))
    const ext = path.extname(abs).slice(1).toLowerCase()

    // .md outline files are stored as plain Markdown — return raw text
    if (ext === 'md') {
      const text = await fs.readFile(abs, 'utf-8').catch(() => '')
      return { content: [{ type: 'text' as const, text: text || '（文件为空）' }], details: {} }
    }

    // .ep/.cfg are returned as raw text in their native on-disk format.
    if (ext === 'ep' || ext === 'cfg') {
      const text = await fs.readFile(abs, 'utf-8').catch(() => '')
      return { content: [{ type: 'text' as const, text: text || '（文件为空）' }], details: {} }
    }

    const data = await readStoryFile(abs)
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], details: {} }
  }
})

export const readSelection = defineTool({
  name: 'read_selection',
  label: '读取选区文本',
  description: `按用户提供的坐标读取工作区文档片段。
- .ep 剧本：from/to 使用 ProseMirror 位置坐标
- .md 大纲：from/to 使用文本坐标
用于 @selection 选区引用，不要自行猜测选区正文。`,
  parameters: Type.Object({
    path: Type.String({ description: '相对于工作区根目录的路径，例如 剧集/EP01.ep 或 大纲/全剧大纲.md' }),
    from: Type.Number({ description: '起始坐标' }),
    to: Type.Number({ description: '结束坐标' })
  }),
  execute: async (_id, { path: relPath, from, to }) => {
    assertToolAllowed(currentMode, 'read_selection')
    const abs = resolveWorkspacePath(requireString(relPath, 'path'))
    const ext = path.extname(abs).slice(1).toLowerCase()
    const raw = await fs.readFile(abs, 'utf-8').catch(() => '')
    let text = readSelectionTextFromRaw(raw, ext, Number(from), Number(to))
    if (text.length > 6000) text = text.slice(0, 6000) + '\n...（选区内容已截断）'
    return {
      content: [{ type: 'text' as const, text: text || '（选区为空或坐标无对应文本）' }],
      details: { path: relPath, from, to, ext }
    }
  }
})

export const writeScreenplay = defineTool({
  name: 'write_screenplay',
  label: '修改剧本文件',
  description: `将内容写入剧本文件。行为因文件类型而异：
- .md 大纲文件：content 直接填写 Markdown 文本，会直接写入磁盘（需用户授权）
- .ep 文件：content 填写完整轻标记剧本文本，必须包含 @episode/@title/@status 文件头；同一个 .ep 可包含多个 @episode 段，文件顶部可选 @series；多集时每集都必须各自包含 @episode/@title/@status；场次用 "# 第 1 场 地点 内景/外景 日/夜"；转场用 "> 切至："；对白用 "人物（说明）：对白"；动作写普通段落；块之间最多 1 个空行；不要输出 JSON
- .chr 文件：content 填写完整 JSON 字符串，字段至少包含 version/name/role/age/color/tagline/traits/arc/voice/appearsIn
- .wld 文件：content 填写完整 JSON 字符串，字段为 version/title/sections；sections 包含 premise、timeAndPlace、rules、socialRelations、keySpaces、backstoryAndMaterials 六个 Markdown 字符串
- 项目配置.cfg：content 填写完整项目配置 JSON 字符串
注意：写入时 default 权限模式需要用户逐次授权，full 权限模式自动执行。`,
  parameters: Type.Object({
    path:    Type.String({ description: '相对于工作区根目录的路径' }),
    content: Type.String({ description: '.md 填 Markdown；.ep 填含 @episode/@title/@status 的完整轻标记剧本，可包含多个 @episode 段；.chr/.wld 填完整 JSON 字符串' })
  }),
  execute: async (_id, { path: relPath, content }) => {
    assertToolAllowed(currentMode, 'write_screenplay')
    const abs = resolveWorkspacePath(requireString(relPath, 'path'))
    const ext = path.extname(abs).slice(1).toLowerCase()
    const rawContent = requireString(content, 'content')

    // ── .md outline: write raw Markdown ──────────────────────────────────────
    if (ext === 'md') {
      // No per-action authorization needed — the mode check above (Craft/Plan/Ask)
      // is the only gate. "Full permission" mode is reserved for future destructive ops.
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, rawContent, 'utf-8')
      currentWin?.webContents.send('agent:event', { type: 'file_written', fileId: abs })
      currentWin?.webContents.send('workspace:watch', 'change', path.basename(abs))
      return { content: [{ type: 'text' as const, text: `大纲已写入（Markdown）：${relPath}` }], details: {} }
    }

    // ── .ep/.chr/.wld/.cfg: diff flow — no additional authorization needed ─────

    const newFile = parseFile(ext as any, rawContent)
    const currentRaw = await fs.readFile(abs, 'utf-8').catch(() => '{"version":1,"blocks":[]}')
    const currentFile = parseFile(ext as any, currentRaw)
    const diffBlocks = computeBlockDiff(currentFile, newFile)
    currentWin?.webContents.send('agent:event', { type: 'change', fileId: abs, diffBlocks, newContent: newFile })
    const adds = diffBlocks.filter(d => d.diff === 'add').length
    const dels = diffBlocks.filter(d => d.diff === 'del').length
    return { content: [{ type: 'text' as const, text: `diff 已发送给用户审核：${relPath}（+${adds} -${dels}）` }], details: {} }
  }
})

export const listWorkspace = defineTool({
  name: 'list_workspace',
  label: '列出工作区',
  description: '列出工作区的完整文件树，用于了解项目结构',
  parameters: Type.Object({}),
  execute: async () => {
    assertToolAllowed(currentMode, 'list_workspace')
    const tree = await buildTree(workspaceRoot)
    return { content: [{ type: 'text' as const, text: JSON.stringify(tree, null, 2) }], details: {} }
  }
})

export const readReference = defineTool({
  name: 'read_reference',
  label: '读取参考资料',
  description: `读取参考/目录下的文档，用于改编分析与素材引用。
支持的格式：pdf、docx、txt、md、rtf、csv、json、html、xml、log 等文本类文档。
（旧版二进制 .doc 不支持，请用户先转存为 .docx 或 .txt）`,
  parameters: Type.Object({
    path: Type.String({ description: '相对工作区路径，例如 参考/原著小说.txt 或 参考/分集大纲.docx' })
  }),
  execute: async (_id, { path: relPath }) => {
    assertToolAllowed(currentMode, 'read_reference')
    const abs = resolveWorkspacePath(requireString(relPath, 'path'))
    let text: string
    try {
      text = await readTextFile(abs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text' as const, text: `读取失败：${msg}` }], details: {} }
    }
    if (text.length > 12000) text = text.slice(0, 12000) + '\n…（内容已截断，如需更多请分段读取）'
    return { content: [{ type: 'text' as const, text: text || '（文件为空或无法提取文本）' }], details: {} }
  }
})

import { FORMAT_TOOLS } from './formatTools'

export const ALL_TOOLS = [readScreenplay, readSelection, writeScreenplay, listWorkspace, readReference, bashTool, fetchUrlTool, ...FORMAT_TOOLS]
