import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentComposer } from '../src/components/copilot/AgentComposer'
import { encodeSelectionReference } from '../src/components/copilot/selectionReference'

const { agentIpcMock, workspaceState, tabsState, sessionsState, uiState, draftState } = vi.hoisted(() => ({
  agentIpcMock: {
    getConfig: vi.fn().mockResolvedValue({
      version: 1,
      activeModelId: 'm1',
      models: [{
        id: 'm1',
        providerId: 'custom-openai',
        displayName: 'Test Model',
        model: 'test-model',
        enabled: true,
        reasoning: false,
        defaultMode: 'craft',
        apiKey: 'sk-test'
      }]
    }),
    listModels: vi.fn().mockResolvedValue([{
      id: 'm1',
      label: 'Test Model',
      sub: 'test-model',
      provider: 'custom-openai',
      model: 'test-model',
      configured: true,
      enabled: true,
      isDefault: true
    }]),
    listResources: vi.fn().mockResolvedValue({ agents: [], skills: [] }),
    send: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn()
  },
  workspaceState: {
    root: 'D:\\story',
    tree: []
  },
  tabsState: {
    activeFile: 'D:\\story\\剧集\\EP01.ep'
  },
  sessionsState: {
    activeId: 's1',
    addMessage: vi.fn()
  },
  uiState: {
    openSettings: vi.fn()
  },
  draftState: {
    queuedSelection: null as null | {
      ref: {
        filePath: string
        relPath: string
        from: number
        to: number
        startBlockId?: string
        startBlockType?: string
      }
      promptText?: string
      autoSubmit?: boolean
    },
    consumeSelection: vi.fn()
  }
}))

vi.mock('../src/ipc/agent', () => ({
  agentIpc: agentIpcMock
}))

vi.mock('../src/ipc/workspace', () => ({
  workspaceIpc: {
    uploadAttachments: vi.fn()
  }
}))

vi.mock('../src/store', () => ({
  useWorkspaceStore: (selector: (state: typeof workspaceState) => unknown) => selector(workspaceState),
  useTabsStore: (selector: (state: typeof tabsState) => unknown) => selector(tabsState),
  useSessionsStore: () => sessionsState,
  useUiStore: (selector: (state: typeof uiState) => unknown) => selector(uiState),
  useCopilotDraftStore: (selector: (state: typeof draftState) => unknown) => selector(draftState)
}))

describe('AgentComposer current document context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceState.root = 'D:\\story'
    tabsState.activeFile = 'D:\\story\\剧集\\EP01.ep'
    draftState.queuedSelection = null
    draftState.consumeSelection.mockImplementation(() => {
      const selection = draftState.queuedSelection
      draftState.queuedSelection = null
      return selection
    })
  })

  it('shows the active document above the input', async () => {
    render(<AgentComposer busy={false} includeCurrentDocumentContext />)
    await waitFor(() => expect(agentIpcMock.listModels).toHaveBeenCalled())

    expect(screen.queryByText('当前上下文')).toBeNull()
    expect(screen.getByText('EP01.ep')).toBeTruthy()
    expect(screen.getByText('剧本文档')).toBeTruthy()
  })

  it('updates the visible context document when the active file changes', async () => {
    const { rerender } = render(<AgentComposer busy={false} includeCurrentDocumentContext />)
    await waitFor(() => expect(agentIpcMock.listModels).toHaveBeenCalled())
    expect(screen.getByText('EP01.ep')).toBeTruthy()

    tabsState.activeFile = 'D:\\story\\人物\\主角.chr'
    rerender(<AgentComposer busy={false} includeCurrentDocumentContext />)

    expect(screen.queryByText('EP01.ep')).toBeNull()
    expect(screen.getByText('主角.chr')).toBeTruthy()
    expect(screen.getByText('人物文档')).toBeTruthy()
  })

  it('sends active document context to the agent while keeping visible chat text clean', async () => {
    const { container } = render(<AgentComposer busy={false} includeCurrentDocumentContext />)
    await waitFor(() => expect(agentIpcMock.listModels).toHaveBeenCalled())

    const editor = container.querySelector('.ac-rich') as HTMLDivElement
    editor.textContent = '续写本场'
    fireEvent.input(editor)
    fireEvent.keyDown(editor, { key: 'Enter' })

    await waitFor(() => expect(agentIpcMock.send).toHaveBeenCalled())
    const sentPrompt = agentIpcMock.send.mock.calls[0][1] as string
    expect(sentPrompt).toContain('## 当前打开文档')
    expect(sentPrompt).toContain('路径：剧集/EP01.ep')
    expect(sentPrompt).toContain('read_screenplay')
    expect(sentPrompt).toContain('## 用户请求\n续写本场')
    expect(sessionsState.addMessage).toHaveBeenCalledWith({ role: 'user', text: '续写本场' })
  })

  it('sends queued selection references as location tokens without selected text', async () => {
    const ref = {
      filePath: 'D:\\story\\剧集\\EP01.ep',
      relPath: '剧集/EP01.ep',
      from: 42,
      to: 88,
      startBlockId: 'b1',
      startBlockType: 'action'
    }
    draftState.queuedSelection = { ref, promptText: '请改写这个选区：更紧张' }

    const { container } = render(<AgentComposer busy={false} includeCurrentDocumentContext />)
    await waitFor(() => expect(container.querySelector('.ac-tag-chip.selection')).toBeTruthy())
    const editor = container.querySelector('.ac-rich') as HTMLDivElement
    fireEvent.keyDown(editor, { key: 'Enter' })

    await waitFor(() => expect(agentIpcMock.send).toHaveBeenCalled())
    const sentPrompt = agentIpcMock.send.mock.calls[0][1] as string
    expect(sentPrompt).toContain('## 选区引用')
    expect(sentPrompt).toContain('ProseMirror 位置：42-88')
    expect(sentPrompt).toContain(encodeSelectionReference(ref))
    expect(sentPrompt).not.toContain('这是一段被选中的正文')
  })

  it('auto-submits inline edit requests without filling the input', async () => {
    const ref = {
      filePath: 'D:\\story\\剧集\\EP01.ep',
      relPath: '剧集/EP01.ep',
      from: 42,
      to: 88,
      startBlockId: 'b1',
      startBlockType: 'action'
    }
    draftState.queuedSelection = { ref, promptText: '请改写这个选区：更紧张', autoSubmit: true }

    const { container } = render(<AgentComposer busy={false} includeCurrentDocumentContext />)

    await waitFor(() => expect(agentIpcMock.send).toHaveBeenCalled())
    expect(container.querySelector('.ac-tag-chip.selection')).toBeNull()
    expect(sessionsState.addMessage).toHaveBeenCalledWith({ role: 'user', text: 'AI 编辑选区：更紧张' })
    const sentPrompt = agentIpcMock.send.mock.calls[0][1] as string
    expect(sentPrompt).toContain('## 选区引用')
    expect(sentPrompt).toContain(encodeSelectionReference(ref))
    expect(sentPrompt).toContain('请改写这个选区：更紧张')
  })
})
