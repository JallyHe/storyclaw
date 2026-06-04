import type {
  AgentConfigSnapshot,
  AgentConnectionTestResult,
  AgentEvent,
  ImportedSkill,
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
  getConfig: (): Promise<AgentConfigSnapshot> =>
    getOptionalApi()?.agent.getConfig() ?? rejectMissingApi(),
  saveConfig: (config: AgentConfigSnapshot): Promise<AgentConfigSnapshot> =>
    getOptionalApi()?.agent.saveConfig(config) ?? rejectMissingApi(),
  listModels: (): Promise<AgentModelOption[]> =>
    getOptionalApi()?.agent.listModels() ?? rejectMissingApi(),
  listResources: (): Promise<AgentResources> =>
    getOptionalApi()?.agent.listResources() ?? rejectMissingApi(),
  importSkillDialog: (workspaceRoot: string, sourceType?: 'file' | 'folder'): Promise<ImportedSkill | null> =>
    getOptionalApi()?.agent.importSkillDialog(workspaceRoot, sourceType) ?? rejectMissingApi(),
  importSkillPackage: (workspaceRoot: string, sourcePath: string): Promise<ImportedSkill> =>
    getOptionalApi()?.agent.importSkillPackage(workspaceRoot, sourcePath) ?? rejectMissingApi(),
  setModel: (modelId: string): Promise<void> =>
    getOptionalApi()?.agent.setModel(modelId) ?? rejectMissingApi(),
  testModel: (modelId?: string): Promise<AgentConnectionTestResult> =>
    getOptionalApi()?.agent.testModel(modelId) ?? rejectMissingApi(),
  loadSnapshot: (workspaceRoot: string): Promise<AgentSnapshot> =>
    getOptionalApi()?.agent.loadSnapshot(workspaceRoot) ?? rejectMissingApi(),
  saveSnapshot: (workspaceRoot: string, snapshot: AgentSnapshot): Promise<void> =>
    getOptionalApi()?.agent.saveSnapshot(workspaceRoot, snapshot) ?? rejectMissingApi(),
  onEvent: (cb: (e: AgentEvent) => void)               => getOptionalApi()?.agent.onEvent(cb) ?? (() => {})
}
