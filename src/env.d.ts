/// <reference types="vite/client" />
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
} from './types'
import type { IMConfigSnapshot, IMConversationEvent, IMPlatform, IMStatusSnapshot } from './im/types'

declare global {
interface Window {
    api?: {
      workspace: {
        openDialog(): Promise<string | null>
        open(dir: string): Promise<TreeNode[]>
        tree(dir: string): Promise<TreeNode[]>
        create(opts: NewProjectOptions): Promise<string>
        readFile(path: string): Promise<StoryFile>
        writeFile(path: string, data: StoryFile): Promise<void>
        readText(path: string): Promise<string>
        readFileBuffer(path: string): Promise<Uint8Array>
        writeText(path: string, content: string): Promise<void>
        createFolder(root: string, parentDir: string, name: string): Promise<string>
        createFile(root: string, parentDir: string, name: string): Promise<string>
        renameItem(root: string, itemPath: string, nextName: string): Promise<string>
        deleteItem(root: string, itemPath: string): Promise<void>
        copyItem(root: string, sourcePath: string, targetParentDir: string): Promise<string>
        moveItem(root: string, sourcePath: string, targetParentDir: string): Promise<string>
        uploadAttachments(root: string): Promise<Array<{ absPath: string; relPath: string; name: string }>>
        importFiles(root: string, sourcePaths: string[], targetDir: string): Promise<Array<{ absPath: string; relPath: string; name: string }>>
        importScreenplays(root: string, targetDir: string): Promise<UploadedReference[]>
        readClipboardFilePaths(): Promise<string[]>
        writeClipboardFilePaths(paths: string[]): Promise<void>
        applyDefaultContent(filePath: string): Promise<void>
        search(root: string, query: string, opts: unknown): Promise<unknown>
        replaceInFile(filePath: string, query: string, replacement: string, opts: unknown): Promise<number>
        getPathForFile(file: File): string
        copyPathToClipboard(filePath: string): Promise<void>
        revealInExplorer(filePath: string): Promise<void>
        exportStory(filePath: string): Promise<string | null>
        onWatch(cb: (event: string, filename: string) => void): () => void
      }
      version: {
        getSnapshot(root: string): Promise<VersionSnapshot>
        save(root: string, message: string): Promise<VersionRecord>
        createLine(root: string, kind: 'director' | 'platform'): Promise<VersionSnapshot>
        markFinal(root: string): Promise<VersionRecord>
        restore(root: string, versionId: string): Promise<VersionSnapshot>
        compare(root: string, fromId: string, toId: string): Promise<VersionDiff>
        compareWorkingFile(root: string, filePath: string): Promise<VersionDiff>
      }
      agent: {
        send(sessionId: string, text: string, mode: string, permission: string, modelId?: string): Promise<void>
        permissionRespond(requestId: string, approved: boolean): void
        stop(sessionId: string): Promise<void>
        getConfig(workspaceRoot: string): Promise<AgentConfigSnapshot>
        saveConfig(workspaceRoot: string, config: AgentConfigSnapshot): Promise<AgentConfigSnapshot>
        listModels(workspaceRoot: string): Promise<AgentModelOption[]>
        listResources(): Promise<AgentResources>
        setModel(modelId: string): Promise<void>
        testModel(workspaceRoot: string, modelId?: string): Promise<AgentConnectionTestResult>
        loadSnapshot(workspaceRoot: string): Promise<AgentSnapshot>
        saveSnapshot(workspaceRoot: string, snapshot: AgentSnapshot): Promise<void>
        onEvent(cb: (e: AgentEvent) => void): () => void
      }
      window: {
        minimize(): Promise<void>
        toggleMaximize(): Promise<boolean>
        close(): Promise<void>
        show(): Promise<void>
        isMaximized(): Promise<boolean>
        toggleDevTools(): Promise<void>
        onMaximizedChange(cb: (isMaximized: boolean) => void): () => void
      }
      app: {
        platform: NodeJS.Platform
        getVersion(): Promise<string>
      }
      updater: {
        getStatus(): Promise<UpdateSnapshot>
        check(): Promise<UpdateSnapshot>
        install(): Promise<void>
        onStatus(cb: (snapshot: UpdateSnapshot) => void): () => void
      }
      im: {
        getConfig(): Promise<IMConfigSnapshot>
        saveConfig(config: IMConfigSnapshot): Promise<IMConfigSnapshot>
        getStatuses(): Promise<IMStatusSnapshot[]>
        start(platform: IMPlatform): Promise<IMStatusSnapshot>
        stop(platform: IMPlatform): Promise<IMStatusSnapshot>
        onStatus(cb: (snapshot: IMStatusSnapshot) => void): () => void
        onMessage(cb: (event: IMConversationEvent) => void): () => void
      }
    }
  }
}
