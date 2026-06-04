import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const agentIpcMock = {
  getConfig: vi.fn(),
  listModels: vi.fn(),
  saveConfig: vi.fn(),
  testModel: vi.fn()
}

vi.mock('../src/ipc/agent', () => ({
  agentIpc: agentIpcMock
}))

describe('Model settings panel', () => {
  it('opens add model form in a dialog', async () => {
    agentIpcMock.getConfig.mockResolvedValue({
      version: 1,
      activeModelId: '',
      models: []
    })
    agentIpcMock.listModels.mockResolvedValue([])

    const { ModelSettingsPanel } = await import('../src/components/settings/ModelSettingsPanel')
    const { container } = render(<ModelSettingsPanel />)

    await userEvent.click(await screen.findByRole('button', { name: /添加模型/ }))

    expect(screen.getByRole('dialog', { name: '添加模型' })).toBeInTheDocument()
    expect(container.querySelector('.set-section > .set-model-editor')).not.toBeInTheDocument()
  })
})
