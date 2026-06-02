import { useEffect, useMemo, useState } from 'react'
import type { VersionDiff } from '../../types'
import {
  formatVersionDiffLines,
  splitVersionDiffByFile,
  type VersionDiffFileSection,
  type VersionDiffHunk,
  type VersionDiffLine
} from './versionDiff'

export interface VersionCompareViewProps {
  root?: string | null
  diff: VersionDiff | null
  onClose?: () => void
}

type SplitRow =
  | { kind: 'hunk'; header: string; index: number }
  | {
      kind: 'pair'
      left?: { text: string; kind: VersionDiffLine['kind']; lineNumber?: number }
      right?: { text: string; kind: VersionDiffLine['kind']; lineNumber?: number }
      index: number
    }

export function VersionCompareView({ root, diff, onClose }: VersionCompareViewProps) {
  const parsedFiles = useMemo(() => splitVersionDiffByFile(diff?.patch ?? ''), [diff?.patch])
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [activeHunk, setActiveHunk] = useState(0)

  const files = useMemo(() => {
    if (!diff?.files?.length) return parsedFiles
    return diff.files
      .map(file => {
        const parsed = parsedFiles.find(item => item.path === file.path)
        return parsed ?? { path: file.path, additions: file.additions, deletions: file.deletions, lines: [], hunks: [] }
      })
  }, [diff?.files, parsedFiles])

  useEffect(() => {
    const next = files[0]?.path ?? ''
    setSelectedPath(current => (current && files.some(file => file.path === current) ? current : next))
  }, [files])

  useEffect(() => {
    setActiveHunk(0)
  }, [selectedPath])

  const selectedFile = useMemo(() => {
    if (!selectedPath) return files[0] ?? null
    return files.find(file => file.path === selectedPath) ?? files[0] ?? null
  }, [files, selectedPath])

  const currentSection = useMemo(() => {
    if (!selectedFile) return null
    return parsedFiles.find(file => file.path === selectedFile.path) ?? null
  }, [parsedFiles, selectedFile])

  const title = root ? root.split(/[\\/]/).pop() ?? root : '版本对比'
  const headerLines = useMemo(() => formatVersionDiffLines(diff?.patch ?? ''), [diff?.patch])

  if (!diff) {
    return (
      <div className="version-compare">
        <div className="version-compare-head">
          <div>
            <div className="version-compare-kicker">{title}</div>
            <div className="version-compare-title">版本对比</div>
          </div>
          {onClose && <button className="mini-btn" onClick={onClose}>关闭</button>}
        </div>
        <div className="version-compare-empty">选择两个版本后，这里会显示文件级对比。</div>
      </div>
    )
  }

  return (
    <div className="version-compare">
      <div className="version-compare-head">
        <div>
          <div className="version-compare-kicker">{title}</div>
          <div className="version-compare-title">版本对比</div>
        </div>
        <div className="version-compare-head-actions">
          {onClose && <button className="mini-btn" onClick={onClose}>关闭</button>}
        </div>
      </div>

      <div className="version-compare-body">
        <aside className="version-compare-files" aria-label="文件列表">
          <div className="version-compare-section-title">文件</div>
          {files.length ? files.map(file => (
            <button
              key={file.path}
              type="button"
              className={`version-compare-file${file.path === selectedPath ? ' active' : ''}`}
              aria-pressed={file.path === selectedPath}
              aria-label={file.path}
              onClick={() => setSelectedPath(file.path)}
            >
              <span className="version-compare-file-name">{file.path}</span>
              <span className="version-compare-file-stat">
                <b className="add">+{file.additions}</b>
                <b className="del">-{file.deletions}</b>
              </span>
            </button>
          )) : (
            <div className="version-compare-empty small">没有可展示的文件差异。</div>
          )}
        </aside>

        <section className="version-compare-main">
          <div className="version-compare-toolbar">
            <div className="version-compare-file-title">{selectedFile?.path ?? '未选择文件'}</div>
            <div className="version-compare-hunks" aria-label="Hunk 导航">
              {currentSection?.hunks.length ? currentSection.hunks.map((hunk, index) => (
                <button
                  key={`${hunk.header}-${index}`}
                  type="button"
                  className={`version-compare-hunk${index === activeHunk ? ' active' : ''}`}
                  aria-pressed={index === activeHunk}
                  aria-label={`Hunk ${index + 1}`}
                  onClick={() => setActiveHunk(index)}
                >
                  H{index + 1}
                </button>
              )) : <span className="version-compare-hint">没有 hunk</span>}
            </div>
          </div>

          <div className="version-compare-pane">
            {currentSection?.hunks.length ? currentSection.hunks.map((hunk, index) => (
              <article
                key={`${hunk.header}-${index}`}
                className={`version-compare-hunk-block${index === activeHunk ? ' active' : ''}`}
              >
                <div className="version-compare-hunk-header">{hunk.header}</div>
                <div className="version-compare-grid">
                  <div className="version-compare-col-head">原文</div>
                  <div className="version-compare-col-head">修改后</div>
                  {buildSplitRowsForHunk(hunk).map(row => renderSplitRow(row))}
                </div>
              </article>
            )) : (
              <div className="version-compare-empty">该文件没有可解析的文本 hunk。</div>
            )}
          </div>

          <div className="version-compare-meta">
            <span>{diff.fromId.slice(0, 7)}</span>
            <span>→</span>
            <span>{diff.toId.slice(0, 7)}</span>
            <span>{headerLines.length} 行</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function buildSplitRowsForHunk(hunk: VersionDiffHunk): Extract<SplitRow, { kind: 'pair' }>[] {
  const rows: Extract<SplitRow, { kind: 'pair' }>[] = []
  let leftLine = 0
  let rightLine = 0

  for (let index = 0; index < hunk.lines.length; index += 1) {
    const line = hunk.lines[index]

    if (line.kind === 'context') {
      leftLine += 1
      rightLine += 1
      rows.push({
        kind: 'pair',
        index: rows.length,
        left: { text: line.text, kind: line.kind, lineNumber: leftLine },
        right: { text: line.text, kind: line.kind, lineNumber: rightLine }
      })
      continue
    }

    if (line.kind === 'del') {
      const next = hunk.lines[index + 1]
      if (next?.kind === 'add') {
        leftLine += 1
        rightLine += 1
        rows.push({
          kind: 'pair',
          index: rows.length,
          left: { text: line.text, kind: line.kind, lineNumber: leftLine },
          right: { text: next.text, kind: next.kind, lineNumber: rightLine }
        })
        index += 1
        continue
      }
      leftLine += 1
      rows.push({
        kind: 'pair',
        index: rows.length,
        left: { text: line.text, kind: line.kind, lineNumber: leftLine }
      })
      continue
    }

    if (line.kind === 'add') {
      rightLine += 1
      rows.push({
        kind: 'pair',
        index: rows.length,
        right: { text: line.text, kind: line.kind, lineNumber: rightLine }
      })
    }
  }

  return rows
}

function renderSplitRow(row: SplitRow) {
  if (row.kind === 'hunk') {
    return (
      <div key={`${row.header}-${row.index}`} className="version-compare-hunk-spacer">
        <div className="version-compare-hunk-divider">{row.header}</div>
      </div>
    )
  }

  return (
    <div key={row.index} className="version-compare-row">
      <div className={`version-compare-cell left ${row.left?.kind ?? 'empty'}`}>
        {row.left?.lineNumber !== undefined && <span className="version-compare-lno">{row.left.lineNumber}</span>}
        <span className="version-compare-text">{stripMarker(row.left?.text ?? '')}</span>
      </div>
      <div className={`version-compare-cell right ${row.right?.kind ?? 'empty'}`}>
        {row.right?.lineNumber !== undefined && <span className="version-compare-lno">{row.right.lineNumber}</span>}
        <span className="version-compare-text">{stripMarker(row.right?.text ?? '')}</span>
      </div>
    </div>
  )
}

function stripMarker(text: string): string {
  if (!text) return ''
  if (text.startsWith('+') || text.startsWith('-')) return text.slice(1)
  return text
}
