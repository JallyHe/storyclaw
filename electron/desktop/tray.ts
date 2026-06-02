import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let isQuitting = false

const iconPath = join(__dirname, '../assets/storyclaw-logo.png')

export function shouldQuit(): boolean {
  return isQuitting
}

export function markQuitting(): void {
  isQuitting = true
}

export function showWindow(win: BrowserWindow | null): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function hideToTray(win: BrowserWindow | null): void {
  win?.hide()
}

export function createAppTray(getWindow: () => BrowserWindow | null, checkForUpdates: () => void): Tray | null {
  if (tray) return tray
  if (process.platform === 'darwin') return null

  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('StoryClaw')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '打开 StoryClaw',
      click: () => showWindow(getWindow())
    },
    {
      label: '检查更新',
      click: checkForUpdates
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        markQuitting()
        app.quit()
      }
    }
  ]))
  tray.on('click', () => showWindow(getWindow()))

  return tray
}
