import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FILE_KIND, Ic } from '@/components/icons'
import { versionIpc } from '@/ipc/version'
import { workspaceIpc } from '@/ipc/workspace'
import { useChangesStore, useTabsStore, useWorkspaceStore } from '@/store'
import type { DiffBlock, VersionDiff, VersionRecord, VersionSnapshot, VersionWorkingFile } from '@/types'
import { VersionCompareView } from './VersionCompareView'

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusLabel(status: VersionWorkingFile['status']) {
  switch (status) {
    case 'added': return '新增'
    case 'deleted': return '删除'
    case 'renamed': return '重命名'
    default: return '修改'
  }
}

function statusShort(status: VersionWorkingFile['status']) {
  switch (status) {
    case 'added': return 'A'
    case 'deleted': return 'D'
    case 'renamed': return 'R'
    default: return 'M'
  }
}

function basename(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function blockPreview(block: DiffBlock['blk']): string {
  if (block.type === 'character') return block.name + (block.ext ? `（${block.ext}）` : '')
  if (block.type === 'scene') return [`第 ${block.number} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ') || '场景'
  return block.text || block.type
}

function relativeToRoot(root: string, filePath: string) {
  const normalizedRoot = root.replace(/[\\/]+$/, '').toLowerCase()
  const normalizedPath = filePath.toLowerCase()
  if (!normalizedPath.startsWith(normalizedRoot)) return filePath
  return filePath.slice(root.replace(/[\\/]+$/, '').length).replace(/^[\\/]/, '').replace(/\\/g, '/')
}

function ScmFileCard({ fileId, diffBlocks, onOpen, onAccept, onReject }: {
  fileId: string
  diffBlocks: DiffBlock[]
  onOpen: (id: string, block?: DiffBlock['blk']) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  const ext = fileId.split('.').pop() ?? ''
  const name = fileId.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? fileId
  const kind = FILE_KIND[ext] ?? { icon: Ic.diffFile, color: 'var(--accent)' }
  const added = diffBlocks.filter(b => b.diff === 'add').length
  const removed = diffBlocks.filter(b => b.diff === 'del').length
  const firstChangedBlock = diffBlocks.find(block => block.diff)?.blk

  return (
    <div className="scm-file-card compact">
      <div className="scm-file-h">
        <span className="file-ico" style={{ color: kind.color }}>
          <kind.icon width={14} height={14} />
        </span>
        <button type="button" className="scm-file-name" onClick={() => onOpen(fileId, firstChangedBlock)}>
          {name}<span className="file-ext">.{ext}</span>
        </button>
        <span className="scm-stat">
          {added > 0 && <span style={{ color: 'var(--diff-add-fg)' }}>+{added}</span>}
          {removed > 0 && <span style={{ color: 'var(--diff-del-fg)' }}>-{removed}</span>}
        </span>
      </div>
      <div className="scm-diff-mini">
        {diffBlocks.filter(block => block.diff).slice(0, 3).map((block, index) => (
          <button
            key={`${block.blk.id}-${index}`}
            type="button"
            className={block.diff === 'add' ? 'add' : 'del'}
            onClick={() => onOpen(fileId, block.blk)}
            title="打开并跳到这处改动"
          >
            <span>{block.diff === 'add' ? '+' : '-'}</span>
            {blockPreview(block.blk)}
          </button>
        ))}
      </div>
      <div className="scm-actions">
        <button type="button" className="mini-btn" onClick={() => onReject(fileId)}>拒绝</button>
        <button type="button" className="mini-btn accept" onClick={() => onAccept(fileId)}>接受</button>
      </div>
    </div>
  )
}

function WorkingFileRow({ file, onOpen }: {
  file: VersionWorkingFile
  onOpen: (id: string) => void
}) {
  const name = basename(file.path)
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
  const kind = FILE_KIND[ext] ?? { icon: Ic.diffFile, color: 'var(--accent)' }
  return (
    <button
      type="button"
      className={`version-work-file ${file.status}`}
      onClick={() => onOpen(file.path)}
      title={file.path}
    >
      <span className={`version-work-code ${file.status}`}>{statusShort(file.status)}</span>
      <span className="file-ico" style={{ color: kind.color }}>
        <kind.icon width={14} height={14} />
      </span>
      <span className="version-work-file-main">
        <span className="version-work-file-name">{name}</span>
        <span className="version-work-file-path">{file.path}</span>
      </span>
      <span className="version-work-status">{statusLabel(file.status)}</span>
    </button>
  )
}

function VersionRecordRow({ record, previous, onCompare, onRestore }: {
  record: VersionRecord
  previous?: VersionRecord
  onCompare: (from: VersionRecord, to: VersionRecord) => void
  onRestore: (record: VersionRecord) => void
}) {
  const changed = record.changedFiles.length
  return (
    <div className="version-row">
      <div className="version-dot" />
      <div className="version-body">
        <div className="version-row-top">
          <span className="version-message">{record.message}</span>
          <span className="version-id">{record.shortId}</span>
        </div>
        <div className="version-meta">
          <span>{formatTime(record.createdAt)}</span>
          <span>{changed} 个文件</span>
        </div>
        {changed > 0 && (
          <div className="version-files">
            {record.changedFiles.slice(0, 4).join('、')}
            {changed > 4 ? ` 等 ${changed} 个` : ''}
          </div>
        )}
        <div className="version-row-actions">
          {previous && (
            <button type="button" className="mini-btn" onClick={() => onCompare(previous, record)}>
              查看对比
            </button>
          )}
          <button type="button" className="mini-btn" title="恢复前会自动保存当前状态" onClick={() => onRestore(record)}>
            恢复到此版
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props { width: number }

export function ScmPanel({ width }: Props) {
  const root = useWorkspaceStore(s => s.root)
  const refreshTree = useWorkspaceStore(s => s.refreshTree)
  const dirtySet = useWorkspaceStore(s => s.dirtySet)
  const { changes, acceptChange, rejectChange, acceptAll, rejectAll } = useChangesStore()
  const openTab = useTabsStore(s => s.openTab)
  const [snapshot, setSnapshot] = useState<VersionSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [restoreId, setRestoreId] = useState('')
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<VersionRecord | null>(null)
  const [diff, setDiff] = useState<VersionDiff | null>(null)
  const [diffTitle, setDiffTitle] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const reloadTimer = useRef<number | null>(null)
  const list = useMemo(() => [...changes.entries()], [changes])
  const currentFiles = useMemo(() => {
    if (!root) return []
    const byPath = new Map<string, VersionWorkingFile>()
    for (const file of snapshot?.currentFiles ?? []) {
      byPath.set(file.path, file)
    }
    for (const filePath of dirtySet) {
      const path = relativeToRoot(root, filePath)
      if (!byPath.has(path)) byPath.set(path, { path, status: 'modified' })
    }
    return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
  }, [dirtySet, root, snapshot?.currentFiles])
  const records = snapshot?.records ?? []
  const hasCurrentChanges = currentFiles.length > 0

  const load = useCallback(async () => {
    if (!root) {
      setSnapshot(null)
      return
    }
    try {
      setError('')
      setSnapshot(await versionIpc.getSnapshot(root))
    } catch (err: any) {
      setError(err?.message ?? '版本记录加载失败')
    }
  }, [root])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!root) return
    const stop = workspaceIpc.onWatch(() => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current)
      reloadTimer.current = window.setTimeout(() => {
        reloadTimer.current = null
        void load()
      }, 160)
    })
    return () => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current)
      stop()
    }
  }, [load, root])

  useEffect(() => {
    if (!root) return
    const interval = window.setInterval(() => {
      void load()
    }, 2500)
    return () => window.clearInterval(interval)
  }, [load, root])

  const runVersionTask = async (task: () => Promise<unknown>) => {
    if (!root || saving) return
    setSaving(true)
    setError('')
    try {
      await task()
      await refreshTree()
      await load()
    } catch (err: any) {
      setError(err?.message ?? '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const saveCurrent = () => runVersionTask(async () => {
    await versionIpc.save(root!, message.trim() || '保存版本')
    setMessage('')
    setCreateOpen(false)
  })

  const restoreById = (versionId: string) => runVersionTask(async () => {
    const next = await versionIpc.restore(root!, versionId.trim())
    setSnapshot(next)
    setRestoreId('')
    setRestoreOpen(false)
  })

  const restoreSelected = () => {
    if (!restoreTarget) return
    const target = restoreTarget
    setRestoreTarget(null)
    void restoreById(target.id)
  }

  const compare = async (from: VersionRecord, to: VersionRecord) => {
    if (!root) return
    setDiffLoading(true)
    setError('')
    try {
      setDiffTitle(`${from.shortId} -> ${to.shortId}`)
      setDiff(await versionIpc.compare(root, from.id, to.id))
    } catch (err: any) {
      setError(err?.message ?? '对比加载失败')
    } finally {
      setDiffLoading(false)
    }
  }

  const compareWorking = async (filePath: string) => {
    if (!root) return
    setDiffLoading(true)
    setError('')
    try {
      setDiffTitle(`当前改动 -> ${filePath}`)
      setDiff(await versionIpc.compareWorkingFile(root, filePath))
    } catch (err: any) {
      setError(err?.message ?? '当前改动对比加载失败')
    } finally {
      setDiffLoading(false)
    }
  }

  const openPendingChange = (fileId: string, block?: DiffBlock['blk']) => {
    openTab(fileId, {
      line: 1,
      column: 0,
      length: Math.max(1, block ? blockPreview(block).length : 1),
      matchText: block ? blockPreview(block) : '',
      blockId: block?.id
    })
  }

  return (
    <div className="scm-panel version-panel" style={{ width, flexShrink: 0 }}>
      <div className="scm-head">
        <span className="scm-title">版本管理</span>
        {root && (
          <div className="version-head-actions">
            <button type="button" className="mini-btn primary" aria-label="创建版本" onClick={() => setCreateOpen(true)} disabled={saving}>
              创建
            </button>
            <button type="button" className="mini-btn" aria-label="恢复版本" onClick={() => setRestoreOpen(true)} disabled={saving}>
              恢复
            </button>
          </div>
        )}
        <button type="button" className="mini-btn version-refresh-btn" title="刷新版本状态" onClick={() => void load()} disabled={saving}>
          <Ic.refresh width={12} height={12} />
        </button>
      </div>

      {!root ? (
        <div className="scm-empty">
          <div className="scm-empty-ico"><Ic.history width={22} height={22} /></div>
          <div className="scm-empty-t">打开项目后使用版本管理</div>
        </div>
      ) : (
        <div className="scm-scroll">
          <section className="version-work-section">
            <div className="version-card-head">
              <div>
                <div className="version-section-title">当前改动文件</div>
                <div className="version-section-sub">
                  {hasCurrentChanges ? `${currentFiles.length} 个工作区改动` : '工作区干净'}
                </div>
              </div>
              {hasCurrentChanges && <span className="version-state-pill dirty">未保存</span>}
            </div>
            {hasCurrentChanges ? (
              <div className="version-work-list">
                {currentFiles.map(file => (
                  <WorkingFileRow key={`${file.status}:${file.path}`} file={file} onOpen={(filePath) => { void compareWorking(filePath) }} />
                ))}
              </div>
            ) : (
              <div className="version-muted">没有未保存到版本记录的文件。</div>
            )}
          </section>

          {list.length > 0 && (
            <section className="version-card">
              <div className="version-card-head">
                <div>
                  <div className="version-section-title">Agent 待审阅改动</div>
                  <div className="version-section-sub">{list.length} 个文件待处理</div>
                </div>
                <div className="scm-all-btns">
                  <button type="button" className="mini-btn" onClick={rejectAll}>全部拒绝</button>
                  <button type="button" className="mini-btn accept" onClick={acceptAll}>全部接受</button>
                </div>
              </div>
              {list.map(([fileId, change]) => (
                <ScmFileCard
                  key={fileId}
                  fileId={fileId}
                  diffBlocks={change.diffBlocks}
                  onOpen={openPendingChange}
                  onAccept={acceptChange}
                  onReject={rejectChange}
                />
              ))}
            </section>
          )}

          {error && <div className="version-error">{error}</div>}

          <section className="version-card history">
            <div className="version-card-head timeline-head">
              <div>
                <div className="version-section-title">版本历史</div>
                <div className="version-section-sub">查看记录、对比修改、恢复到指定版本</div>
              </div>
            </div>
            {records.length ? (
              records.map((record, index) => (
                <VersionRecordRow
                  key={record.id}
                  record={record}
                  previous={records[index + 1]}
                  onCompare={(from, to) => { void compare(from, to) }}
                  onRestore={setRestoreTarget}
                />
              ))
            ) : (
              <div className="scm-empty small">
                <div className="scm-empty-t">还没有版本</div>
                <div className="scm-empty-d">保存一个版本后，历史和对比记录会显示在这里。</div>
              </div>
            )}
          </section>
        </div>
      )}

      {createOpen && (
        <div className="explorer-dialog-backdrop">
          <div className="explorer-dialog version-action-dialog">
            <div className="explorer-dialog-title">创建版本</div>
            <div className="explorer-dialog-copy">给当前工作区保存一个版本记录，之后可以查看修改、对比和恢复。</div>
            <label className="version-label-text" htmlFor="version-message-dialog">版本说明</label>
            <input
              id="version-message-dialog"
              autoFocus
              className="version-input"
              value={message}
              placeholder="例如：第二稿完成"
              onChange={event => setMessage(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') saveCurrent()
              }}
            />
            <div className="explorer-dialog-actions">
              <button type="button" onClick={() => setCreateOpen(false)}>取消</button>
              <button type="button" className="primary" disabled={saving} onClick={saveCurrent}>创建版本</button>
            </div>
          </div>
        </div>
      )}

      {restoreOpen && (
        <div className="explorer-dialog-backdrop">
          <div className="explorer-dialog version-action-dialog">
            <div className="explorer-dialog-title">恢复指定版本</div>
            <div className="explorer-dialog-copy">输入版本历史里的短 ID 或完整 ID。恢复前会自动保存当前状态。</div>
            <label className="version-label-text" htmlFor="version-restore-dialog">版本 ID</label>
            <input
              id="version-restore-dialog"
              autoFocus
              className="version-input mono"
              value={restoreId}
              placeholder="例如：a1b2c3d"
              onChange={event => setRestoreId(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && restoreId.trim()) void restoreById(restoreId)
              }}
            />
            <div className="explorer-dialog-actions">
              <button type="button" onClick={() => setRestoreOpen(false)}>取消</button>
              <button
                type="button"
                className="primary"
                disabled={saving || !restoreId.trim()}
                onClick={() => { void restoreById(restoreId) }}
              >
                恢复版本
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="explorer-dialog-backdrop">
          <div className="explorer-dialog">
            <div className="explorer-dialog-title">恢复版本</div>
            <div className="explorer-dialog-copy">
              将恢复到“{restoreTarget.message}”。恢复前会自动保存当前状态，方便回退。
            </div>
            <div className="explorer-dialog-actions">
              <button type="button" onClick={() => setRestoreTarget(null)}>取消</button>
              <button type="button" className="primary" onClick={restoreSelected}>确认恢复</button>
            </div>
          </div>
        </div>
      )}

      {(diff || diffLoading) && (
        <div className="explorer-dialog-backdrop version-compare-backdrop">
          <div className="explorer-dialog version-diff-dialog">
            {diffLoading ? (
              <div className="version-compare-loading">正在加载版本对比...</div>
            ) : (
              <VersionCompareView
                root={diffTitle || root}
                diff={diff}
                onClose={() => setDiff(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
