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
  connect: (serverUrl: string, email: string, password: string): Promise<ConnectResult> =>
    getOptionalApi()?.serverConnection.connect(serverUrl, email, password)
    ?? Promise.reject(new Error('API not available')),

  disconnect: (): Promise<void> =>
    getOptionalApi()?.serverConnection.disconnect()
    ?? Promise.resolve(),

  getState: (): Promise<ConnectionState | null> =>
    getOptionalApi()?.serverConnection.getState()
    ?? Promise.resolve(null),
}
