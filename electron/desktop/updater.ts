import { app, BrowserWindow, dialog } from 'electron'
import type { MessageBoxOptions } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateSnapshot {
  currentVersion: string
  status: UpdateStatus
  latestVersion?: string
  message?: string
  progress?: number
}

let snapshot: UpdateSnapshot = {
  currentVersion: app.getVersion(),
  status: 'idle'
}

let targetWindow: BrowserWindow | null = null

function emit(): void {
  targetWindow?.webContents.send('updater:status', snapshot)
}

function setSnapshot(next: Partial<UpdateSnapshot>): UpdateSnapshot {
  snapshot = {
    ...snapshot,
    ...next,
    currentVersion: app.getVersion()
  }
  emit()
  return snapshot
}

export function bindUpdater(win: BrowserWindow): void {
  targetWindow = win
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setSnapshot({ status: 'checking', message: '正在检查更新...' })
  })

  autoUpdater.on('update-available', info => {
    setSnapshot({
      status: 'available',
      latestVersion: info.version,
      message: `发现新版本 ${info.version}，正在下载。`
    })
  })

  autoUpdater.on('update-not-available', info => {
    setSnapshot({
      status: 'not-available',
      latestVersion: info.version,
      message: '当前已是最新版本。'
    })
  })

  autoUpdater.on('download-progress', progress => {
    setSnapshot({
      status: 'downloading',
      progress: Math.round(progress.percent),
      message: `正在下载更新 ${Math.round(progress.percent)}%。`
    })
  })

  autoUpdater.on('update-downloaded', info => {
    setSnapshot({
      status: 'downloaded',
      latestVersion: info.version,
      progress: 100,
      message: `版本 ${info.version} 已下载，重启后安装。`
    })
  })

  autoUpdater.on('error', error => {
    setSnapshot({
      status: 'error',
      message: formatUpdateError(error)
    })
  })
}

export function getUpdateSnapshot(): UpdateSnapshot {
  return snapshot
}

export async function checkForUpdates(): Promise<UpdateSnapshot> {
  if (!app.isPackaged) {
    return setSnapshot({
      status: 'not-available',
      message: '开发模式不执行自动更新。打包发布后会启用版本检测。',
      latestVersion: app.getVersion()
    })
  }

  setSnapshot({ status: 'checking', message: '正在检查更新...' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    setSnapshot({
      status: 'error',
      message: formatUpdateError(err)
    })
  }
  return snapshot
}

export function installUpdate(): void {
  if (snapshot.status !== 'downloaded') {
    const options: MessageBoxOptions = {
      type: 'info',
      title: 'StoryClaw 更新',
      message: '还没有可安装的更新。',
      buttons: ['知道了']
    }

    const prompt = targetWindow
      ? dialog.showMessageBox(targetWindow, options)
      : dialog.showMessageBox(options)

    prompt.catch(() => {})
    return
  }
  autoUpdater.quitAndInstall()
}

function formatUpdateError(error: Error): string {
  const raw = error?.message ?? String(error)
  if (/Cannot download/i.test(raw)) {
    return '更新下载失败：请确认 GitHub Release 已上传 latest.yml、安装包和 blockmap。'
  }
  if (/Cannot find .*latest\.yml|CHANNEL_FILE_NOT_FOUND/i.test(raw)) {
    return '未找到更新清单 latest.yml，请确认它已上传到最新 GitHub Release。'
  }
  if (/Unable to find latest version|No published versions/i.test(raw)) {
    return '未找到可用的 GitHub Release，请确认仓库已有正式发布版本。'
  }
  return raw
}
