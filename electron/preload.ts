import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  StoryFile,
  TreeNode,
  AgentEvent,
  AgentSnapshot,
  AgentConfigSnapshot,
  AgentConnectionTestResult,
  AgentModelOption,
  AgentResources,
  VersionDiff,
  VersionRecord,
  VersionSnapshot,
  NewProjectOptions,
  UpdateSnapshot,
  UploadedReference
} from '../src/types'

const api = {
  // workspace
  workspace: {
    openDialog:   (): Promise<string | null>                          => ipcRenderer.invoke('workspace:openDialog'),
    open:         (dir: string): Promise<TreeNode[]>                  => ipcRenderer.invoke('workspace:open', dir),
    tree:         (dir: string): Promise<TreeNode[]>                  => ipcRenderer.invoke('workspace:tree', dir),
    create:       (opts: NewProjectOptions): Promise<string>          => ipcRenderer.invoke('workspace:create', opts),
    readFile:     (path: string): Promise<StoryFile>                  => ipcRenderer.invoke('workspace:readFile', path),
    writeFile:    (path: string, data: StoryFile): Promise<void>      => ipcRenderer.invoke('workspace:writeFile', path, data),
    readText:     (path: string): Promise<string>                     => ipcRenderer.invoke('workspace:readText', path),
    readFileBuffer: (path: string): Promise<Uint8Array>               => ipcRenderer.invoke('workspace:readFileBuffer', path),
    writeText:    (path: string, content: string): Promise<void>      => ipcRenderer.invoke('workspace:writeText', path, content),
    createFolder: (root: string, parentDir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createFolder', root, parentDir, name),
    createFile:   (root: string, parentDir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createFile', root, parentDir, name),
    renameItem:   (root: string, itemPath: string, nextName: string): Promise<string> =>
      ipcRenderer.invoke('workspace:renameItem', root, itemPath, nextName),
    deleteItem:   (root: string, itemPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:deleteItem', root, itemPath),
    copyItem:     (root: string, sourcePath: string, targetParentDir: string): Promise<string> =>
      ipcRenderer.invoke('workspace:copyItem', root, sourcePath, targetParentDir),
    moveItem:     (root: string, sourcePath: string, targetParentDir: string): Promise<string> =>
      ipcRenderer.invoke('workspace:moveItem', root, sourcePath, targetParentDir),
    uploadAttachments: (root: string): Promise<Array<{ absPath: string; relPath: string; name: string }>> =>
      ipcRenderer.invoke('workspace:uploadAttachments', root),
    importFiles: (root: string, sourcePaths: string[], targetDir: string): Promise<Array<{ absPath: string; relPath: string; name: string }>> =>
      ipcRenderer.invoke('workspace:importFiles', root, sourcePaths, targetDir),
    importScreenplays: (root: string, targetDir: string): Promise<UploadedReference[]> =>
      ipcRenderer.invoke('workspace:importScreenplays', root, targetDir),
    readClipboardFilePaths: (): Promise<string[]> =>
      ipcRenderer.invoke('workspace:readClipboardFilePaths'),
    writeClipboardFilePaths: (paths: string[]): Promise<void> =>
      ipcRenderer.invoke('workspace:writeClipboardFilePaths', paths),
    applyDefaultContent: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:applyDefaultContent', filePath),
    search: (root: string, query: string, opts: unknown): Promise<unknown> =>
      ipcRenderer.invoke('workspace:search', root, query, opts),
    replaceInFile: (filePath: string, query: string, replacement: string, opts: unknown): Promise<number> =>
      ipcRenderer.invoke('workspace:replaceInFile', filePath, query, replacement, opts),
    // Resolve the absolute disk path of a dropped File (Electron 32+ removed File.path)
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
    copyPathToClipboard: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:copyPathToClipboard', filePath),
    revealInExplorer: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:revealInExplorer', filePath),
    exportStory: (filePath: string): Promise<string | null> =>
      ipcRenderer.invoke('workspace:exportStory', filePath),
    onWatch:      (cb: (event: string, filename: string) => void) => {
      ipcRenderer.on('workspace:watch', (_e, ev, fn) => cb(ev, fn))
      return () => ipcRenderer.removeAllListeners('workspace:watch')
    },
  },
  version: {
    getSnapshot: (root: string): Promise<VersionSnapshot> =>
      ipcRenderer.invoke('version:getSnapshot', root),
    save: (root: string, message: string): Promise<VersionRecord> =>
      ipcRenderer.invoke('version:save', root, message),
    createLine: (root: string, kind: 'director' | 'platform'): Promise<VersionSnapshot> =>
      ipcRenderer.invoke('version:createLine', root, kind),
    markFinal: (root: string): Promise<VersionRecord> =>
      ipcRenderer.invoke('version:markFinal', root),
    restore: (root: string, versionId: string): Promise<VersionSnapshot> =>
      ipcRenderer.invoke('version:restore', root, versionId),
    compare: (root: string, fromId: string, toId: string): Promise<VersionDiff> =>
      ipcRenderer.invoke('version:compare', root, fromId, toId),
    compareWorkingFile: (root: string, filePath: string): Promise<VersionDiff> =>
      ipcRenderer.invoke('version:compareWorkingFile', root, filePath)
  },
  // agent
  agent: {
    send: (sessionId: string, text: string, mode: string, permission: string, modelId?: string): Promise<void> =>
      ipcRenderer.invoke('agent:send', sessionId, text, mode, permission, modelId),
    permissionRespond: (requestId: string, approved: boolean): void =>
      ipcRenderer.send('agent:permission-response', requestId, approved),
    stop:   (sessionId: string): Promise<void>               => ipcRenderer.invoke('agent:stop', sessionId),
    getConfig: (workspaceRoot: string): Promise<AgentConfigSnapshot> =>
      ipcRenderer.invoke('agent:getConfig', workspaceRoot),
    saveConfig: (workspaceRoot: string, config: AgentConfigSnapshot): Promise<AgentConfigSnapshot> =>
      ipcRenderer.invoke('agent:saveConfig', workspaceRoot, config),
    listModels: (workspaceRoot: string): Promise<AgentModelOption[]> =>
      ipcRenderer.invoke('agent:listModels', workspaceRoot),
    listResources: (): Promise<AgentResources> =>
      ipcRenderer.invoke('agent:listResources'),
    setModel: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('agent:setModel', modelId),
    testModel: (workspaceRoot: string, modelId?: string): Promise<AgentConnectionTestResult> =>
      ipcRenderer.invoke('agent:testModel', workspaceRoot, modelId),
    loadSnapshot: (workspaceRoot: string): Promise<AgentSnapshot> =>
      ipcRenderer.invoke('agent:loadSnapshot', workspaceRoot),
    saveSnapshot: (workspaceRoot: string, snapshot: AgentSnapshot): Promise<void> =>
      ipcRenderer.invoke('agent:saveSnapshot', workspaceRoot, snapshot),
    onEvent:(cb: (e: AgentEvent) => void) => {
      ipcRenderer.on('agent:event', (_e, ev) => cb(ev))
      return () => ipcRenderer.removeAllListeners('agent:event')
    }
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    show: (): Promise<void> => ipcRenderer.invoke('window:show'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    toggleDevTools: (): Promise<void> => ipcRenderer.invoke('window:toggleDevTools'),
    onMaximizedChange: (cb: (isMaximized: boolean) => void) => {
      ipcRenderer.on('window:maximized-change', (_e, isMaximized) => cb(isMaximized))
      return () => ipcRenderer.removeAllListeners('window:maximized-change')
    }
  },
  app: {
    platform: process.platform,
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  updater: {
    getStatus: (): Promise<UpdateSnapshot> => ipcRenderer.invoke('updater:getStatus'),
    check: (): Promise<UpdateSnapshot> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    onStatus: (cb: (snapshot: UpdateSnapshot) => void) => {
      ipcRenderer.on('updater:status', (_e, snapshot) => cb(snapshot))
      return () => ipcRenderer.removeAllListeners('updater:status')
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
