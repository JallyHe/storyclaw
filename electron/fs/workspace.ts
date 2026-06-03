import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  FileExt,
  FileNode,
  FileSearchResult,
  FolderNode,
  NewProjectOptions,
  ProjectConfigFile,
  ProjectType,
  SearchMatch,
  SearchOptions,
  ScreenplayLayout,
  StoryFile,
  TreeNode,
  UploadedReference
} from '../../src/types'
import { formatImportedScreenplayText } from '../../src/editors/screenplay/importer'
import { applyTemplate, isConfidentMatch, rankTemplates } from '../../src/editors/screenplay/formatTemplates'
import { loadAllTemplates } from '../screenplay/formatStore'
import { createEmptyWorldSections } from '../../src/editors/world/sections'
import { parseFile, serializeFile } from './serializer'

// Internal/hidden entries never shown in the explorer
const HIDDEN_ENTRIES = new Set([
  '.storyclaw',
  '.git',
  '.ds_store',
  'desktop.ini',
  'ehthumbs.db',
  'node_modules',
  'system volume information',
  'thumbs.db',
  '$recycle.bin'
])
const execFileAsync = promisify(execFile)

export async function buildTree(dir: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const e of entries) {
    const fullPath = path.join(dir, e.name)
    if (await isHiddenEntry(e.name, fullPath)) continue
    if (e.isDirectory()) {
      const folder: FolderNode = {
        id: fullPath, name: e.name, kind: 'folder',
        children: await buildTree(fullPath)
      }
      nodes.push(folder)
    } else if (e.isFile()) {
      // Show ALL files; extension may be empty for files like "README"
      const ext = path.extname(e.name).slice(1).toLowerCase() as FileExt
      const nameWithoutExt = ext ? path.basename(e.name, '.' + ext) : e.name
      nodes.push({ id: fullPath, name: nameWithoutExt, ext, kind: 'file' } as FileNode)
    }
  }

  // Folders first, then files, each alphabetically
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh')
  })
  return nodes
}

async function isHiddenEntry(name: string, fullPath: string): Promise<boolean> {
  const lower = name.toLowerCase()
  if (HIDDEN_ENTRIES.has(lower) || name.startsWith('.')) return true
  return hasWindowsHiddenOrSystemAttribute(fullPath)
}

async function hasWindowsHiddenOrSystemAttribute(fullPath: string): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try {
    const { stdout } = await execFileAsync('attrib', [fullPath], { windowsHide: true })
    return /^[\sA-Z]*[HS][\sA-Z]*\s/i.test(stdout)
  } catch {
    return false
  }
}

export async function createWorkspaceFolder(root: string, parentDir: string, name: string): Promise<string> {
  const parent = assertInsideRoot(root, parentDir)
  const safeName = assertSafeName(name)
  const target = assertInsideRoot(root, joinPath(parent, safeName))
  await assertMissing(target)
  await fs.mkdir(target)
  return target
}

export async function createWorkspaceFile(root: string, parentDir: string, name: string): Promise<string> {
  const parent = assertInsideRoot(root, parentDir)
  const safeName = assertSafeName(name)
  assertAllowedUserCreatedFile(safeName)
  const target = assertInsideRoot(root, joinPath(parent, safeName))
  await assertMissing(target)
  await fs.writeFile(target, defaultFileContent(safeName), 'utf-8')
  return target
}

export async function renameWorkspaceItem(root: string, itemPath: string, nextName: string): Promise<string> {
  const source = assertInsideRoot(root, itemPath)
  const safeName = assertSafeName(nextName)
  const sourceExt = path.extname(source).slice(1).toLowerCase()
  const nextExt = path.extname(safeName).slice(1).toLowerCase()
  if (sourceExt !== 'wld' && nextExt === 'wld') {
    throw new Error('项目设定文件由系统维护，不能新建额外的 .wld 文件')
  }
  const target = assertInsideRoot(root, joinPath(dirnamePath(source), safeName))
  await assertMissing(target)
  await fs.rename(source, target)
  return target
}

export async function deleteWorkspaceItem(root: string, itemPath: string): Promise<void> {
  const target = assertInsideRoot(root, itemPath)
  if (target === path.resolve(root)) throw new Error('不能删除工作区根目录')
  await fs.rm(target, { recursive: true, force: false })
}

export async function readStoryFile(filePath: string): Promise<StoryFile> {
  const ext = path.extname(filePath).slice(1).toLowerCase() as FileExt
  const raw = await fs.readFile(filePath, 'utf-8')
  return parseFile(ext, raw)
}

export async function writeStoryFile(filePath: string, data: StoryFile): Promise<void> {
  await fs.writeFile(filePath, serializeFile(data), 'utf-8')
}

function assertInsideRoot(root: string, target: string): string {
  const pathApi = pathApiFor(root, target)
  const resolvedRoot = pathApi.resolve(root)
  const resolvedTarget = pathApi.resolve(target)
  const normalizedRoot = pathApi.normalize(resolvedRoot)
  const normalizedTarget = pathApi.normalize(resolvedTarget)
  const compareRoot = process.platform === 'win32' ? normalizedRoot.toLowerCase() : normalizedRoot
  const compareTarget = process.platform === 'win32' ? normalizedTarget.toLowerCase() : normalizedTarget
  if (compareTarget !== compareRoot && !compareTarget.startsWith(compareRoot + pathApi.sep)) {
    throw new Error('目标路径不在当前工作区内')
  }
  return resolvedTarget
}

function joinPath(parent: string, child: string): string {
  return pathApiFor(parent).join(parent, child)
}

function dirnamePath(target: string): string {
  return pathApiFor(target).dirname(target)
}

function pathApiFor(...parts: string[]) {
  return parts.some(part => /^[A-Za-z]:[\\/]/.test(part)) ? path.win32 : path
}

function assertSafeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  if (trimmed.includes('/') || trimmed.includes('\\')) throw new Error('名称不能包含路径分隔符')
  if (trimmed === '.' || trimmed === '..') throw new Error('名称无效')
  return trimmed
}

function assertAllowedUserCreatedFile(name: string): void {
  if (path.extname(name).slice(1).toLowerCase() === 'wld') {
    throw new Error('项目设定文件由系统维护，不能新建额外的 .wld 文件')
  }
}

async function assertMissing(target: string): Promise<void> {
  try {
    await fs.access(target)
    throw new Error('同名文件或文件夹已存在')
  } catch (err: any) {
    if (err?.code === 'ENOENT') return
    throw err
  }
}

function defaultFileContent(fileName: string): string {
  const ext = path.extname(fileName).slice(1).toLowerCase()
  const baseName = path.basename(fileName, path.extname(fileName))
  if (ext === 'ep') {
    return serializeFile({
      version: 1,
      episode: 'EP',
      title: baseName,
      status: 'todo',
      logline: '',
      blocks: [
        { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '待填写', time: '日', synopsis: '' },
        { id: 'b2', type: 'action', text: '这里写动作或描述。' },
        { id: 'b3', type: 'dialogue', text: '张山（笑着说）：你还是落到我手上啦' }
      ]
    })
  }
  if (ext === 'md') return `# ${baseName}\n\n## 第一幕\n\n- `
  if (ext === 'chr') {
    return serializeFile({ version: 1, name: baseName, role: '', age: 30, gender: '', alias: '', occupation: '', relationship: '', color: '#e0a458', tagline: '', traits: [], arc: '', voice: '', appearsIn: [], background: '', motivation: '', secret: '', appearance: '' })
  }
  if (ext === 'wld') {
    return serializeFile({ version: 1, title: baseName, sections: createEmptyWorldSections() })
  }
  if (ext === 'cfg') return JSON.stringify(defaultProjectConfig(baseName), null, 2)
  // txt and any other extension → empty file
  return ''
}

/**
 * Rewrite a freshly-created file's content so it matches its current extension.
 * Called after the user renames a new file — e.g. renaming `新建文件.ep` to
 * `笔记.txt` should produce an empty text file, not a screenplay JSON.
 */
export async function applyDefaultContentForExtension(filePath: string): Promise<void> {
  await fs.writeFile(filePath, defaultFileContent(path.basename(filePath)), 'utf-8')
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function readFileBuffer(filePath: string): Promise<Uint8Array> {
  const abs = path.resolve(filePath)
  const buf = await fs.readFile(abs)
  return new Uint8Array(buf)
}

async function extractPdfText(buf: Buffer): Promise<string> {
  // Use the modern, maintained pdf.js (legacy build runs in Node). The old
  // `pdf-parse` bundles a 2016-era pdf.js that fails on most real-world PDFs.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    // We only need text, so disable worker/eval-heavy features
    isEvalSupported: false
  })
  const pdf = await task.promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | undefined
    let line = ''
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = item.transform?.[5]
      if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 1) {
        parts.push(line)
        line = item.str
      } else {
        line += item.str
      }
      lastY = y
    }
    if (line) parts.push(line)
    parts.push('') // blank line between pages
  }
  await pdf.cleanup().catch(() => {})
  return parts.join('\n').trim()
}

export async function readTextFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).slice(1).toLowerCase()

  if (ext === 'pdf') {
    const buf = await fs.readFile(filePath)
    return extractPdfText(buf)
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const buf = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value
  }

  if (ext === 'doc') {
    // Legacy binary .doc is not supported by mammoth — give a helpful message
    throw new Error('暂不支持旧版 .doc 格式，请另存为 .docx 或 .txt 后再上传')
  }

  // Everything else: treat as UTF-8 plain text
  return fs.readFile(filePath, 'utf-8')
}

export function watchDir(dir: string, onChange: (event: string, filename: string) => void): () => void {
  const watcher = fsSync.watch(dir, { recursive: true }, (event, filename) => {
    if (filename) onChange(event, filename)
  })
  return () => watcher.close()
}

// ─── Workspace search & replace ──────────────────────────────────────────────

// Extensions whose text is readable but NOT writable for replace (binary source)
const READONLY_TEXT_EXTS = new Set(['pdf', 'docx', 'doc'])

function buildSearchRegex(query: string, opts: SearchOptions): RegExp | null {
  if (!query) return null
  let pattern = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`
  try {
    return new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

async function collectFiles(dir: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (await isHiddenEntry(e.name, full)) continue
    if (e.isDirectory()) await collectFiles(full, out)
    else if (e.isFile()) out.push(full)
  }
}

/**
 * Search across all workspace files for a query string (or regex).
 * Returns per-file line matches. Binary docs (pdf/docx) are searched via
 * extracted text but cannot be replaced.
 */
export async function searchInFiles(root: string, query: string, opts: SearchOptions = {}): Promise<FileSearchResult[]> {
  const regex = buildSearchRegex(query, opts)
  if (!regex) return []

  const files: string[] = []
  await collectFiles(root, files)

  const results: FileSearchResult[] = []
  let totalMatches = 0
  const MAX_MATCHES = 2000

  for (const filePath of files) {
    if (totalMatches >= MAX_MATCHES) break
    const ext = path.extname(filePath).slice(1).toLowerCase()

    // Skip very large files to keep search responsive
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > 5 * 1024 * 1024) continue
    } catch {
      continue
    }

    let text: string
    try {
      text = await readTextFile(filePath)
    } catch {
      continue // skip unreadable/binary files
    }

    const lines = text.split(/\r?\n/)
    const matches: SearchMatch[] = []
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(lineText)) !== null) {
        matches.push({
          line: i + 1,
          column: m.index,
          length: m[0].length,
          lineText: lineText.length > 240 ? lineText.slice(0, 240) + '…' : lineText
        })
        totalMatches++
        if (m[0].length === 0) regex.lastIndex++ // avoid infinite loop on empty matches
        if (matches.length >= 100 || totalMatches >= MAX_MATCHES) break
      }
      if (matches.length >= 100 || totalMatches >= MAX_MATCHES) break
    }

    if (matches.length > 0) {
      results.push({
        path: filePath,
        relPath: path.relative(root, filePath).replace(/\\/g, '/'),
        name: path.basename(filePath),
        ext,
        matches
      })
    }
  }
  return results
}

/**
 * Replace all occurrences of `query` with `replacement` in a single file.
 * Returns the number of replacements made. Skips binary/read-only files.
 */
export async function replaceInFile(filePath: string, query: string, replacement: string, opts: SearchOptions = {}): Promise<number> {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  if (READONLY_TEXT_EXTS.has(ext)) return 0

  const regex = buildSearchRegex(query, opts)
  if (!regex) return 0

  const text = await fs.readFile(filePath, 'utf-8')
  let count = 0
  const next = text.replace(regex, () => { count++; return replacement })
  if (count > 0) await fs.writeFile(filePath, next, 'utf-8')
  return count
}

// ─── New project scaffold ─────────────────────────────────────────────────────

function defaultLayoutForType(type: ProjectType): ScreenplayLayout {
  if (type === 'short') return 'single-file-multi-episode'
  if (type === 'film') return 'single-film-file'
  return 'one-file-per-episode'
}

function defaultDurationForType(type: ProjectType) {
  if (type === 'short') return 3
  if (type === 'film') return 100
  return 45
}

function defaultProjectConfig(name: string, type: ProjectType = 'series'): ProjectConfigFile {
  return {
    version: 1,
    kind: 'storyclaw-project',
    name,
    type,
    genre: '',
    synopsis: '',
    episodes: type === 'film' ? 1 : 12,
    episodeDurationMinutes: defaultDurationForType(type),
    screenplayLayout: defaultLayoutForType(type)
  }
}

export async function scaffoldProject(opts: NewProjectOptions): Promise<string> {
  const root = path.join(opts.targetDir, opts.name)
  await fs.mkdir(root, { recursive: true })

  const dirs = ['大纲', '剧集', '人物', '设定', '参考']
  for (const d of dirs) await fs.mkdir(path.join(root, d), { recursive: true })

  const projectConfig: ProjectConfigFile = {
    ...defaultProjectConfig(opts.name, opts.type),
    genre: opts.genre ?? '',
    synopsis: opts.synopsis ?? '',
    episodes: Math.max(1, Number(opts.episodes) || 1),
    episodeDurationMinutes: Math.max(1, Number(opts.episodeDurationMinutes ?? defaultDurationForType(opts.type)) || defaultDurationForType(opts.type)),
    screenplayLayout: opts.screenplayLayout ?? defaultLayoutForType(opts.type)
  }
  await fs.writeFile(path.join(root, '项目配置.cfg'), JSON.stringify(projectConfig, null, 2), 'utf-8')

  // 全剧大纲（纯 Markdown）— 两种项目类型都生成
  await fs.writeFile(path.join(root, '大纲', '全剧大纲.md'), '# 全剧大纲\n\n## 第一幕\n\n- \n\n## 第二幕\n\n- \n\n## 第三幕\n\n- ', 'utf-8')

  const chr = serializeFile({ version: 1, name: '主角', role: '主角', age: 30, gender: '', alias: '', occupation: '', relationship: '', color: '#e0a458', tagline: '', traits: [], arc: '', voice: '', appearsIn: [], background: '', motivation: '', secret: '', appearance: '' })
  await fs.writeFile(path.join(root, '人物', '主角.chr'), chr, 'utf-8')

  const wld = serializeFile({ version: 1, title: '项目设定', sections: createEmptyWorldSections() })
  await fs.writeFile(path.join(root, '设定', '项目设定.wld'), wld, 'utf-8')

  return root
}

// ─── File clipboard operations ──────────────────────────────────────────────

export async function copyItem(root: string, sourcePath: string, targetParentDir: string): Promise<string> {
  const source = assertInsideRoot(root, sourcePath)
  const target = assertInsideRoot(root, targetParentDir)
  const basename = path.basename(source)
  let destPath = path.join(target, basename)
  let counter = 1

  const stats = await fs.stat(source)

  if (stats.isDirectory()) {
    while (true) {
      try {
        await fs.access(destPath)
        destPath = path.join(target, `${path.basename(source, path.extname(source))} (${counter})${path.extname(source)}`)
        counter++
      } catch {
        break
      }
    }
    await fs.cp(source, destPath, { recursive: true, force: false })
  } else {
    const ext = path.extname(basename)
    const nameWithoutExt = path.basename(basename, ext)

    while (true) {
      try {
        await fs.access(destPath)
        destPath = path.join(target, `${nameWithoutExt} (${counter})${ext}`)
        counter++
      } catch {
        break
      }
    }
    await fs.copyFile(source, destPath)
  }

  return destPath
}

export async function moveItem(root: string, sourcePath: string, targetParentDir: string): Promise<string> {
  const source = assertInsideRoot(root, sourcePath)
  const target = assertInsideRoot(root, targetParentDir)
  const basename = path.basename(source)
  const destPath = path.join(target, basename)

  await fs.rename(source, destPath)
  return destPath
}

// ─── File upload / attachments ───────────────────────────────────────────────

// Chat attachments live under the hidden config dir so they don't pollute the
// project tree (大纲/剧集/人物/设定/参考). They're per-conversation scratch files.
const ATTACHMENTS_DIR = path.join('.storyclaw', 'attachments')

/**
 * Copy external (or workspace) files into a target directory, de-duplicating
 * names with a `(n)` suffix. Used by both reference upload and drag-and-drop import.
 */
async function copyFilesInto(root: string, sourcePaths: string[], targetDir: string): Promise<UploadedReference[]> {
  await fs.mkdir(targetDir, { recursive: true })
  const results: UploadedReference[] = []
  for (const source of sourcePaths) {
    const ext = path.extname(source)
    const nameWithoutExt = path.basename(source, ext)
    let destPath = path.join(targetDir, `${nameWithoutExt}${ext}`)
    let counter = 1
    while (true) {
      try {
        await fs.access(destPath)
        destPath = path.join(targetDir, `${nameWithoutExt} (${counter})${ext}`)
        counter++
      } catch {
        break
      }
    }
    // Skip copying a file onto itself
    if (path.resolve(source) === path.resolve(destPath)) continue
    const stat = await fs.stat(source)
    if (stat.isDirectory()) {
      await fs.cp(source, destPath, { recursive: true, force: false })
    } else {
      await fs.copyFile(source, destPath)
    }
    results.push({
      absPath: destPath,
      relPath: path.relative(root, destPath).replace(/\\/g, '/'),
      name: path.basename(destPath)
    })
  }
  return results
}

/**
 * Copy uploaded chat files into the hidden per-project attachments directory
 * (`.storyclaw/attachments/`). These are conversation scratch files — readable
 * by the agent but kept out of the project file tree so they don't clutter it.
 */
export async function uploadAttachments(root: string, sourcePaths: string[]): Promise<UploadedReference[]> {
  return copyFilesInto(root, sourcePaths, path.join(root, ATTACHMENTS_DIR))
}

/**
 * Import arbitrary external files (e.g. dragged from the OS) into a target
 * directory inside the workspace. `targetDir` must be inside the workspace.
 */
export async function importExternalFiles(root: string, sourcePaths: string[], targetDir: string): Promise<UploadedReference[]> {
  const safeTarget = assertInsideRoot(root, targetDir)
  return copyFilesInto(root, sourcePaths, safeTarget)
}

export async function importScreenplayFile(root: string, sourcePath: string, targetDir: string): Promise<UploadedReference> {
  const safeTarget = assertInsideRoot(root, targetDir)
  await fs.mkdir(safeTarget, { recursive: true })
  const ext = path.extname(sourcePath).slice(1).toLowerCase()
  if (!['pdf', 'docx', 'txt'].includes(ext)) {
    throw new Error('仅支持导入 PDF、DOCX、TXT 剧本')
  }

  const title = path.basename(sourcePath, path.extname(sourcePath))
  const text = await readTextFile(sourcePath)
  // 先尝试用格式模板库自动匹配；命中可信则套用，否则回退启发式格式化
  let content: string
  try {
    const ranked = rankTemplates(text, await loadAllTemplates())
    const best = ranked[0]
    content = best && isConfidentMatch(best.stats)
      ? applyTemplate(text, best.template, { title, episode: 'EP' }).markup
      : formatImportedScreenplayText({ text, title })
  } catch {
    content = formatImportedScreenplayText({ text, title })
  }
  const destPath = await nextAvailablePath(safeTarget, `${title}.ep`)
  await fs.writeFile(destPath, content, 'utf-8')
  return {
    absPath: destPath,
    relPath: path.relative(root, destPath).replace(/\\/g, '/'),
    name: path.basename(destPath)
  }
}

export async function importScreenplayFiles(root: string, sourcePaths: string[], targetDir: string): Promise<UploadedReference[]> {
  const results: UploadedReference[] = []
  for (const sourcePath of sourcePaths) {
    results.push(await importScreenplayFile(root, sourcePath, targetDir))
  }
  return results
}

async function nextAvailablePath(parentDir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName)
  const nameWithoutExt = path.basename(fileName, ext)
  let destPath = path.join(parentDir, fileName)
  let counter = 1
  while (true) {
    try {
      await fs.access(destPath)
      destPath = path.join(parentDir, `${nameWithoutExt} (${counter})${ext}`)
      counter++
    } catch {
      return destPath
    }
  }
}
