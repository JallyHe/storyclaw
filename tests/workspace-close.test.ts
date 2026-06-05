import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTabsStore } from '../src/store/tabs'
import { useWorkspaceStore } from '../src/store/workspace'

const { workspaceIpcMock } = vi.hoisted(() => ({
  workspaceIpcMock: {
    close: vi.fn()
  }
}))

vi.mock('../src/ipc/workspace', () => ({
  workspaceIpc: workspaceIpcMock
}))

vi.mock('../src/ipc/agent', () => ({
  agentIpc: {
    loadSnapshot: vi.fn()
  }
}))

describe('workspace close', () => {
  beforeEach(() => {
    workspaceIpcMock.close.mockResolvedValue(undefined)
    useTabsStore.setState({ openTabs: [], activeFile: null, revealTarget: null })
    useWorkspaceStore.setState({
      root: 'D:/story',
      tree: [{ kind: 'file', id: 'D:/story/a.ep', name: 'a', ext: 'ep' }],
      fileCache: new Map([['D:/story/a.ep', {} as any]]),
      fileVersions: new Map([['D:/story/a.ep', 1]]),
      dirtySet: new Set(['D:/story/a.ep']),
      editingNodeId: 'D:/story/a.ep',
      editingValue: 'a.ep',
      editingMode: 'rename',
      clipboard: { nodes: [], mode: 'copy' },
      cutSourceId: 'D:/story/a.ep'
    })
    useTabsStore.getState().openTab('D:/story/a.ep')
  })

  it('clears workspace state and open tabs', async () => {
    await useWorkspaceStore.getState().closeWorkspace()

    expect(workspaceIpcMock.close).toHaveBeenCalled()
    expect(useWorkspaceStore.getState().root).toBeNull()
    expect(useWorkspaceStore.getState().tree).toEqual([])
    expect(useWorkspaceStore.getState().dirtySet.size).toBe(0)
    expect(useWorkspaceStore.getState().fileCache.size).toBe(0)
    expect(useTabsStore.getState().openTabs).toEqual([])
    expect(useTabsStore.getState().activeFile).toBeNull()
  })
})
