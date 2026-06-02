# StoryClaw Plan 1 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a working Electron + React + TypeScript project with file-system service, IPC bridge, Zustand store, and CSS theme system — the entire foundation that Plans 2–4 build on.

**Architecture:** electron-vite monorepo; Pi Agent and fs ops live in main process; renderer communicates via contextBridge-exposed `window.api`; Zustand holds all UI state; CSS custom properties drive dark/light theme.

**Tech Stack:** Electron 33, electron-vite 3, React 18, TypeScript 5, Zustand 4, vitest 1, @testing-library/react 14

---

## File Map

```
StoryClaw/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron/
│   ├── main.ts               # BrowserWindow + IPC handlers
│   ├── preload.ts            # contextBridge → window.api
│   └── fs/
│       ├── workspace.ts      # openDir, readFile, writeFile, watchDir, buildTree
│       └── serializer.ts     # validate + parse each file type
├── src/
│   ├── main.tsx              # ReactDOM.createRoot
│   ├── env.d.ts              # import.meta.env types + window.api types
│   ├── types/
│   │   └── index.ts          # EpFile, ChrFile, OtlFile, WldFile, FileNode, AgentEvent …
│   ├── ipc/
│   │   ├── workspace.ts      # invoke wrappers for workspace:* channels
│   │   └── agent.ts          # invoke + on wrappers for agent:* channels
│   ├── store/
│   │   ├── workspace.ts      # Zustand slice: tree, openFile, dirty set
│   │   ├── tabs.ts           # Zustand slice: openTabs, activeFile, closeTab
│   │   ├── sessions.ts       # Zustand slice: sessions, activeSession, messages
│   │   ├── changes.ts        # Zustand slice: pendingChanges, accept, reject
│   │   └── ui.ts             # Zustand slice: view, theme, panelWidths, leftPanel
│   └── styles/
│       ├── globals.css       # reset, scrollbars, button base
│       └── theme.css         # CSS custom properties (dark + light tokens)
└── tests/
    ├── serializer.test.ts
    └── store.test.ts
```

---

## Task 1: Git init + package.json + electron-vite scaffold

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.gitignore`
- Create: `electron/main.ts` (skeleton)
- Create: `electron/preload.ts` (skeleton)
- Create: `src/main.tsx` (skeleton)
- Create: `src/App.tsx` (skeleton)
- Create: `index.html`

- [ ] **Step 1: Initialize git**

```bash
cd D:/codeup/StoryClaw
git init
```

Expected: `Initialized empty Git repository in D:/codeup/StoryClaw/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "storyclaw",
  "version": "0.1.0",
  "description": "AI-powered screenplay editor",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "latest",
    "pdf-parse": "^1.1.1",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^3.0.0",
    "@testing-library/react": "^14.3.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^20.14.0",
    "@types/pdf-parse": "^1.1.4",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^33.0.0",
    "electron-vite": "^2.3.0",
    "jsdom": "^24.1.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `electron.vite.config.ts`**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@main': resolve('electron') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: { '@': resolve('src') }
    },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/test-setup.ts']
    }
  }
})
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 5: Create `tsconfig.node.json`**

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
  "include": ["electron/**/*", "electron.vite.config.*"],
  "compilerOptions": {
    "composite": true,
    "outDir": "out/main",
    "baseUrl": ".",
    "paths": { "@main/*": ["electron/*"] }
  }
}
```

- [ ] **Step 6: Create `tsconfig.web.json`**

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": ["src/**/*"],
  "compilerOptions": {
    "composite": true,
    "outDir": "out/renderer",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 7: Create `index.html`**

```html
<!DOCTYPE html>
<html data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StoryClaw</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
out/
dist/
*.local
.DS_Store
```

- [ ] **Step 9: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 10: Install dependencies**

```bash
npm install
```

Expected: no errors, `node_modules/` created.

- [ ] **Step 11: Create skeleton `electron/main.ts`**

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0f1116',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

- [ ] **Step 12: Create skeleton `electron/preload.ts`**

```typescript
import { contextBridge } from 'electron'

// Will be expanded in Task 4
contextBridge.exposeInMainWorld('api', {
  version: '0.1.0'
})
```

- [ ] **Step 13: Create skeleton `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 14: Create skeleton `src/App.tsx`**

```typescript
export default function App() {
  return <div className="app"><div style={{ color: 'var(--text-0)', padding: 40 }}>StoryClaw loading…</div></div>
}
```

- [ ] **Step 15: Verify dev starts**

```bash
npm run dev
```

Expected: Electron window opens showing "StoryClaw loading…". Close window, Ctrl+C.

- [ ] **Step 16: Commit**

```bash
git add .
git commit -m "feat: scaffold electron-vite project"
```

---

## Task 2: TypeScript type definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```typescript
// ─── File format types ────────────────────────────────────────────────────────

export type BlockType = 'scene' | 'action' | 'character' | 'dialogue' | 'paren'

export interface SceneBlock {
  id: string; type: 'scene'
  number: string; intext: string; location: string; time: string; synopsis: string
}
export interface ActionBlock  { id: string; type: 'action';    text: string }
export interface CharBlock    { id: string; type: 'character'; name: string; ext?: string }
export interface DialogueBlock{ id: string; type: 'dialogue'; text: string }
export interface ParenBlock   { id: string; type: 'paren';    text: string }

export type Block = SceneBlock | ActionBlock | CharBlock | DialogueBlock | ParenBlock

export interface EpFile {
  version: 1; episode: string; title: string
  status: 'todo' | 'wip' | 'done'; logline: string; blocks: Block[]
}

export interface ChrFile {
  version: 1; name: string; role: string; age: number; color: string
  tagline: string; traits: string[]; arc: string; voice: string; appearsIn: string[]
}

export interface OtlAct { id: string; act: string; beats: string[] }
export interface OtlFile {
  version: 1; scope: 'series' | 'episode'; episode?: string; logline: string; acts: OtlAct[]
}

export interface WldFile { version: 1; title: string; body: string }

export type StoryFile = EpFile | ChrFile | OtlFile | WldFile

// ─── File tree ────────────────────────────────────────────────────────────────

export type FileExt = 'ep' | 'chr' | 'otl' | 'wld' | 'txt' | 'md' | 'pdf' | string

export interface FileNode {
  id: string          // absolute path
  name: string        // display name (without extension)
  ext: FileExt
  kind: 'file'
  badge?: string      // e.g. "已完成"
}

export interface FolderNode {
  id: string          // absolute path
  name: string
  kind: 'folder'
  children: TreeNode[]
}

export type TreeNode = FileNode | FolderNode

// ─── Diff / changes ───────────────────────────────────────────────────────────

export type DiffStatus = 'add' | 'del' | null

export interface DiffBlock { blk: Block; diff: DiffStatus }

export interface PendingChange {
  fileId: string        // absolute path
  diffBlocks: DiffBlock[]
  newContent: StoryFile
  focusAfter?: string   // block id to scroll to after accept
}

// ─── Agent session ────────────────────────────────────────────────────────────

export interface ToolStep {
  kind: 'read' | 'write' | 'list' | 'search'
  label: string
  target: string
  isError?: boolean
}

export interface AssistantMessage {
  role: 'assistant'
  steps: ToolStep[]
  reply: string[]
  typing: boolean
}

export interface UserMessage {
  role: 'user'
  text: string
}

export type Message = UserMessage | AssistantMessage

export interface Session {
  id: string
  title: string
  group: string
  time: string
  messages: Message[]
}

// ─── IPC / agent events ───────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'text_delta';  delta: string }
  | { type: 'tool_start';  tool: string; label: string; target: string }
  | { type: 'tool_end';    tool: string; isError: boolean }
  | { type: 'change';      fileId: string; diffBlocks: DiffBlock[]; newContent: StoryFile }
  | { type: 'agent_end' }

// ─── UI state ─────────────────────────────────────────────────────────────────

export type AppView = 'editor' | 'agent'
export type LeftPanel = 'explorer' | 'search' | 'scm'
export type AgentMode = 'craft' | 'plan' | 'ask'
export type ThemeKey = 'dark' | 'light'
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: File system service (main process)

**Files:**
- Create: `electron/fs/workspace.ts`
- Create: `electron/fs/serializer.ts`
- Create: `tests/serializer.test.ts`

- [ ] **Step 1: Create `electron/fs/serializer.ts`**

```typescript
import type { EpFile, ChrFile, OtlFile, WldFile, StoryFile, FileExt } from '../../src/types'

export function parseFile(ext: FileExt, raw: string): StoryFile {
  const data = JSON.parse(raw)
  switch (ext) {
    case 'ep':  return validateEp(data)
    case 'chr': return validateChr(data)
    case 'otl': return validateOtl(data)
    case 'wld': return validateWld(data)
    default:    throw new Error(`Unknown ext: ${ext}`)
  }
}

export function serializeFile(data: StoryFile): string {
  return JSON.stringify(data, null, 2)
}

function validateEp(d: unknown): EpFile {
  const o = d as EpFile
  if (!Array.isArray(o.blocks)) throw new Error('ep: missing blocks')
  return { version: 1, episode: o.episode ?? '', title: o.title ?? '', status: o.status ?? 'wip', logline: o.logline ?? '', blocks: o.blocks }
}

function validateChr(d: unknown): ChrFile {
  const o = d as ChrFile
  return { version: 1, name: o.name ?? '', role: o.role ?? '', age: o.age ?? 0, color: o.color ?? '#888', tagline: o.tagline ?? '', traits: o.traits ?? [], arc: o.arc ?? '', voice: o.voice ?? '', appearsIn: o.appearsIn ?? [] }
}

function validateOtl(d: unknown): OtlFile {
  const o = d as OtlFile
  return { version: 1, scope: o.scope ?? 'series', episode: o.episode, logline: o.logline ?? '', acts: o.acts ?? [] }
}

function validateWld(d: unknown): WldFile {
  const o = d as WldFile
  return { version: 1, title: o.title ?? '', body: o.body ?? '' }
}
```

- [ ] **Step 2: Create `tests/serializer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseFile, serializeFile } from '../electron/fs/serializer'

const EP_JSON = JSON.stringify({
  version: 1, episode: 'EP01', title: '幽灵来电', status: 'wip', logline: '…',
  blocks: [
    { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '开场' },
    { id: 'b2', type: 'action', text: '灯亮了。' }
  ]
})

describe('parseFile', () => {
  it('parses a valid .ep file', () => {
    const result = parseFile('ep', EP_JSON)
    expect(result).toMatchObject({ episode: 'EP01', title: '幽灵来电' })
  })

  it('throws on missing blocks', () => {
    expect(() => parseFile('ep', JSON.stringify({ version: 1 }))).toThrow('missing blocks')
  })

  it('round-trips .chr file', () => {
    const chr = { version: 1 as const, name: '苏晚', role: '主角', age: 32, color: '#e0a458', tagline: '主播', traits: ['失眠'], arc: '…', voice: '克制', appearsIn: ['EP01'] }
    const parsed = parseFile('chr', JSON.stringify(chr))
    expect(serializeFile(parsed)).toContain('苏晚')
  })

  it('parses .otl file', () => {
    const otl = { version: 1, scope: 'series', logline: '…', acts: [{ id: 'a1', act: '第一幕', beats: ['开场'] }] }
    const result = parseFile('otl', JSON.stringify(otl))
    expect(result).toMatchObject({ scope: 'series' })
  })

  it('parses .wld file', () => {
    const wld = { version: 1, title: '回声节目', body: '深夜节目' }
    const result = parseFile('wld', JSON.stringify(wld))
    expect(result).toMatchObject({ title: '回声节目' })
  })
})
```

- [ ] **Step 3: Run serializer tests — expect PASS**

```bash
npm run test -- tests/serializer.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Create `electron/fs/workspace.ts`**

```typescript
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { TreeNode, FileNode, FolderNode, FileExt, StoryFile } from '../../src/types'
import { parseFile, serializeFile } from './serializer'

const STORY_EXTS = new Set(['ep', 'chr', 'otl', 'wld'])
const REF_EXTS   = new Set(['txt', 'md', 'pdf'])

export async function buildTree(dir: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const e of entries) {
    const fullPath = path.join(dir, e.name)
    if (e.isDirectory()) {
      const folder: FolderNode = {
        id: fullPath, name: e.name, kind: 'folder',
        children: await buildTree(fullPath)
      }
      nodes.push(folder)
    } else if (e.isFile()) {
      const ext = path.extname(e.name).slice(1).toLowerCase() as FileExt
      if (STORY_EXTS.has(ext) || REF_EXTS.has(ext)) {
        const nameWithoutExt = path.basename(e.name, '.' + ext)
        nodes.push({ id: fullPath, name: nameWithoutExt, ext, kind: 'file' } as FileNode)
      }
    }
  }
  return nodes
}

export async function readStoryFile(filePath: string): Promise<StoryFile> {
  const ext = path.extname(filePath).slice(1).toLowerCase() as FileExt
  const raw = await fs.readFile(filePath, 'utf-8')
  return parseFile(ext, raw)
}

export async function writeStoryFile(filePath: string, data: StoryFile): Promise<void> {
  await fs.writeFile(filePath, serializeFile(data), 'utf-8')
}

export async function readTextFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  if (ext === 'pdf') {
    // dynamic import to avoid bundling issues
    const pdfParse = (await import('pdf-parse')).default
    const buf = await fs.readFile(filePath)
    const result = await pdfParse(buf)
    return result.text
  }
  return fs.readFile(filePath, 'utf-8')
}

export function watchDir(dir: string, onChange: (event: string, filename: string) => void): () => void {
  const watcher = fsSync.watch(dir, { recursive: true }, (event, filename) => {
    if (filename) onChange(event, filename)
  })
  return () => watcher.close()
}

// ─── New project scaffold ─────────────────────────────────────────────────────

export interface NewProjectOptions {
  name: string
  type: 'film' | 'series'
  episodes: number
  episodeTitles: string[]
  targetDir: string
}

export async function scaffoldProject(opts: NewProjectOptions): Promise<string> {
  const root = path.join(opts.targetDir, opts.name)
  await fs.mkdir(root, { recursive: true })

  const dirs = ['大纲', '剧集', '人物', '设定', '参考']
  for (const d of dirs) await fs.mkdir(path.join(root, d), { recursive: true })

  // 全剧大纲
  const seriesOtl = serializeFile({
    version: 1, scope: 'series', logline: '', acts: [
      { id: 'a1', act: '第一幕', beats: [''] },
      { id: 'a2', act: '第二幕', beats: [''] },
      { id: 'a3', act: '第三幕', beats: [''] }
    ]
  })
  await fs.writeFile(path.join(root, '大纲', '全剧大纲.otl'), seriesOtl, 'utf-8')

  if (opts.type === 'series') {
    for (let i = 1; i <= opts.episodes; i++) {
      const ep = `EP${String(i).padStart(2, '0')}`
      const title = opts.episodeTitles[i - 1] || '未命名'

      const epOtl = serializeFile({ version: 1, scope: 'episode', episode: ep, logline: '', acts: [{ id: 'a1', act: '开场', beats: [''] }] })
      await fs.writeFile(path.join(root, '大纲', `${ep} 大纲.otl`), epOtl, 'utf-8')

      const epFile = serializeFile({ version: 1, episode: ep, title, status: 'todo', logline: '', blocks: [
        { id: `${ep}-b1`, type: 'scene', number: '1', intext: '内景', location: '待填写', time: '日', synopsis: '' }
      ]})
      await fs.writeFile(path.join(root, '剧集', `${ep} ${title}.ep`), epFile, 'utf-8')
    }
  } else {
    const filmFile = serializeFile({ version: 1, episode: 'FILM', title: opts.name, status: 'todo', logline: '', blocks: [
      { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '待填写', time: '日', synopsis: '' }
    ]})
    await fs.writeFile(path.join(root, '剧集', `${opts.name}.ep`), filmFile, 'utf-8')
  }

  const chr = serializeFile({ version: 1, name: '主角', role: '主角', age: 30, color: '#e0a458', tagline: '', traits: [], arc: '', voice: '', appearsIn: [] })
  await fs.writeFile(path.join(root, '人物', '主角.chr'), chr, 'utf-8')

  const wld = serializeFile({ version: 1, title: '世界观概述', body: '' })
  await fs.writeFile(path.join(root, '设定', '世界观概述.wld'), wld, 'utf-8')

  return root
}
```

- [ ] **Step 5: Commit**

```bash
git add electron/fs/ tests/serializer.test.ts
git commit -m "feat: file system service and serializer"
```

---

## Task 4: IPC handlers + preload bridge

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Create: `src/ipc/workspace.ts`
- Create: `src/ipc/agent.ts`
- Create: `src/env.d.ts`

- [ ] **Step 1: Replace `electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { NewProjectOptions } from '../fs/workspace'
import type { StoryFile, TreeNode, AgentEvent } from '../../src/types'

const api = {
  // workspace
  workspace: {
    openDialog:   (): Promise<string | null>                          => ipcRenderer.invoke('workspace:openDialog'),
    open:         (dir: string): Promise<TreeNode[]>                  => ipcRenderer.invoke('workspace:open', dir),
    create:       (opts: NewProjectOptions): Promise<string>          => ipcRenderer.invoke('workspace:create', opts),
    readFile:     (path: string): Promise<StoryFile>                  => ipcRenderer.invoke('workspace:readFile', path),
    writeFile:    (path: string, data: StoryFile): Promise<void>      => ipcRenderer.invoke('workspace:writeFile', path, data),
    readText:     (path: string): Promise<string>                     => ipcRenderer.invoke('workspace:readText', path),
    onWatch:      (cb: (event: string, filename: string) => void) => {
      ipcRenderer.on('workspace:watch', (_e, ev, fn) => cb(ev, fn))
      return () => ipcRenderer.removeAllListeners('workspace:watch')
    }
  },
  // agent
  agent: {
    send:   (text: string, mode: string): Promise<void>     => ipcRenderer.invoke('agent:send', text, mode),
    stop:   (): Promise<void>                               => ipcRenderer.invoke('agent:stop'),
    onEvent:(cb: (e: AgentEvent) => void) => {
      ipcRenderer.on('agent:event', (_e, ev) => cb(ev))
      return () => ipcRenderer.removeAllListeners('agent:event')
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 2: Create `src/env.d.ts`**

```typescript
/// <reference types="vite/client" />
import type { NewProjectOptions } from '../electron/fs/workspace'
import type { StoryFile, TreeNode, AgentEvent } from './types'

declare global {
  interface Window {
    api: {
      workspace: {
        openDialog(): Promise<string | null>
        open(dir: string): Promise<TreeNode[]>
        create(opts: NewProjectOptions): Promise<string>
        readFile(path: string): Promise<StoryFile>
        writeFile(path: string, data: StoryFile): Promise<void>
        readText(path: string): Promise<string>
        onWatch(cb: (event: string, filename: string) => void): () => void
      }
      agent: {
        send(text: string, mode: string): Promise<void>
        stop(): Promise<void>
        onEvent(cb: (e: AgentEvent) => void): () => void
      }
    }
  }
}
```

- [ ] **Step 3: Replace `electron/main.ts` with full IPC handlers**

```typescript
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { buildTree, readStoryFile, writeStoryFile, readTextFile, watchDir, scaffoldProject } from './fs/workspace'
import type { NewProjectOptions } from './fs/workspace'

export let win: BrowserWindow | null = null
let stopWatch: (() => void) | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0f1116',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, contextIsolation: true
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
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
  return tree
})

ipcMain.handle('workspace:create', async (_e, opts: NewProjectOptions) => {
  return scaffoldProject(opts)
})

ipcMain.handle('workspace:readFile', async (_e, path: string) => {
  return readStoryFile(path)
})

ipcMain.handle('workspace:writeFile', async (_e, path: string, data: unknown) => {
  await writeStoryFile(path, data as any)
})

ipcMain.handle('workspace:readText', async (_e, path: string) => {
  return readTextFile(path)
})

// ─── Agent IPC (stub — filled in Plan 3) ─────────────────────────────────────

ipcMain.handle('agent:send', async (_e, _text: string, _mode: string) => {
  win?.webContents.send('agent:event', { type: 'agent_end' })
})

ipcMain.handle('agent:stop', async () => { /* filled in Plan 3 */ })

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

- [ ] **Step 4: Create `src/ipc/workspace.ts`**

```typescript
import type { TreeNode, StoryFile } from '@/types'
import type { NewProjectOptions } from '../../electron/fs/workspace'

export const workspaceIpc = {
  openDialog: (): Promise<string | null>                        => window.api.workspace.openDialog(),
  open:       (dir: string): Promise<TreeNode[]>                => window.api.workspace.open(dir),
  create:     (opts: NewProjectOptions): Promise<string>        => window.api.workspace.create(opts),
  readFile:   (path: string): Promise<StoryFile>                => window.api.workspace.readFile(path),
  writeFile:  (path: string, data: StoryFile): Promise<void>    => window.api.workspace.writeFile(path, data),
  readText:   (path: string): Promise<string>                   => window.api.workspace.readText(path),
  onWatch:    (cb: (e: string, f: string) => void) => window.api.workspace.onWatch(cb)
}
```

- [ ] **Step 5: Create `src/ipc/agent.ts`**

```typescript
import type { AgentEvent } from '@/types'

export const agentIpc = {
  send:    (text: string, mode: string): Promise<void> => window.api.agent.send(text, mode),
  stop:    (): Promise<void>                           => window.api.agent.stop(),
  onEvent: (cb: (e: AgentEvent) => void)               => window.api.agent.onEvent(cb)
}
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts electron/preload.ts src/ipc/ src/env.d.ts
git commit -m "feat: IPC bridge and preload contextBridge"
```

---

## Task 5: Zustand store slices

**Files:**
- Create: `src/store/workspace.ts`
- Create: `src/store/tabs.ts`
- Create: `src/store/sessions.ts`
- Create: `src/store/changes.ts`
- Create: `src/store/ui.ts`
- Create: `src/store/index.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Create `src/store/workspace.ts`**

```typescript
import { create } from 'zustand'
import type { TreeNode, FileNode, FolderNode, StoryFile } from '@/types'
import { workspaceIpc } from '@/ipc/workspace'

interface WorkspaceState {
  root: string | null
  tree: TreeNode[]
  fileCache: Map<string, StoryFile>
  dirtySet: Set<string>
  openWorkspace: (dir: string) => Promise<void>
  refreshTree: () => Promise<void>
  getFile: (path: string) => Promise<StoryFile>
  saveFile: (path: string, data: StoryFile) => Promise<void>
  markDirty: (path: string) => void
  clearDirty: (path: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: [],
  fileCache: new Map(),
  dirtySet: new Set(),

  openWorkspace: async (dir) => {
    const tree = await workspaceIpc.open(dir)
    set({ root: dir, tree, fileCache: new Map(), dirtySet: new Set() })
  },

  refreshTree: async () => {
    const { root } = get()
    if (!root) return
    const tree = await workspaceIpc.open(root)
    set({ tree })
  },

  getFile: async (path) => {
    const cached = get().fileCache.get(path)
    if (cached) return cached
    const data = await workspaceIpc.readFile(path)
    set(s => { s.fileCache.set(path, data); return { fileCache: new Map(s.fileCache) } })
    return data
  },

  saveFile: async (path, data) => {
    await workspaceIpc.writeFile(path, data)
    set(s => {
      s.fileCache.set(path, data)
      const d = new Set(s.dirtySet); d.delete(path)
      return { fileCache: new Map(s.fileCache), dirtySet: d }
    })
  },

  markDirty: (path) => set(s => { const d = new Set(s.dirtySet); d.add(path); return { dirtySet: d } }),
  clearDirty: (path) => set(s => { const d = new Set(s.dirtySet); d.delete(path); return { dirtySet: d } })
}))
```

- [ ] **Step 2: Create `src/store/tabs.ts`**

```typescript
import { create } from 'zustand'

interface TabsState {
  openTabs: string[]
  activeFile: string | null
  openTab: (path: string) => void
  closeTab: (path: string) => void
  setActive: (path: string) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  openTabs: [],
  activeFile: null,

  openTab: (path) => set(s => ({
    openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
    activeFile: path
  })),

  closeTab: (path) => set(s => {
    const i = s.openTabs.indexOf(path)
    const next = s.openTabs.filter(t => t !== path)
    const active = path === s.activeFile ? (next[Math.max(0, i - 1)] ?? next[0] ?? null) : s.activeFile
    return { openTabs: next, activeFile: active }
  }),

  setActive: (path) => set({ activeFile: path })
}))
```

- [ ] **Step 3: Create `src/store/sessions.ts`**

```typescript
import { create } from 'zustand'
import type { Session, Message } from '@/types'

interface SessionsState {
  sessions: Session[]
  activeId: string
  addMessage: (msg: Message) => void
  appendDelta: (delta: string) => void
  addToolStep: (tool: string, label: string, target: string) => void
  completeToolStep: (tool: string, isError: boolean) => void
  finalizeReply: () => void
  newSession: () => void
  setActive: (id: string) => void
}

const INITIAL_SESSION: Session = {
  id: 's_new', title: '新会话', group: '进行中', time: '刚刚', messages: []
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [INITIAL_SESSION],
  activeId: 's_new',

  addMessage: (msg) => set(s => ({
    sessions: s.sessions.map(sess =>
      sess.id !== s.activeId ? sess : { ...sess, messages: [...sess.messages, msg] }
    )
  })),

  appendDelta: (delta) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== s.activeId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      const updated = { ...last, reply: [...last.reply.slice(0, -1), (last.reply[last.reply.length - 1] ?? '') + delta] }
      return { ...sess, messages: [...msgs.slice(0, -1), updated] }
    })
  })),

  addToolStep: (tool, label, target) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== s.activeId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      const step = { kind: tool as any, label, target }
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, steps: [...last.steps, step] }] }
    })
  })),

  completeToolStep: (_tool, isError) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== s.activeId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant' || !last.steps.length) return sess
      const steps = [...last.steps]
      steps[steps.length - 1] = { ...steps[steps.length - 1], isError }
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, steps }] }
    })
  })),

  finalizeReply: () => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== s.activeId) return sess
      const msgs = [...sess.messages]
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'assistant') return sess
      return { ...sess, messages: [...msgs.slice(0, -1), { ...last, typing: false }] }
    })
  })),

  newSession: () => {
    const id = 's_' + Date.now()
    const session: Session = { id, title: '新会话', group: '进行中', time: '刚刚', messages: [] }
    set(s => ({
      sessions: [session, ...s.sessions.map(sess => sess.group === '进行中' ? { ...sess, group: '今天' } : sess)],
      activeId: id
    }))
  },

  setActive: (id) => set({ activeId: id })
}))
```

- [ ] **Step 4: Create `src/store/changes.ts`**

```typescript
import { create } from 'zustand'
import type { PendingChange, StoryFile } from '@/types'
import { workspaceIpc } from '@/ipc/workspace'

interface ChangesState {
  changes: Map<string, PendingChange>
  addChange: (change: PendingChange) => void
  acceptChange: (fileId: string) => Promise<void>
  rejectChange: (fileId: string) => void
  acceptAll: () => Promise<void>
  rejectAll: () => void
}

export const useChangesStore = create<ChangesState>((set, get) => ({
  changes: new Map(),

  addChange: (change) => set(s => {
    const next = new Map(s.changes)
    next.set(change.fileId, change)
    return { changes: next }
  }),

  acceptChange: async (fileId) => {
    const change = get().changes.get(fileId)
    if (!change) return
    await workspaceIpc.writeFile(fileId, change.newContent)
    set(s => { const next = new Map(s.changes); next.delete(fileId); return { changes: next } })
  },

  rejectChange: (fileId) => set(s => {
    const next = new Map(s.changes); next.delete(fileId); return { changes: next }
  }),

  acceptAll: async () => {
    for (const fileId of get().changes.keys()) await get().acceptChange(fileId)
  },

  rejectAll: () => set({ changes: new Map() })
}))
```

- [ ] **Step 5: Create `src/store/ui.ts`**

```typescript
import { create } from 'zustand'
import type { AppView, LeftPanel, ThemeKey } from '@/types'

interface UiState {
  view: AppView
  theme: ThemeKey
  leftPanel: LeftPanel
  leftOpen: boolean
  rightOpen: boolean
  explorerWidth: number
  copilotWidth: number
  sessionsWidth: number
  changesWidth: number
  setView: (v: AppView) => void
  setTheme: (t: ThemeKey) => void
  setLeftPanel: (p: LeftPanel) => void
  toggleLeft: () => void
  toggleRight: () => void
  setExplorerWidth: (w: number) => void
  setCopilotWidth: (w: number) => void
  setSessionsWidth: (w: number) => void
  setChangesWidth: (w: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  view: 'editor', theme: 'dark', leftPanel: 'explorer',
  leftOpen: true, rightOpen: true,
  explorerWidth: 256, copilotWidth: 384, sessionsWidth: 256, changesWidth: 340,
  setView: (view) => set({ view }),
  setTheme: (theme) => { document.documentElement.setAttribute('data-theme', theme); set({ theme }) },
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
  setExplorerWidth: (explorerWidth) => set({ explorerWidth }),
  setCopilotWidth: (copilotWidth) => set({ copilotWidth }),
  setSessionsWidth: (sessionsWidth) => set({ sessionsWidth }),
  setChangesWidth: (changesWidth) => set({ changesWidth })
}))
```

- [ ] **Step 6: Create `src/store/index.ts`**

```typescript
export { useWorkspaceStore } from './workspace'
export { useTabsStore } from './tabs'
export { useSessionsStore } from './sessions'
export { useChangesStore } from './changes'
export { useUiStore } from './ui'
```

- [ ] **Step 7: Create `tests/store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useTabsStore } from '../src/store/tabs'
import { useUiStore } from '../src/store/ui'

describe('TabsStore', () => {
  beforeEach(() => useTabsStore.setState({ openTabs: [], activeFile: null }))

  it('opens a tab and sets active', () => {
    useTabsStore.getState().openTab('/path/ep01.ep')
    expect(useTabsStore.getState().openTabs).toContain('/path/ep01.ep')
    expect(useTabsStore.getState().activeFile).toBe('/path/ep01.ep')
  })

  it('deduplicates open tabs', () => {
    useTabsStore.getState().openTab('/path/ep01.ep')
    useTabsStore.getState().openTab('/path/ep01.ep')
    expect(useTabsStore.getState().openTabs).toHaveLength(1)
  })

  it('closes a tab and activates previous', () => {
    useTabsStore.getState().openTab('/a.ep')
    useTabsStore.getState().openTab('/b.ep')
    useTabsStore.getState().closeTab('/b.ep')
    expect(useTabsStore.getState().activeFile).toBe('/a.ep')
    expect(useTabsStore.getState().openTabs).toHaveLength(1)
  })
})

describe('UiStore', () => {
  it('toggles left panel', () => {
    const s = useUiStore.getState()
    const initial = s.leftOpen
    s.toggleLeft()
    expect(useUiStore.getState().leftOpen).toBe(!initial)
  })
})
```

- [ ] **Step 8: Run store tests**

```bash
npm run test -- tests/store.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/store/ tests/store.test.ts
git commit -m "feat: Zustand store slices (workspace, tabs, sessions, changes, ui)"
```

---

## Task 6: CSS theme system

**Files:**
- Create: `src/styles/globals.css`
- Create: `src/styles/theme.css`

- [ ] **Step 1: Create `src/styles/theme.css`** (直接从设计稿迁移)

```css
/* ============================================================
   StoryClaw — theme tokens
   ============================================================ */
:root {
  --accent:    #e0a458;
  --accent-ai: #8b7cf6;
  --c-ep:      #e0a458;
  --c-chr:     #d292b8;
  --c-otl:     #7aa6dd;
  --c-wld:     #6cb38f;
  --c-ref:     #888;
  --script-font: "Noto Serif SC", serif;
  --line-gap: 1.0;
}

html[data-theme="dark"] {
  --bg-0:        #0f1116;
  --bg-1:        #161922;
  --bg-2:        #1c2029;
  --bg-3:        #232834;
  --bg-editor:   #14171f;
  --paper:       #1a1e27;
  --border:      #262c38;
  --border-soft: #20242e;
  --text-0:      #e9e6df;
  --text-1:      #b7bdc9;
  --text-2:      #79808e;
  --text-3:      #555c69;
  --diff-add-bg: rgba(96,187,122,.14);
  --diff-add-fg: #7fcf97;
  --diff-del-bg: rgba(226,110,110,.13);
  --diff-del-fg: #e08a8a;
  --shadow:      0 12px 40px rgba(0,0,0,.45);
  --on-air:      #e2574f;
}

html[data-theme="light"] {
  --bg-0:        #ece8e1;
  --bg-1:        #f4f1ea;
  --bg-2:        #faf8f3;
  --bg-3:        #ece7dc;
  --bg-editor:   #e8e3d9;
  --paper:       #fbf9f4;
  --border:      #d9d2c4;
  --border-soft: #e2dccf;
  --text-0:      #23201a;
  --text-1:      #4e4a40;
  --text-2:      #847d6e;
  --text-3:      #a89f8c;
  --diff-add-bg: rgba(58,150,96,.16);
  --diff-add-fg: #2c7a4d;
  --diff-del-bg: rgba(190,70,70,.13);
  --diff-del-fg: #b14a4a;
  --shadow:      0 12px 40px rgba(60,50,30,.16);
  --on-air:      #d2483f;
  --c-chr:       #b56b95;
  --c-otl:       #4f7bb5;
  --c-wld:       #3f8a64;
}
```

- [ ] **Step 2: Create `src/styles/globals.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0; padding: 0; height: 100%;
  background: var(--bg-0); color: var(--text-0);
  font-family: "Noto Sans SC", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

#root { height: 100vh; display: flex; flex-direction: column; }

button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }

::selection { background: color-mix(in srgb, var(--accent) 35%, transparent); }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: var(--text-3); background-clip: padding-box; }

/* drag-resize */
.resizer { flex: none; width: 7px; margin: 0 -3px; cursor: col-resize; position: relative; z-index: 6; }
.resizer::after { content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px; background: transparent; transition: background .12s; }
.resizer:hover::after, .resizer.dragging::after { background: var(--accent); }
body.resizing { user-select: none; cursor: col-resize !important; }
```

- [ ] **Step 3: Update `src/main.tsx` to import styles in order**

The file already imports both. Verify the order is `globals.css` before `theme.css` (already correct in Task 1).

- [ ] **Step 4: Update `src/App.tsx` to apply theme from store**

```typescript
import { useEffect } from 'react'
import { useUiStore } from '@/store'

export default function App() {
  const theme = useUiStore(s => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div style={{ height: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 18 }}>StoryClaw — theme: {theme}</span>
    </div>
  )
}
```

- [ ] **Step 5: Verify `npm run dev` shows themed background**

```bash
npm run dev
```

Expected: Electron window with dark `#0f1116` background and warm text "StoryClaw — theme: dark".

- [ ] **Step 6: Commit**

```bash
git add src/styles/ src/App.tsx
git commit -m "feat: CSS theme system (dark/light tokens from design spec)"
```

---

## Final verification

- [ ] **Run all tests**

```bash
npm run test
```

Expected: 9 tests pass (5 serializer + 4 store).

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Final commit**

```bash
git add .
git commit -m "chore: Plan 1 complete — foundation ready for Plan 2"
```
