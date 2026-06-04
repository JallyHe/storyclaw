import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const getStateMock = vi.fn()
const openAuthBrowserMock = vi.fn()
const disconnectMock = vi.fn()
const onConnectedMock = vi.fn(() => vi.fn())

vi.mock('../src/ipc/serverConnection', () => ({
  serverConnectionIpc: {
    getState: getStateMock,
    openAuthBrowser: openAuthBrowserMock,
    disconnect: disconnectMock,
    onConnected: onConnectedMock
  }
}))

describe('Account settings panel', () => {
  it('shows logged out state and opens browser login', async () => {
    getStateMock.mockResolvedValueOnce(null)
    const { AccountSettingsPanel } = await import('../src/components/settings/AccountSettingsPanel')

    render(<AccountSettingsPanel />)

    expect(await screen.findByText('未登录')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('服务器地址，如 https://api.storyclaw.com')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '在浏览器中登录' }))

    expect(openAuthBrowserMock).toHaveBeenCalledWith('http://localhost:3030')
  })

  it('shows user profile and credits when logged in', async () => {
    getStateMock.mockResolvedValueOnce({
      serverUrl: 'https://api.storyclaw.com',
      email: 'creator@example.com',
      token: 'token',
      modelCount: 12,
      balance: 3322.07,
      expiresAt: null
    })
    const { AccountSettingsPanel } = await import('../src/components/settings/AccountSettingsPanel')

    render(<AccountSettingsPanel />)

    expect(await screen.findByText('creator@example.com')).toBeInTheDocument()
    expect(screen.getByText('积分余额')).toBeInTheDocument()
    expect(screen.getByText('3,322.07')).toBeInTheDocument()
    expect(screen.getByText('已加载 12 个模型')).toBeInTheDocument()
  })
})
