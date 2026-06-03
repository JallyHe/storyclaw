import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileIcon } from '../src/components/explorer/FileIcon'
import { Explorer } from '../src/components/explorer/Explorer'

const { workspaceState, tabsState, changesState, workspaceIpcMock } = vi.hoisted(() => ({
  workspaceState: {
    root: 'C:\\project',
    tree: [
      { kind: 'folder', id: 'C:\\project\\素材', name: '素材', children: [] },
      { kind: 'file', id: 'C:\\project\\第一集.ep', name: '第一集', ext: 'ep' }
    ],
    openWorkspace: vi.fn(),
    createFolder: vi.fn(),
    createFile: vi.fn(),
    renameItem: vi.fn(),
    deleteItem: vi.fn(),
    setEditing: vi.fn(),
    updateEditingValue: vi.fn(),
    commitEditing: vi.fn(),
    cancelEditing: vi.fn(),
    copyToClipboard: vi.fn(),
    cutToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    moveNode: vi.fn(),
    importExternalFiles: vi.fn(),
    refreshTree: vi.fn(),
    getFile: vi.fn().mockResolvedValue({}),
    editingNodeId: null,
    editingValue: '',
    clipboard: null,
    cutSourceId: null
  },
  tabsState: {
    activeFile: null,
    openTabs: [],
    openTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn()
  },
  changesState: {
    changes: new Map()
  },
  workspaceIpcMock: {
    openDialog: vi.fn(),
    onWatch: vi.fn(() => vi.fn()),
    writeClipboardFilePaths: vi.fn().mockResolvedValue(undefined),
    readClipboardFilePaths: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('../src/store', () => ({
  useWorkspaceStore: () => workspaceState,
  useTabsStore: (selector: (state: typeof tabsState) => unknown) => selector(tabsState),
  useChangesStore: (selector: (state: typeof changesState) => unknown) => selector(changesState)
}))

vi.mock('../src/ipc/workspace', () => ({
  workspaceIpc: workspaceIpcMock
}))

beforeEach(() => {
  vi.clearAllMocks()
  workspaceState.clipboard = null
  workspaceIpcMock.onWatch.mockReturnValue(vi.fn())
  workspaceIpcMock.readClipboardFilePaths.mockResolvedValue([])
  workspaceIpcMock.writeClipboardFilePaths.mockResolvedValue(undefined)
})

describe('FileIcon', () => {
  it('renders .ep extension', () => {
    render(<FileIcon ext="ep" />)
    expect(screen.getByText('.ep')).toBeInTheDocument()
  })

  it('renders .chr extension', () => {
    render(<FileIcon ext="chr" />)
    expect(screen.getByText('.chr')).toBeInTheDocument()
  })

  it('renders unknown extension with ref color', () => {
    const { container } = render(<FileIcon ext="pdf" />)
    expect(container.firstChild).toHaveStyle('color: var(--c-ref)')
  })
})

describe('Explorer keyboard clipboard shortcuts', () => {
  it('copies the selected file with Ctrl+C', async () => {
    render(<Explorer width={260} />)

    fireEvent.click(screen.getByText('第一集'))
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'c', ctrlKey: true })

    expect(workspaceState.copyToClipboard).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'C:\\project\\第一集.ep' })
    ])
    await waitFor(() => {
      expect(workspaceIpcMock.writeClipboardFilePaths).toHaveBeenCalledWith(['C:\\project\\第一集.ep'], 'copy')
    })
  })

  it('pastes external clipboard files into the selected folder with Ctrl+V', async () => {
    workspaceIpcMock.readClipboardFilePaths.mockResolvedValue(['C:\\outside\\ref.txt'])
    render(<Explorer width={260} />)

    fireEvent.click(screen.getByText('素材'))
    fireEvent.keyDown(screen.getByRole('tree'), { key: 'v', ctrlKey: true })

    await waitFor(() => {
      expect(workspaceState.importExternalFiles).toHaveBeenCalledWith(['C:\\outside\\ref.txt'], 'C:\\project\\素材')
    })
  })
})
