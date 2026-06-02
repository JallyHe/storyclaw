import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const useAgentPersistenceMock = vi.fn()

vi.mock('../src/hooks/useAgentPersistence', () => ({
  useAgentPersistence: useAgentPersistenceMock
}))

vi.mock('../src/components/shell/Titlebar', () => ({
  Titlebar: () => <div>Titlebar</div>
}))

vi.mock('../src/components/shell/ActivityBar', () => ({
  ActivityBar: () => <div>ActivityBar</div>
}))

vi.mock('../src/components/shell/ResizeHandle', () => ({
  ResizeHandle: () => <div>ResizeHandle</div>
}))

vi.mock('../src/components/explorer/Explorer', () => ({
  Explorer: () => <div>Explorer</div>
}))

vi.mock('../src/components/explorer/SearchPanel', () => ({
  SearchPanel: () => <div>SearchPanel</div>
}))

vi.mock('../src/components/explorer/ScmPanel', () => ({
  ScmPanel: () => <div>ScmPanel</div>
}))

vi.mock('../src/components/shell/WelcomeScreen', () => ({
  WelcomeScreen: () => <div>WelcomeScreen</div>,
  addRecentProject: vi.fn()
}))

vi.mock('../src/components/tabs/TabBar', () => ({
  TabBar: () => <div>TabBar</div>
}))

vi.mock('../src/components/tabs/Breadcrumb', () => ({
  Breadcrumb: () => <div>Breadcrumb</div>
}))

vi.mock('../src/components/editors/FileEditor', () => ({
  FileEditor: () => <div>FileEditor</div>
}))

vi.mock('../src/components/copilot/Copilot', () => ({
  Copilot: () => <div>Copilot</div>
}))

vi.mock('../src/components/agent/AgentView', () => ({
  AgentView: () => <div>AgentView</div>
}))

vi.mock('../src/components/wizard/Wizard', () => ({
  Wizard: () => <div>Wizard</div>
}))

describe('App agent persistence', () => {
  it('mounts the agent persistence hook so sessions are saved', async () => {
    const { default: App } = await import('../src/App')

    render(<App />)

    expect(useAgentPersistenceMock).toHaveBeenCalled()
  })
})
