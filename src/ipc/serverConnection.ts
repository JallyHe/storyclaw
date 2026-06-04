import { getOptionalApi } from './api'

export interface ConnectResult {
  success: boolean
  modelCount?: number
  balance?: number
  error?: string
}

export interface ConnectionState {
  serverUrl: string
  email: string
  token: string
  modelCount: number
  balance: number
  expiresAt: number | null
}

export const serverConnectionIpc = {
  /** Open the sub2api browser login page; server redirects back via storyclaw://auth */
  openAuthBrowser: (serverUrl: string): Promise<void> =>
    getOptionalApi()?.serverConnection.openAuthBrowser(serverUrl)
    ?? Promise.resolve(),

  disconnect: (): Promise<void> =>
    getOptionalApi()?.serverConnection.disconnect()
    ?? Promise.resolve(),

  getState: (): Promise<ConnectionState | null> =>
    getOptionalApi()?.serverConnection.getState()
    ?? Promise.resolve(null),

  /** Subscribe to the deep-link connected event from main process */
  onConnected: (cb: () => void): (() => void) =>
    getOptionalApi()?.serverConnection.onConnected(cb) ?? (() => {}),
}
