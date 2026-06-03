import { app, BrowserWindow, shell, ipcMain, dialog, clipboard } from 'electron'
import type { Event } from 'electron'
import * as path from 'path'
import { is } from '@electron-toolkit/utils'
import {
  buildTree,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceItem,
  readStoryFile,
  writeStoryFile,
  readTextFile,
  readFileBuffer,
  writeTextFile,
  renameWorkspaceItem,
  watchDir,
  scaffoldProject,
  copyItem,
  moveItem,
  uploadAttachments,
  importExternalFiles,
  importScreenplayFiles,
  applyDefaultContentForExtension,
  searchInFiles,
  replaceInFile
} from './fs/workspace'
import { exportScreenplayFile } from './fs/export'
import type { NewProjectOptions, SearchOptions } from '../src/types'
import { getWorkspaceRoot, setAgentModel, startAgentSession, sendPrompt, stopAgent } from './agent/session'
import { loadAgentSnapshot, saveAgentSnapshot } from './agent/persistence'
import { listAgentResources } from './agent/skills'
import {
  listConfiguredAgentModels,
  loadAgentConfig,
  saveAgentConfig,
  testAgentModel
} from './agent/config'
import { createAppTray, hideToTray, markQuitting, shouldQuit, showWindow } from './desktop/tray'
import { bindUpdater, checkForUpdates, getUpdateSnapshot, installUpdate } from './desktop/updater'
import { imManager } from './im/manager'
import { loadIMConfig } from './im/config'
import { loadConversations, saveConversations } from './im/conversations'
import type { IMConfigSnapshot, IMPlatform } from '../src/im/types'
import {
  normalizeClipboardPaths,
  parseClipboardTextPaths,
  readMacClipboardFilePaths,
  readWindowsClipboardFilePaths,
  writeMacClipboardFilePaths,
  writeWindowsClipboardFilePaths,
  type ClipboardFileOperation
} from './desktop/clipboardFiles'
import {
  compareVersions,
  compareWorkingFile,
  createVersionLine,
  getVersionSnapshot,
  markFinalVersion,
  restoreVersion,
  saveVersion
} from './versioning/service'

export let win: BrowserWindow | null = null
let stopWatch: (() => void) | null = null
const appIconPath = path.join(__dirname, '../assets/storyclaw-logo.png')

function readElectronClipboardFilePaths(): string[] {
  return normalizeClipboardPaths(parseClipboardTextPaths(clipboard.readText()))
}

async function readClipboardFilePaths(): Promise<string[]> {
  if (process.platform === 'win32') {
    try {
      const nativePaths = normalizeClipboardPaths(await readWindowsClipboardFilePaths())
      if (nativePaths.length > 0) return nativePaths
    } catch (error) {
      console.warn('Failed to read Windows file clipboard via native bridge:', error)
    }
  }
  if (process.platform === 'darwin') {
    try {
      const nativePaths = normalizeClipboardPaths(await readMacClipboardFilePaths())
      if (nativePaths.length > 0) return nativePaths
    } catch (error) {
      console.warn('Failed to read macOS file clipboard via native bridge:', error)
    }
  }
  return readElectronClipboardFilePaths()
}

function writeElectronClipboardFilePaths(paths: string[]): void {
  const normalized = normalizeClipboardPaths(paths)
  if (normalized.length === 0) return
  clipboard.writeText(normalized.join('\n'))
}

async function writeClipboardFilePaths(paths: string[], operation: ClipboardFileOperation = 'copy'): Promise<void> {
  const normalized = normalizeClipboardPaths(paths)
  if (normalized.length === 0) return
  if (process.platform === 'win32') {
    try {
      await writeWindowsClipboardFilePaths(normalized, operation)
      return
    } catch (error) {
      console.warn('Failed to write Windows file clipboard via native bridge:', error)
    }
  }
  if (process.platform === 'darwin') {
    try {
      await writeMacClipboardFilePaths(normalized)
      return
    } catch (error) {
      console.warn('Failed to write macOS file clipboard via native bridge:', error)
    }
  }
  writeElectronClipboardFilePaths(normalized)
}

async function waitForRenderer(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // The dev server can print its URL a moment before it accepts connections.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

async function loadDevRenderer(targetWindow: BrowserWindow, url: string): Promise<void> {
  const ready = await waitForRenderer(url)
  if (!ready) {
    await targetWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
      '<body style="background:#0f1116;color:#f4efe7;font:16px sans-serif;padding:32px">Renderer dev server did not become available. Check the StoryClaw dev log.</body>'
    )}`)
    return
  }

  try {
    await targetWindow.loadURL(url)
  } catch (err) {
    console.error('[Renderer] Failed to load dev URL, retrying once:', err)
    if (await waitForRenderer(url)) {
      await targetWindow.loadURL(url)
    }
  }
}

function emitWindowState(targetWindow: BrowserWindow): void {
  targetWindow.webContents.send('window:maximized-change', targetWindow.isMaximized())
}

function bindWindowStateEvents(targetWindow: BrowserWindow): void {
  targetWindow.on('maximize', () => emitWindowState(targetWindow))
  targetWindow.on('unmaximize', () => emitWindowState(targetWindow))
  targetWindow.on('restore', () => emitWindowState(targetWindow))
  targetWindow.on('minimize' as any, (event: Event) => {
    if (process.platform === 'darwin') return
    event.preventDefault()
    hideToTray(targetWindow)
  })
  targetWindow.on('close', event => {
    if (shouldQuit()) return
    event.preventDefault()
    hideToTray(targetWindow)
  })
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0f1116',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false, contextIsolation: true
    }
  })
  bindWindowStateEvents(win)
  bindUpdater(win)
  imManager.bindWindow(win)
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const key = input.key.toLowerCase()
      const isMac = process.platform === 'darwin'
      const isWinShortcut = !isMac && input.control && input.shift && key === 'i'
      const isMacShortcut = isMac && input.meta && input.alt && key === 'i'
      const isF12 = key === 'f12'
      if (isWinShortcut || isMacShortcut || isF12) {
        win?.webContents.toggleDevTools()
        event.preventDefault()
      }
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await loadDevRenderer(win, process.env['ELECTRON_RENDERER_URL'])
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// ─── Workspace IPC ────────────────────────────────────────────────────────────

ipcMain.handle('workspace:openDialog', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('workspace:open', async (_e, dir: string) => {
  if (stopWatch) { stopWatch(); stopWatch = null }
  const tree = await buildTree(dir)
  stopWatch = watchDir(dir, (event, filename) => {
    win?.webContents.send('workspace:watch', event, filename)
  })
  // start Pi Agent session for this workspace
  startAgentSession(dir, win!).catch(err => {
    console.error('[Agent] Failed to start session:', err.message)
  })
  return tree
})

ipcMain.handle('workspace:tree', async (_e, dir: string) => {
  return buildTree(dir)
})

ipcMain.handle('workspace:create', async (_e, opts: NewProjectOptions) => {
  return scaffoldProject(opts)
})

ipcMain.handle('workspace:readFile', async (_e, filePath: string) => {
  return readStoryFile(filePath)
})

ipcMain.handle('workspace:writeFile', async (_e, filePath: string, data: unknown) => {
  await writeStoryFile(filePath, data as any)
  win?.webContents.send('workspace:watch', 'change', path.basename(filePath))
})

ipcMain.handle('workspace:readText', async (_e, filePath: string) => {
  return readTextFile(filePath)
})

ipcMain.handle('workspace:readFileBuffer', async (_e, filePath: string) => {
  return readFileBuffer(filePath)
})

ipcMain.handle('workspace:writeText', async (_e, filePath: string, content: string) => {
  const result = writeTextFile(filePath, content)
  win?.webContents.send('workspace:watch', 'change', path.basename(filePath))
  return result
})

ipcMain.handle('workspace:createFolder', async (_e, root: string, parentDir: string, name: string) => {
  const result = createWorkspaceFolder(root, parentDir, name)
  win?.webContents.send('workspace:watch', 'rename', name)
  return result
})

ipcMain.handle('workspace:createFile', async (_e, root: string, parentDir: string, name: string) => {
  const result = createWorkspaceFile(root, parentDir, name)
  win?.webContents.send('workspace:watch', 'change', name)
  return result
})

ipcMain.handle('workspace:renameItem', async (_e, root: string, itemPath: string, nextName: string) => {
  const result = renameWorkspaceItem(root, itemPath, nextName)
  win?.webContents.send('workspace:watch', 'rename', nextName)
  return result
})

ipcMain.handle('workspace:deleteItem', async (_e, root: string, itemPath: string) => {
  const result = deleteWorkspaceItem(root, itemPath)
  win?.webContents.send('workspace:watch', 'rename', '')
  return result
})

ipcMain.handle('workspace:copyItem', async (_e, root: string, sourcePath: string, targetParentDir: string) => {
  const result = copyItem(root, sourcePath, targetParentDir)
  win?.webContents.send('workspace:watch', 'change', '')
  return result
})

ipcMain.handle('workspace:moveItem', async (_e, root: string, sourcePath: string, targetParentDir: string) => {
  const result = moveItem(root, sourcePath, targetParentDir)
  win?.webContents.send('workspace:watch', 'change', '')
  return result
})

ipcMain.handle('workspace:uploadAttachments', async (_e, root: string) => {
  if (!win) return []
  const result = await dialog.showOpenDialog(win, {
    title: '上传文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '支持的文档', extensions: ['pdf', 'docx', 'txt', 'md', 'rtf', 'csv', 'json', 'log', 'html', 'xml'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []
  const uploaded = await uploadAttachments(root, result.filePaths)
  win?.webContents.send('workspace:watch', 'change', '')
  return uploaded
})

ipcMain.handle('workspace:importFiles', async (_e, root: string, sourcePaths: string[], targetDir: string) => {
  const result = await importExternalFiles(root, sourcePaths, targetDir)
  win?.webContents.send('workspace:watch', 'change', '')
  return result
})

ipcMain.handle('workspace:importScreenplays', async (_e, root: string, targetDir: string) => {
  if (!win) return []
  const result = await dialog.showOpenDialog(win, {
    title: '导入剧本',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '剧本文档', extensions: ['pdf', 'docx', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []
  const imported = await importScreenplayFiles(root, result.filePaths, targetDir)
  win?.webContents.send('workspace:watch', 'change', '')
  return imported
})

ipcMain.handle('workspace:applyDefaultContent', async (_e, filePath: string) => {
  const result = await applyDefaultContentForExtension(filePath)
  win?.webContents.send('workspace:watch', 'change', path.basename(filePath))
  return result
})

ipcMain.handle('workspace:search', async (_e, root: string, query: string, opts: SearchOptions) => {
  return searchInFiles(root, query, opts)
})

ipcMain.handle('workspace:replaceInFile', async (_e, filePath: string, query: string, replacement: string, opts: SearchOptions) => {
  const result = await replaceInFile(filePath, query, replacement, opts)
  win?.webContents.send('workspace:watch', 'change', path.basename(filePath))
  return result
})

ipcMain.handle('workspace:copyPathToClipboard', async (_e, filePath: string) => {
  clipboard.writeText(filePath)
})

ipcMain.handle('workspace:readClipboardFilePaths', async () => {
  return readClipboardFilePaths()
})

ipcMain.handle('workspace:writeClipboardFilePaths', async (_e, paths: string[], operation?: ClipboardFileOperation) => {
  await writeClipboardFilePaths(paths, operation)
})

ipcMain.handle('workspace:revealInExplorer', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('workspace:exportStory', async (_e, filePath: string) => {
  return exportScreenplayFile(filePath, win)
})

// ─── Local Version IPC ───────────────────────────────────────────────────────

ipcMain.handle('version:getSnapshot', async (_e, root: string) => {
  return getVersionSnapshot(root)
})

ipcMain.handle('version:save', async (_e, root: string, message: string) => {
  return saveVersion(root, message)
})

ipcMain.handle('version:createLine', async (_e, root: string, kind: 'director' | 'platform') => {
  return createVersionLine(root, kind)
})

ipcMain.handle('version:markFinal', async (_e, root: string) => {
  return markFinalVersion(root)
})

ipcMain.handle('version:restore', async (_e, root: string, versionId: string) => {
  return restoreVersion(root, versionId)
})

ipcMain.handle('version:compare', async (_e, root: string, fromId: string, toId: string) => {
  return compareVersions(root, fromId, toId)
})

ipcMain.handle('version:compareWorkingFile', async (_e, root: string, filePath: string) => {
  return compareWorkingFile(root, filePath)
})

// ─── Agent IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('agent:send', async (_e, sessionId: string, text: string, mode: any, permission: any, modelId?: string) => {
  try {
    await sendPrompt(sessionId, text, mode, permission ?? 'default', modelId)
  } catch (err: any) {
    const raw: string = err?.message ?? String(err)
    const isAuthError = /no api key|login|oauth|api key/i.test(raw)
    const friendly = isAuthError
      ? '⚠️ 未找到 API Key。请点击下方工具栏中的模型名称 → 编辑当前模型 → 填写 API Key → 保存并使用。'
      : `错误：${raw}`
    win?.webContents.send('agent:event', { sessionId, type: 'text_delta', delta: friendly })
    win?.webContents.send('agent:event', { sessionId, type: 'agent_end' })
  }
})

// Renderer responds to a permission request from a tool call
ipcMain.on('agent:permission-response', (_e, requestId: string, approved: boolean) => {
  ipcMain.emit(`agent:permission-response:${requestId}`, null, approved)
})

ipcMain.handle('agent:stop', async (_e, sessionId: string) => {
  await stopAgent(sessionId)
  win?.webContents.send('agent:event', { sessionId, type: 'agent_end' })
})

ipcMain.handle('agent:getConfig', async () => {
  return loadAgentConfig()
})

ipcMain.handle('agent:saveConfig', async (_e, config) => {
  const saved = await saveAgentConfig(config)
  // Restart the session so the new AuthStorage picks up the updated API keys.
  // setAgentModel() alone cannot update auth on a live session.
  const workspaceRoot = getWorkspaceRoot()
  if (workspaceRoot && win) {
    startAgentSession(workspaceRoot, win).catch(err => {
      console.error('[Agent] Failed to restart session after config save:', err.message)
    })
  }
  return saved
})

ipcMain.handle('agent:listModels', async () => {
  return listConfiguredAgentModels()
})

ipcMain.handle('agent:listResources', async () => {
  return listAgentResources()
})

ipcMain.handle('agent:setModel', async (_e, modelId: string) => {
  await setAgentModel(modelId)
})

ipcMain.handle('agent:testModel', async (_e, modelId?: string) => {
  return testAgentModel(modelId)
})

ipcMain.handle('agent:loadSnapshot', async (_e, workspaceRoot: string) => {
  return loadAgentSnapshot(workspaceRoot)
})

ipcMain.handle('agent:saveSnapshot', async (_e, workspaceRoot: string, snapshot) => {
  await saveAgentSnapshot(workspaceRoot, snapshot)
})

// ─── Window IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('window:toggleDevTools', () => {
  win?.webContents.toggleDevTools()
})

ipcMain.handle('window:minimize', () => {
  if (process.platform === 'darwin') {
    win?.minimize()
    return
  }
  hideToTray(win)
})

ipcMain.handle('window:toggleMaximize', () => {
  if (!win) return false
  if (win.isMaximized()) {
    win.unmaximize()
    return false
  }
  win.maximize()
  return true
})

ipcMain.handle('window:close', () => {
  hideToTray(win)
})

ipcMain.handle('window:isMaximized', () => {
  return win?.isMaximized() ?? false
})

ipcMain.handle('window:show', () => {
  showWindow(win)
})

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('updater:getStatus', () => {
  return getUpdateSnapshot()
})

ipcMain.handle('updater:check', async () => {
  return checkForUpdates()
})

ipcMain.handle('updater:install', () => {
  installUpdate()
})

// ─── IM (多平台接入) IPC ────────────────────────────────────────────────────────

ipcMain.handle('im:getConfig', async () => {
  return loadIMConfig()
})

ipcMain.handle('im:saveConfig', async (_e, config: IMConfigSnapshot) => {
  return imManager.applyConfig(config)
})

ipcMain.handle('im:getStatuses', () => {
  return imManager.getAllStatuses()
})

ipcMain.handle('im:start', async (_e, platform: IMPlatform) => {
  return imManager.startPlatform(platform)
})

ipcMain.handle('im:stop', async (_e, platform: IMPlatform) => {
  return imManager.stopPlatform(platform)
})

ipcMain.handle('im:loadConversations', () => {
  return loadConversations()
})

ipcMain.handle('im:saveConversations', (_e, sessions: unknown[]) => {
  return saveConversations(sessions)
})

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow().catch(err => console.error('[App] Failed to create window:', err))
  createAppTray(() => win, () => { void checkForUpdates() })
  if (app.isPackaged) {
    setTimeout(() => { void checkForUpdates() }, 3000)
  }
  // 启动已启用的 IM 平台（机器人在用户打开工作区后才能基于项目回答）
  setTimeout(() => { void imManager.startEnabled() }, 1500)
  app.on('activate', () => {
    if (win) {
      showWindow(win)
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(err => console.error('[App] Failed to create window:', err))
    }
  })
})

app.on('before-quit', markQuitting)

app.on('window-all-closed', () => { if (process.platform === 'darwin') return })
