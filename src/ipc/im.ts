import type { IMConfigSnapshot, IMConversationEvent, IMPlatform, IMStatusSnapshot } from '@/im/types'
import type { Session } from '@/types'
import { getOptionalApi, rejectMissingApi } from './api'

export const imIpc = {
  getConfig: (): Promise<IMConfigSnapshot> =>
    getOptionalApi()?.im.getConfig() ?? rejectMissingApi(),
  saveConfig: (config: IMConfigSnapshot): Promise<IMConfigSnapshot> =>
    getOptionalApi()?.im.saveConfig(config) ?? rejectMissingApi(),
  getStatuses: (): Promise<IMStatusSnapshot[]> =>
    getOptionalApi()?.im.getStatuses() ?? rejectMissingApi(),
  start: (platform: IMPlatform): Promise<IMStatusSnapshot> =>
    getOptionalApi()?.im.start(platform) ?? rejectMissingApi(),
  stop: (platform: IMPlatform): Promise<IMStatusSnapshot> =>
    getOptionalApi()?.im.stop(platform) ?? rejectMissingApi(),
  onStatus: (cb: (snapshot: IMStatusSnapshot) => void): (() => void) =>
    getOptionalApi()?.im.onStatus(cb) ?? (() => {}),
  onMessage: (cb: (event: IMConversationEvent) => void): (() => void) =>
    getOptionalApi()?.im.onMessage(cb) ?? (() => {}),
  loadConversations: (): Promise<Session[]> =>
    (getOptionalApi()?.im.loadConversations() as Promise<Session[]> | undefined) ?? Promise.resolve([]),
  saveConversations: (sessions: Session[]): Promise<void> =>
    getOptionalApi()?.im.saveConversations(sessions) ?? Promise.resolve()
}
