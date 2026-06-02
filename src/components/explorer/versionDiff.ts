export type VersionDiffLineKind = 'meta' | 'hunk' | 'add' | 'del' | 'context'

export interface VersionDiffLine {
  kind: VersionDiffLineKind
  text: string
}

export interface VersionDiffHunk {
  header: string
  lines: VersionDiffLine[]
}

export interface VersionDiffFileSection {
  path: string
  additions: number
  deletions: number
  lines: VersionDiffLine[]
  hunks: VersionDiffHunk[]
  oldPath?: string
  newPath?: string
}

interface FileSectionBuilder {
  lines: VersionDiffLine[]
  hunks: VersionDiffHunk[]
  activeHunk: VersionDiffHunk | null
  additions: number
  deletions: number
  oldPath?: string
  newPath?: string
  headerPath?: string
}

export function formatVersionDiffLines(patch: string): VersionDiffLine[] {
  return patch
    .split('\n')
    .map(line => ({
      kind: classifyPatchLine(line),
      text: line
    }))
}

export function splitVersionDiffByFile(patch: string): VersionDiffFileSection[] {
  const sections: VersionDiffFileSection[] = []
  let current: FileSectionBuilder | null = null

  const pushCurrent = () => {
    if (!current) return
    sections.push({
      path: current.newPath ?? current.oldPath ?? current.headerPath ?? 'unknown',
      additions: current.additions,
      deletions: current.deletions,
      lines: current.lines,
      hunks: current.hunks,
      oldPath: current.oldPath,
      newPath: current.newPath
    })
    current = null
  }

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      pushCurrent()
      current = {
        lines: [{ kind: 'meta', text: line }],
        hunks: [],
        activeHunk: null,
        additions: 0,
        deletions: 0,
        ...parseDiffHeader(line)
      }
      continue
    }

    if (!current) continue

    const kind = classifyPatchLine(line)
    const entry = { kind, text: line }
    current.lines.push(entry)

    if (kind === 'hunk') {
      current.activeHunk = { header: line, lines: [] }
      current.hunks.push(current.activeHunk)
      continue
    }

    if (line.startsWith('--- ')) {
      current.oldPath = normalizePatchPath(line.slice(4))
      continue
    }

    if (line.startsWith('+++ ')) {
      current.newPath = normalizePatchPath(line.slice(4))
      continue
    }

    if (line.startsWith('+') && !line.startsWith('+++')) current.additions += 1
    if (line.startsWith('-') && !line.startsWith('---')) current.deletions += 1

    if (current.activeHunk) current.activeHunk.lines.push(entry)
  }

  pushCurrent()
  return sections
}

function parseDiffHeader(line: string): Pick<FileSectionBuilder, 'oldPath' | 'newPath' | 'headerPath'> {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
  if (!match) return {}
  const [, oldPath, newPath] = match
  return {
    oldPath: normalizePatchPath(oldPath),
    newPath: normalizePatchPath(newPath),
    headerPath: normalizePatchPath(newPath)
  }
}

function normalizePatchPath(path: string): string {
  return path
    .replace(/^a\//, '')
    .replace(/^b\//, '')
    .trim()
}

function classifyPatchLine(line: string): VersionDiffLineKind {
  if (!line) return 'context'
  if (line.startsWith('diff --git ') || line.startsWith('index ')) return 'meta'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+++ ') || line.startsWith('--- ')) return 'meta'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return 'context'
}
