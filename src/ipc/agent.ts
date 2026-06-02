import type {
  AgentConfigSnapshot,
  AgentConnectionTestResult,
  AgentEvent,
  AgentModelOption,
  AgentSnapshot,
  AgentResources
} from '@/types'
import { getApi, getOptionalApi, rejectMissingApi } from './api'

export const agentIpc = {
  send: (sessionId: string, text: string, mode: string, permission: string, modelId?: string): Promise<void> =>
    getApi().agent.send(sessionId, text, mode, permission, modelId),
  permissionRespond: (requestId: string, approved: boolean): void =>
    getOptionalApi()?.agent.permissionRespond(requestId, approved),
  stop:    (sessionId: string): Promise<void>          => getApi().agent.stop(sessionId),
  getConfig: (workspaceRoot: string): Promise<AgentConfigSnapshot> =>
    getOptionalApi()?.agent.getConfig(workspaceRoot) ?? rejectMissingApi(),
  saveConfig: (workspaceRoot: string, config: AgentConfigSnapshot): Promise<AgentConfigSnapshot> =>
    getOptionalApi()?.agent.saveConfig(workspaceRoot, config) ?? rejectMissingApi(),
  listModels: (workspaceRoot: string): Promise<AgentModelOption[]> =>
    getOptionalApi()?.agent.listModels(workspaceRoot) ?? rejectMissingApi(),
  listResources: (): Promise<AgentResources> =>
    getOptionalApi()?.agent.listResources() ?? rejectMissingApi(),
  setModel: (modelId: string): Promise<void> =>
    getOptionalApi()?.agent.setModel(modelId) ?? rejectMissingApi(),
  testModel: (workspaceRoot: string, modelId?: string): Promise<AgentConnectionTestResult> =>
    getOptionalApi()?.agent.testModel(workspaceRoot, modelId) ?? rejectMissingApi(),
  loadSnapshot: (workspaceRoot: string): Promise<AgentSnapshot> =>
    getOptionalApi()?.agent.loadSnapshot(workspaceRoot) ?? rejectMissingApi(),
  saveSnapshot: (workspaceRoot: string, snapshot: AgentSnapshot): Promise<void> =>
    getOptionalApi()?.agent.saveSnapshot(workspaceRoot, snapshot) ?? rejectMissingApi(),
  onEvent: (cb: (e: AgentEvent) => void)               => getOptionalApi()?.agent.onEvent(cb) ?? (() => {})
}
