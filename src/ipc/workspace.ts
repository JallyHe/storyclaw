import type { FileSearchResult, NewProjectOptions, SearchOptions, StoryFile, TreeNode, UploadedReference } from '@/types'
import { getApi } from './api'

export type { FileSearchResult, SearchMatch, SearchOptions } from '@/types'

export const workspaceIpc = {
  openDialog: (): Promise<string | null>                        => getApi().workspace.openDialog(),
  open:       (dir: string): Promise<TreeNode[]>                => getApi().workspace.open(dir),
  close:      (): Promise<void>                                 => getApi().workspace.close(),
  tree:       (dir: string): Promise<TreeNode[]>                => getApi().workspace.tree(dir),
  create:     (opts: NewProjectOptions): Promise<string>        => getApi().workspace.create(opts),
  readFile:   (path: string): Promise<StoryFile>                => getApi().workspace.readFile(path),
  writeFile:  (path: string, data: StoryFile): Promise<void>    => getApi().workspace.writeFile(path, data),
  readText:   (path: string): Promise<string>                   => getApi().workspace.readText(path),
  readFileBuffer: (path: string): Promise<Uint8Array>            => getApi().workspace.readFileBuffer(path),
  writeText:  (path: string, content: string): Promise<void>    => getApi().workspace.writeText(path, content),
  createFolder: (root: string, parentDir: string, name: string): Promise<string> =>
    getApi().workspace.createFolder(root, parentDir, name),
  createFile: (root: string, parentDir: string, name: string): Promise<string> =>
    getApi().workspace.createFile(root, parentDir, name),
  renameItem: (root: string, itemPath: string, nextName: string): Promise<string> =>
    getApi().workspace.renameItem(root, itemPath, nextName),
  deleteItem: (root: string, itemPath: string): Promise<void> =>
    getApi().workspace.deleteItem(root, itemPath),
  copyItem: (root: string, sourcePath: string, targetParentDir: string): Promise<string> =>
    getApi().workspace.copyItem(root, sourcePath, targetParentDir),
  moveItem: (root: string, sourcePath: string, targetParentDir: string): Promise<string> =>
    getApi().workspace.moveItem(root, sourcePath, targetParentDir),
  uploadAttachments: (root: string): Promise<Array<{ absPath: string; relPath: string; name: string }>> =>
    getApi().workspace.uploadAttachments(root),
  importFiles: (root: string, sourcePaths: string[], targetDir: string): Promise<Array<{ absPath: string; relPath: string; name: string }>> =>
    getApi().workspace.importFiles(root, sourcePaths, targetDir),
  importScreenplays: (root: string, targetDir: string): Promise<UploadedReference[]> =>
    getApi().workspace.importScreenplays(root, targetDir),
  readClipboardFilePaths: (): Promise<string[]> =>
    getApi().workspace.readClipboardFilePaths(),
  writeClipboardFilePaths: (paths: string[], operation?: 'copy' | 'cut'): Promise<void> =>
    getApi().workspace.writeClipboardFilePaths(paths, operation),
  applyDefaultContent: (filePath: string): Promise<void> =>
    getApi().workspace.applyDefaultContent(filePath),
  search: (root: string, query: string, opts: SearchOptions): Promise<FileSearchResult[]> =>
    getApi().workspace.search(root, query, opts) as Promise<FileSearchResult[]>,
  replaceInFile: (filePath: string, query: string, replacement: string, opts: SearchOptions): Promise<number> =>
    getApi().workspace.replaceInFile(filePath, query, replacement, opts),
  getPathForFile: (file: File): string => getApi().workspace.getPathForFile(file),
  copyPathToClipboard: (path: string): Promise<void> =>
    getApi().workspace.copyPathToClipboard(path),
  revealInExplorer: (path: string): Promise<void> =>
    getApi().workspace.revealInExplorer(path),
  exportStory: (path: string): Promise<string | null> =>
    getApi().workspace.exportStory(path),
  onWatch:    (cb: (e: string, f: string) => void) => getApi().workspace.onWatch(cb)
}
