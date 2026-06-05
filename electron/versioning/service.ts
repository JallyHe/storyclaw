import { execFile } from 'node:child_process'
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const APP_DIR = '.storyclaw'
const DEFAULT_BRANCH = 'storyclaw-main'
const initLocks = new Map<string, Promise<void>>()
const LINE_NAMES: Record<VersionLineKind, string> = {
  main: '主版本',
  director: '导演版',
  platform: '平台修改版'
}

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
  status: 'added' | 'modified' | 'deleted' | 'renamed'
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

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8
  })
  return stdout.trim()
}

async function hasGitDir(root: string): Promise<boolean> {
  try {
    await access(path.join(root, '.git'))
    return true
  } catch {
    return false
  }
}

async function ensureIgnore(root: string): Promise<void> {
  const filePath = path.join(root, '.gitignore')
  const marker = `${APP_DIR}/`
  const current = await readFile(filePath, 'utf-8').catch(() => '')
  if (current.split(/\r?\n/).some(line => line.trim() === marker)) return
  const prefix = current.length && !current.endsWith('\n') ? '\n' : ''
  await writeFile(filePath, `${current}${prefix}${marker}\n`, { encoding: 'utf-8' })
}

export async function ensureVersioning(root: string): Promise<void> {
  if (initLocks.has(root)) {
    await initLocks.get(root)
    return
  }

  let resolveInit!: () => void
  let rejectInit!: (err: unknown) => void
  const initPromise = new Promise<void>((resolve, reject) => {
    resolveInit = resolve
    rejectInit = reject
  })
  initLocks.set(root, initPromise)
  try {
    if (!(await hasGitDir(root))) {
      try {
        await runGit(root, ['init', '-b', DEFAULT_BRANCH])
      } catch (err: any) {
        if (!(await hasGitDir(root))) throw err
      }
    }
    await runGit(root, ['config', 'user.name', 'StoryClaw']).catch(() => undefined)
    await runGit(root, ['config', 'user.email', 'versions@storyclaw.local']).catch(() => undefined)
    await ensureIgnore(root)
    resolveInit()
    await initPromise
  } catch (err) {
    rejectInit(err)
    await initPromise.catch(() => undefined)
    throw err
  } finally {
    initLocks.delete(root)
  }
}

async function hasChanges(root: string): Promise<boolean> {
  await ensureVersioning(root)
  const status = await runGit(root, ['status', '--porcelain'])
  return status.length > 0
}

async function hasCommits(root: string): Promise<boolean> {
  await ensureVersioning(root)
  try {
    await runGit(root, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

function lineNameFromBranch(branch: string): string {
  if (branch === DEFAULT_BRANCH) return LINE_NAMES.main
  if (branch === 'storyclaw-director') return LINE_NAMES.director
  if (branch === 'storyclaw-platform') return LINE_NAMES.platform
  return branch.replace(/^storyclaw-/, '')
}

function branchFromKind(kind: VersionLineKind): string {
  if (kind === 'main') return DEFAULT_BRANCH
  return `storyclaw-${kind}`
}

export async function saveVersion(root: string, message: string): Promise<VersionRecord> {
  await ensureVersioning(root)
  await runGit(root, ['add', '-A'])
  const changed = await hasChanges(root)
  if (!changed && await hasCommits(root)) {
    const [record] = await listRecords(root, 1)
    return record
  }
  const safeMessage = message.trim() || '保存版本'
  await runGit(root, ['commit', '-m', safeMessage, '--allow-empty'])
  const [record] = await listRecords(root, 1)
  return record
}

export async function createVersionLine(root: string, kind: Exclude<VersionLineKind, 'main'>): Promise<VersionSnapshot> {
  await ensureVersioning(root)
  if (!(await hasCommits(root))) {
    await saveVersion(root, '创建初始版本')
  } else if (await hasChanges(root)) {
    await saveVersion(root, `创建${LINE_NAMES[kind]}前保存`)
  }
  const branch = branchFromKind(kind)
  const branches = await listBranches(root)
  if (branches.includes(branch)) {
    await runGit(root, ['checkout', branch])
  } else {
    await runGit(root, ['checkout', '-b', branch])
  }
  return getVersionSnapshot(root)
}

export async function markFinalVersion(root: string): Promise<VersionRecord> {
  await ensureVersioning(root)
  if (await hasChanges(root) || !(await hasCommits(root))) {
    await saveVersion(root, '标记定稿前保存')
  }
  const id = await runGit(root, ['rev-parse', 'HEAD'])
  const tagName = `storyclaw-final-${new Date().toISOString().replace(/[:.]/g, '-')}`
  await runGit(root, ['tag', '-a', tagName, '-m', '定稿', id])
  const [record] = await listRecords(root, 1)
  return { ...record, isFinal: true, label: '定稿' }
}

export async function restoreVersion(root: string, versionId: string): Promise<VersionSnapshot> {
  await ensureVersioning(root)
  await runGit(root, ['rev-parse', '--verify', versionId])
  await saveSafetyVersion(root, `恢复前备份 ${new Date().toLocaleString('zh-CN')}`)
  await runGit(root, ['checkout', versionId, '--', '.'])
  await saveVersion(root, '恢复到历史版本')
  return getVersionSnapshot(root)
}

async function saveSafetyVersion(root: string, message: string): Promise<void> {
  await runGit(root, ['add', '-A'])
  await runGit(root, ['commit', '-m', message, '--allow-empty'])
}

export async function getVersionSnapshot(root: string): Promise<VersionSnapshot> {
  await ensureVersioning(root)
  const currentBranch = await currentBranchName(root)
  const records = await listRecords(root, 50)
  const branches = await listBranches(root)
  const currentFiles = await listWorkingFiles(root)
  return {
    currentLine: lineNameFromBranch(currentBranch),
    hasChanges: currentFiles.length > 0,
    lines: branches.map(branch => ({
      id: branch,
      name: lineNameFromBranch(branch),
      current: branch === currentBranch
    })),
    currentFiles,
    records
  }
}

export async function compareVersions(root: string, fromId: string, toId: string): Promise<VersionDiff> {
  await ensureVersioning(root)
  const stats = await runGit(root, ['diff', '--numstat', fromId, toId]).catch(() => '')
  const files = stats.split('\n').filter(Boolean).map(row => {
    const [adds, dels, filePath] = row.split('\t')
    return {
      path: filePath,
      additions: Number(adds) || 0,
      deletions: Number(dels) || 0
    }
  })
  const patch = await runGit(root, ['diff', '--unified=2', '--no-ext-diff', fromId, toId]).catch(() => '')
  return { fromId, toId, files, patch }
}

export async function compareWorkingFile(root: string, filePath: string): Promise<VersionDiff> {
  await ensureVersioning(root)
  const relativePath = normalizeWorkingPath(root, filePath)
  if (!(await hasCommits(root))) {
    return compareNewWorkingFile(root, relativePath)
  }

  const stats = await runGit(root, ['diff', '--numstat', 'HEAD', '--', relativePath]).catch(() => '')
  const files = stats.split('\n').filter(Boolean).map(row => {
    const [adds, dels, changedPath] = row.split('\t')
    return {
      path: changedPath || relativePath,
      additions: Number(adds) || 0,
      deletions: Number(dels) || 0
    }
  })
  const patch = await runGit(root, ['diff', '--unified=2', '--no-ext-diff', 'HEAD', '--', relativePath]).catch(() => '')
  if (patch || files.length > 0) return { fromId: 'HEAD', toId: 'WORKTREE', files, patch }
  return compareNewWorkingFile(root, relativePath)
}

function normalizeWorkingPath(root: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
  const relative = path.relative(root, absolute).replace(/\\/g, '/')
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('目标路径不在当前工作区内')
  }
  return relative
}

async function compareNewWorkingFile(root: string, relativePath: string): Promise<VersionDiff> {
  const absolute = path.join(root, relativePath)
  try {
    const info = await stat(absolute)
    if (info.isDirectory()) return { fromId: 'HEAD', toId: 'WORKTREE', files: [], patch: '' }
  } catch {
    return {
      fromId: 'HEAD',
      toId: 'WORKTREE',
      files: [{ path: relativePath, additions: 0, deletions: 0 }],
      patch: `diff --git a/${relativePath} b/${relativePath}\ndeleted file mode 100644\n--- a/${relativePath}\n+++ /dev/null\n`
    }
  }

  const text = await readFile(absolute, 'utf-8').catch(() => '')
  const lines = text.split(/\r?\n/)
  const body = lines.map(line => `+${line}`).join('\n')
  return {
    fromId: 'HEAD',
    toId: 'WORKTREE',
    files: [{ path: relativePath, additions: lines.filter(line => line.length > 0).length, deletions: 0 }],
    patch: [
      `diff --git a/${relativePath} b/${relativePath}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${relativePath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      body
    ].join('\n')
  }
}

async function currentBranchName(root: string): Promise<string> {
  try {
    return await runGit(root, ['branch', '--show-current'])
  } catch {
    return DEFAULT_BRANCH
  }
}

async function listBranches(root: string): Promise<string[]> {
  await ensureVersioning(root)
  const raw = await runGit(root, ['branch', '--format=%(refname:short)']).catch(() => '')
  const branches = raw.split('\n').map(item => item.trim()).filter(Boolean)
  return branches.length ? branches : [DEFAULT_BRANCH]
}

async function listFinalCommits(root: string): Promise<Set<string>> {
  const raw = await runGit(root, ['tag', '--list', 'storyclaw-final-*']).catch(() => '')
  const tags = raw.split('\n').map(item => item.trim()).filter(Boolean)
  const commits = await Promise.all(tags.map(tag => runGit(root, ['rev-list', '-n', '1', tag]).catch(() => '')))
  return new Set(commits.filter(Boolean))
}

async function changedFilesForCommit(root: string, id: string): Promise<string[]> {
  const raw = await runGit(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', id]).catch(() => '')
  return raw.split('\n').map(item => item.trim()).filter(Boolean)
}

function workingStatusFromCode(code: string): VersionWorkingFile['status'] {
  if (code.includes('R')) return 'renamed'
  if (code.includes('D')) return 'deleted'
  if (code.includes('A')) return 'added'
  if (code.includes('?')) return 'added'
  return 'modified'
}

function normalizePorcelainPath(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return trimmed
}

async function listWorkingFiles(root: string): Promise<VersionWorkingFile[]> {
  await ensureVersioning(root)
  const raw = await runGit(root, ['status', '--porcelain']).catch(() => '')
  const entries = await Promise.all(raw.split('\n').filter(Boolean).map(async row => {
    const match = /^(.{2})\s+(.+)$/u.exec(row)
    const code = match?.[1] ?? row.slice(0, 2)
    const rawPath = (match?.[2] ?? row.slice(2)).trim()
    const renamedPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) ?? rawPath : rawPath
    const normalizedPath = normalizePorcelainPath(renamedPath)
    const status = workingStatusFromCode(code)
    if (code.includes('?')) {
      const expanded = await expandUntrackedPath(root, normalizedPath)
      if (expanded.length > 0) return expanded.map(filePath => ({ path: filePath, status }))
    }
    return {
      path: normalizedPath,
      status
    }
  }))
  return entries.flat().sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
}

async function expandUntrackedPath(root: string, relativePath: string): Promise<string[]> {
  const absolute = path.join(root, relativePath)
  const info = await stat(absolute).catch(() => null)
  if (!info) return []
  if (info.isFile()) return [relativePath.replace(/\\/g, '/')]
  if (!info.isDirectory()) return []
  const files: string[] = []
  const walk = async (dir: string) => {
    const items = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const item of items) {
      if (item.name === '.git' || item.name === APP_DIR) continue
      const fullPath = path.join(dir, item.name)
      if (item.isDirectory()) {
        await walk(fullPath)
      } else if (item.isFile()) {
        files.push(path.relative(root, fullPath).replace(/\\/g, '/'))
      }
    }
  }
  await walk(absolute)
  return files
}

async function lineNameForCommit(root: string, id: string, fallbackBranch: string): Promise<string> {
  const raw = await runGit(root, ['branch', '--contains', id, '--format=%(refname:short)']).catch(() => '')
  const branches = raw.split('\n').map(item => item.trim()).filter(Boolean)
  const preferred = branches.find(branch => branch === DEFAULT_BRANCH)
    ?? branches.find(branch => branch === 'storyclaw-director')
    ?? branches.find(branch => branch === 'storyclaw-platform')
  return lineNameFromBranch(preferred ?? fallbackBranch)
}

async function listRecords(root: string, max: number): Promise<VersionRecord[]> {
  if (!(await hasCommits(root))) return []
  const currentBranch = await currentBranchName(root)
  const finalCommits = await listFinalCommits(root)
  const raw = await runGit(root, ['log', `-${max}`, '--date=iso-strict', '--format=%H%x1f%h%x1f%cI%x1f%s']).catch(() => '')
  const rows = raw.split('\n').filter(Boolean)
  const records = await Promise.all(rows.map(async row => {
    const [id, shortId, createdAt, message] = row.split('\x1f')
    const isFinal = finalCommits.has(id)
    return {
      id,
      shortId,
      message,
      createdAt,
      changedFiles: await changedFilesForCommit(root, id),
      lineName: await lineNameForCommit(root, id, currentBranch),
      isFinal,
      label: isFinal ? '定稿' : undefined
    }
  }))
  return records
}
