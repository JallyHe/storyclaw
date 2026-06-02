import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ScmPanel } from '../src/components/explorer/ScmPanel'

const mocks = vi.hoisted(() => ({
  workspace: {
    root: 'D:/project',
    refreshTree: vi.fn().mockResolvedValue(undefined),
    dirtySet: new Set<string>()
  },
  changes: {
    changes: new Map(),
    acceptChange: vi.fn(),
    rejectChange: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn()
  },
  tabs: {
    openTab: vi.fn()
  },
  version: {
    getSnapshot: vi.fn(),
    save: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    compare: vi.fn(),
    compareWorkingFile: vi.fn()
  },
  workspaceApi: {
    watchCallback: null as null | ((event: string, file: string) => void),
    onWatch: vi.fn((cb: (event: string, file: string) => void) => {
      mocks.workspaceApi.watchCallback = cb
      return vi.fn()
    })
  }
}))

vi.mock('@/store', () => ({
  useWorkspaceStore: (selector?: (state: typeof mocks.workspace) => unknown) =>
    selector ? selector(mocks.workspace) : mocks.workspace,
  useChangesStore: (selector?: (state: typeof mocks.changes) => unknown) =>
    selector ? selector(mocks.changes) : mocks.changes,
  useTabsStore: (selector?: (state: typeof mocks.tabs) => unknown) =>
    selector ? selector(mocks.tabs) : mocks.tabs
}))

vi.mock('@/ipc/version', () => ({
  versionIpc: mocks.version
}))

vi.mock('@/ipc/workspace', () => ({
  workspaceIpc: mocks.workspaceApi
}))

describe('ScmPanel', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mocks.workspace.root = 'D:/project'
    mocks.workspace.refreshTree.mockReset().mockResolvedValue(undefined)
    mocks.workspace.dirtySet = new Set()
    mocks.workspaceApi.watchCallback = null
    mocks.workspaceApi.onWatch.mockClear()
    mocks.changes.changes = new Map()
    mocks.tabs.openTab.mockReset()
    mocks.version.getSnapshot.mockReset().mockResolvedValue({
      currentLine: '主版本',
      hasChanges: true,
      lines: [{ id: 'storyclaw-main', name: '主版本', current: true }],
      currentFiles: [{ path: '大纲/全剧大纲.md', status: 'modified' }],
      records: [
        { id: '111111', shortId: '111111', message: '初始版本', createdAt: '2026-05-31T00:00:00.000Z', changedFiles: ['大纲/全剧大纲.md'], lineName: '主版本', isFinal: false },
        { id: '222222', shortId: '222222', message: '第二稿', createdAt: '2026-05-31T01:00:00.000Z', changedFiles: ['大纲/全剧大纲.md'], lineName: '主版本', isFinal: false }
      ]
    })
    mocks.version.save.mockReset().mockResolvedValue({})
    mocks.version.restore.mockReset().mockResolvedValue({})
    mocks.version.compare.mockReset().mockResolvedValue({
      fromId: '111111',
      toId: '222222',
      files: [{ path: '大纲/全剧大纲.md', additions: 1, deletions: 1 }],
      patch: [
        'diff --git a/大纲/全剧大纲.md b/大纲/全剧大纲.md',
        '--- a/大纲/全剧大纲.md',
        '+++ b/大纲/全剧大纲.md',
        '@@ -1 +1 @@',
        '-旧内容',
        '+新内容'
      ].join('\n')
    })
    mocks.version.compareWorkingFile.mockReset().mockResolvedValue({
      fromId: 'HEAD',
      toId: 'WORKTREE',
      files: [{ path: '大纲/全剧大纲.md', additions: 1, deletions: 1 }],
      patch: [
        'diff --git a/大纲/全剧大纲.md b/大纲/全剧大纲.md',
        '--- a/大纲/全剧大纲.md',
        '+++ b/大纲/全剧大纲.md',
        '@@ -1 +1 @@',
        '-旧内容',
        '+当前改动'
      ].join('\n')
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the simplified version management surface', async () => {
    render(<ScmPanel width={420} />)

    expect(await screen.findByText('当前改动文件')).toBeInTheDocument()
    expect(screen.getByText('版本历史')).toBeInTheDocument()
    expect(screen.getByText('全剧大纲.md')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建版本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复版本' })).toBeInTheDocument()
    expect(screen.queryByText('版本操作')).not.toBeInTheDocument()
    expect(screen.queryByText('创建导演版')).not.toBeInTheDocument()
    expect(screen.queryByText('创建平台修改版')).not.toBeInTheDocument()
    expect(screen.queryByText('标记为定稿')).not.toBeInTheDocument()
  })

  it('includes unsaved editor dirty files in the current changes list', async () => {
    mocks.version.getSnapshot.mockResolvedValue({
      currentLine: '主版本',
      hasChanges: false,
      lines: [{ id: 'storyclaw-main', name: '主版本', current: true }],
      currentFiles: [],
      records: []
    })
    mocks.workspace.dirtySet = new Set(['D:/project/剧本/第一集.ep'])

    render(<ScmPanel width={420} />)

    expect(await screen.findByText('第一集.ep')).toBeInTheDocument()
    expect(screen.getByText('剧本/第一集.ep')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('reloads current changes when the workspace watcher reports file changes', async () => {
    mocks.version.getSnapshot
      .mockResolvedValueOnce({
        currentLine: '主版本',
        hasChanges: false,
        lines: [{ id: 'storyclaw-main', name: '主版本', current: true }],
        currentFiles: [],
        records: []
      })
      .mockResolvedValueOnce({
        currentLine: '主版本',
        hasChanges: true,
        lines: [{ id: 'storyclaw-main', name: '主版本', current: true }],
        currentFiles: [{ path: '大纲/新大纲.md', status: 'modified' }],
        records: []
      })

    render(<ScmPanel width={420} />)
    await screen.findByText('工作区干净')

    await act(async () => {
      mocks.workspaceApi.watchCallback?.('change', '大纲/新大纲.md')
      await new Promise(resolve => window.setTimeout(resolve, 220))
    })

    await waitFor(() => {
      expect(mocks.version.getSnapshot).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('新大纲.md')).toBeInTheDocument()
  })

  it('creates and restores versions through dialogs', async () => {
    render(<ScmPanel width={420} />)

    fireEvent.click(await screen.findByRole('button', { name: '创建版本' }))
    fireEvent.change(screen.getByLabelText('版本说明'), { target: { value: '第三稿' } })
    fireEvent.click(screen.getAllByRole('button', { name: '创建版本' }).at(-1)!)

    await waitFor(() => {
      expect(mocks.version.save).toHaveBeenCalledWith('D:/project', '第三稿')
    })

    fireEvent.click(screen.getByRole('button', { name: '恢复版本' }))
    fireEvent.change(screen.getByLabelText('版本 ID'), { target: { value: '111111' } })
    fireEvent.click(screen.getAllByRole('button', { name: '恢复版本' }).at(-1)!)

    await waitFor(() => {
      expect(mocks.version.restore).toHaveBeenCalledWith('D:/project', '111111')
    })
  })

  it('opens a file-based side-by-side compare view from history', async () => {
    render(<ScmPanel width={420} />)

    fireEvent.click(await screen.findByRole('button', { name: '查看对比' }))

    await waitFor(() => {
      expect(mocks.version.compare).toHaveBeenCalledWith('D:/project', '222222', '111111')
    })
    expect(screen.getByText('版本对比')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '大纲/全剧大纲.md' })).toBeInTheDocument()
    expect(screen.getByText('旧内容')).toBeInTheDocument()
    expect(screen.getByText('新内容')).toBeInTheDocument()
  })

  it('opens a diff view when clicking a current working file', async () => {
    render(<ScmPanel width={420} />)

    fireEvent.click(await screen.findByText('全剧大纲.md'))

    await waitFor(() => {
      expect(mocks.version.compareWorkingFile).toHaveBeenCalledWith('D:/project', '大纲/全剧大纲.md')
    })
    expect(mocks.tabs.openTab).not.toHaveBeenCalled()
    expect(screen.getByText('当前改动')).toBeInTheDocument()
  })
})
