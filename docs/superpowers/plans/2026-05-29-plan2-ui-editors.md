# StoryClaw Plan 2 — UI Shell & Editors

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete editor-mode UI — App shell, Activity Bar, file explorer, tab bar, breadcrumb, resize handles, and all five file editors (EpisodeEditor, CharacterEditor, OutlineEditor, WorldEditor, RefViewer) — wired to the Zustand store and IPC layer from Plan 1.

**Architecture:** React component tree split by responsibility; each editor is a self-contained component under `src/components/editors/`; the shell (Titlebar, ActivityBar, Explorer, TabBar) lives in dedicated folders; CSS uses the custom-property theme from Plan 1.

**Prerequisite:** Plan 1 must be complete (`npm run test` passes, `npm run dev` opens window).

**Tech Stack:** React 18 + TypeScript, Zustand (from Plan 1), CSS custom properties, @testing-library/react, vitest

---

## File Map

```
src/
├── components/
│   ├── shell/
│   │   ├── ResizeHandle.tsx      # drag-to-resize between panels
│   │   ├── Titlebar.tsx          # macOS dots · title · view switch · icons
│   │   ├── ActivityBar.tsx       # left icon strip (explorer/search/scm)
│   │   └── shell.css
│   ├── explorer/
│   │   ├── Explorer.tsx          # file tree (recursive TreeNode render)
│   │   ├── FileIcon.tsx          # color-coded icon by ext
│   │   └── explorer.css
│   ├── tabs/
│   │   ├── TabBar.tsx            # open tabs + dirty dot + close
│   │   ├── Breadcrumb.tsx        # path segments from workspace root
│   │   └── tabs.css
│   └── editors/
│       ├── FileEditor.tsx        # router: ext → component
│       ├── episode/
│       │   ├── EpisodeEditor.tsx # toolbar + SceneNav + ScreenplayBody
│       │   ├── SceneNav.tsx      # left scene-outline navigator
│       │   ├── Block.tsx         # single screenplay block renderer
│       │   ├── DiffBar.tsx       # accept/reject bar shown when change pending
│       │   └── episode.css
│       ├── character/
│       │   ├── CharacterEditor.tsx
│       │   └── character.css
│       ├── outline/
│       │   ├── OutlineEditor.tsx
│       │   └── outline.css
│       ├── world/
│       │   ├── WorldEditor.tsx
│       │   └── world.css
│       └── reference/
│           ├── RefViewer.tsx
│           └── reference.css
├── App.tsx                        # updated: full editor-mode layout
└── app.css                        # app-level layout rules
tests/
├── editors.test.tsx
└── explorer.test.tsx
```

---

## Task 7: App shell layout + ResizeHandle

**Files:**
- Create: `src/app.css`
- Create: `src/components/shell/shell.css`
- Create: `src/components/shell/ResizeHandle.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/app.css`**

```css
.app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.editor-area { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--bg-editor); }
.agent-view  { flex: 1; display: flex; min-height: 0; overflow: hidden; }
```

- [ ] **Step 2: Create `src/components/shell/ResizeHandle.tsx`**

```tsx
import { useCallback } from 'react'

interface Props {
  width: number
  setWidth: (w: number) => void
  edge: 'left' | 'right'
  min?: number
  max?: number
}

export function ResizeHandle({ width, setWidth, edge, min = 200, max = 560 }: Props) {
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = width
    document.body.classList.add('resizing')

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const w = edge === 'left' ? startW - dx : startW + dx
      setWidth(Math.max(min, Math.min(max, Math.round(w))))
    }
    const onUp = () => {
      document.body.classList.remove('resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [width, setWidth, edge, min, max])

  return <div className={`resizer ${edge}`} onPointerDown={onPointerDown} />
}
```

- [ ] **Step 3: Create `src/components/shell/shell.css`**

```css
/* ── Titlebar ─────────────────────────────────────────────── */
.titlebar {
  height: 44px; flex: none; -webkit-app-region: drag;
  display: flex; align-items: center; gap: 14px; padding: 0 14px;
  background: var(--bg-1); border-bottom: 1px solid var(--border); font-size: 13px;
}
.tb-dots { display: flex; gap: 7px; -webkit-app-region: no-drag; }
.tb-dots i { width: 12px; height: 12px; border-radius: 50%; display: block; }
.tb-title { display: flex; align-items: baseline; gap: 9px; color: var(--text-1); }
.tb-title b { color: var(--text-0); font-weight: 600; }
.tb-title .sep { color: var(--text-3); }
.tb-spacer { flex: 1; }
.viewseg { display: flex; background: var(--bg-2); border: 1px solid var(--border); border-radius: 9px; padding: 3px; gap: 2px; -webkit-app-region: no-drag; }
.viewseg button { font-size: 12px; padding: 5px 13px; border-radius: 6px; color: var(--text-2); display: flex; align-items: center; gap: 6px; font-weight: 500; transition: all .15s; }
.viewseg button.on { background: var(--bg-0); color: var(--text-0); box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.viewseg button:hover:not(.on) { color: var(--text-1); }
.tb-icon { width: 30px; height: 30px; border-radius: 7px; display: grid; place-items: center; color: var(--text-2); transition: all .15s; -webkit-app-region: no-drag; }
.tb-icon:hover { background: var(--bg-3); color: var(--text-0); }
.tb-icon.on { color: var(--accent); }
.tb-vsep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; flex: none; }

/* ── Activity Bar ─────────────────────────────────────────── */
.activitybar { width: 48px; flex: none; background: var(--bg-0); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding-top: 8px; gap: 3px; }
.ab-btn { width: 40px; height: 42px; border-radius: 9px; display: grid; place-items: center; color: var(--text-3); position: relative; transition: color .15s; }
.ab-btn:hover { color: var(--text-1); }
.ab-btn.on { color: var(--text-0); }
.ab-btn.on::before { content: ""; position: absolute; left: -4px; top: 9px; bottom: 9px; width: 2px; border-radius: 2px; background: var(--accent); }
.ab-badge { position: absolute; top: 3px; right: 3px; min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px; background: var(--accent); color: #1a1205; font-size: 9.5px; font-weight: 700; display: grid; place-items: center; }
```

- [ ] **Step 4: Create `src/components/shell/Titlebar.tsx`**

```tsx
import './shell.css'
import { useUiStore } from '@/store'

export function Titlebar() {
  const { view, setView, theme, setTheme, toggleLeft, toggleRight, leftOpen, rightOpen } = useUiStore()

  return (
    <div className="titlebar">
      <div className="tb-dots">
        <i style={{ background: '#e0605a' }} />
        <i style={{ background: '#e0b34f' }} />
        <i style={{ background: '#6cc06c' }} />
      </div>
      <div className="tb-title">
        <b>StoryClaw</b>
      </div>
      <div className="tb-spacer" />
      <div className="viewseg">
        <button className={view === 'editor' ? 'on' : ''} onClick={() => setView('editor')}>编辑器</button>
        <button className={view === 'agent'  ? 'on' : ''} onClick={() => setView('agent')}>Agent</button>
      </div>
      <button className="tb-icon" title="切换主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <span className="tb-vsep" />
      <button className={`tb-icon${leftOpen  ? ' on' : ''}`} title="左侧栏" onClick={toggleLeft}>⬛</button>
      <button className={`tb-icon${rightOpen ? ' on' : ''}`} title="右侧栏" onClick={toggleRight}>⬛</button>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/shell/ActivityBar.tsx`**

```tsx
import { useUiStore } from '@/store'
import { useChangesStore } from '@/store'

export function ActivityBar() {
  const { leftPanel, setLeftPanel, leftOpen, toggleLeft } = useUiStore()
  const changesCount = useChangesStore(s => s.changes.size)

  const select = (id: typeof leftPanel) => {
    if (leftPanel === id && leftOpen) toggleLeft()
    else { if (!leftOpen) toggleLeft(); setLeftPanel(id) }
  }

  return (
    <div className="activitybar">
      <button className={`ab-btn${leftPanel === 'explorer' && leftOpen ? ' on' : ''}`} onClick={() => select('explorer')} title="文件树">📁</button>
      <button className={`ab-btn${leftPanel === 'search'   && leftOpen ? ' on' : ''}`} onClick={() => select('search')}   title="搜索">🔍</button>
      <button className={`ab-btn${leftPanel === 'scm'      && leftOpen ? ' on' : ''}`} onClick={() => select('scm')}      title="变更">
        {changesCount > 0 && <span className="ab-badge">{changesCount}</span>}
        📝
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Update `src/App.tsx` with full shell layout**

```tsx
import { useEffect } from 'react'
import { useUiStore } from '@/store'
import { Titlebar } from '@/components/shell/Titlebar'
import { ActivityBar } from '@/components/shell/ActivityBar'
import { ResizeHandle } from '@/components/shell/ResizeHandle'
import '@/app.css'

export default function App() {
  const { theme, view, leftOpen, rightOpen, explorerWidth, setExplorerWidth, copilotWidth, setCopilotWidth } = useUiStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="app">
      <Titlebar />
      <div className="app-body">
        {view === 'editor' && (
          <>
            <ActivityBar />
            {leftOpen && (
              <>
                <div style={{ width: explorerWidth, flexShrink: 0, background: 'var(--bg-1)', borderRight: '1px solid var(--border)' }}>
                  {/* Explorer — Task 8 */}
                  <div style={{ padding: 12, color: 'var(--text-2)', fontSize: 12 }}>EXPLORER (Task 8)</div>
                </div>
                <ResizeHandle width={explorerWidth} setWidth={setExplorerWidth} edge="right" min={200} max={420} />
              </>
            )}
            <div className="editor-area">
              {/* TabBar + editors — Tasks 9–17 */}
              <div style={{ padding: 20, color: 'var(--text-1)' }}>Editor area (Tasks 9–17)</div>
            </div>
            {rightOpen && (
              <>
                <ResizeHandle width={copilotWidth} setWidth={setCopilotWidth} edge="left" min={320} max={560} />
                <div style={{ width: copilotWidth, flexShrink: 0, background: 'var(--bg-1)', borderLeft: '1px solid var(--border)' }}>
                  {/* Copilot — Plan 3 */}
                  <div style={{ padding: 12, color: 'var(--text-2)', fontSize: 12 }}>COPILOT (Plan 3)</div>
                </div>
              </>
            )}
          </>
        )}
        {view === 'agent' && (
          <div className="agent-view">
            <div style={{ padding: 20, color: 'var(--text-1)' }}>Agent view (Plan 3)</div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify layout in dev**

```bash
npm run dev
```

Expected: IDE shell with titlebar (dots + view switch), activity bar icons on left, editor placeholder in center, Copilot placeholder on right. Drag resize handle should change panel widths.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/ src/App.tsx src/app.css
git commit -m "feat: app shell — Titlebar, ActivityBar, ResizeHandle, layout"
```

---

## Task 8: File Explorer

**Files:**
- Create: `src/components/explorer/FileIcon.tsx`
- Create: `src/components/explorer/Explorer.tsx`
- Create: `src/components/explorer/explorer.css`
- Create: `tests/explorer.test.tsx`

- [ ] **Step 1: Create `src/components/explorer/FileIcon.tsx`**

```tsx
import type { FileExt } from '@/types'

const EXT_COLOR: Record<string, string> = {
  ep: 'var(--c-ep)', chr: 'var(--c-chr)', otl: 'var(--c-otl)', wld: 'var(--c-wld)'
}

export function FileIcon({ ext }: { ext: FileExt }) {
  const color = EXT_COLOR[ext] ?? 'var(--c-ref)'
  return <span style={{ color, fontSize: 12, fontWeight: 700, minWidth: 28, display: 'inline-block' }}>.{ext}</span>
}
```

- [ ] **Step 2: Create `src/components/explorer/explorer.css`**

```css
.explorer { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-1); border-right: 1px solid var(--border); overflow: hidden; }
.explorer-header { padding: 10px 14px 6px; font-size: 11px; font-weight: 600; color: var(--text-3); letter-spacing: .06em; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between; }
.explorer-scroll { flex: 1; overflow-y: auto; padding-bottom: 16px; }
.tree-folder { user-select: none; }
.tree-folder-row { display: flex; align-items: center; gap: 6px; padding: 4px 14px; font-size: 13px; color: var(--text-1); cursor: pointer; }
.tree-folder-row:hover { background: var(--bg-3); }
.tree-folder-arrow { font-size: 10px; color: var(--text-3); width: 12px; }
.tree-children { padding-left: 14px; }
.tree-file { display: flex; align-items: center; gap: 6px; padding: 3px 14px; font-size: 13px; color: var(--text-1); cursor: pointer; border-radius: 0; }
.tree-file:hover { background: var(--bg-3); }
.tree-file.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--text-0); }
.tree-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--bg-3); color: var(--text-3); flex-shrink: 0; }
.explorer-empty { padding: 24px 14px; font-size: 13px; color: var(--text-3); line-height: 1.7; }
.explorer-open-btn { margin: 12px 14px 0; padding: 8px 14px; background: var(--bg-3); border-radius: 8px; font-size: 13px; color: var(--text-1); width: calc(100% - 28px); text-align: left; border: 1px solid var(--border); }
.explorer-open-btn:hover { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--text-0); }
```

- [ ] **Step 3: Create `src/components/explorer/Explorer.tsx`**

```tsx
import { useState, useCallback } from 'react'
import type { TreeNode, FileNode, FolderNode } from '@/types'
import { FileIcon } from './FileIcon'
import { useWorkspaceStore } from '@/store'
import { useTabsStore } from '@/store'
import { workspaceIpc } from '@/ipc/workspace'
import './explorer.css'

function FolderRow({ node, depth, expanded, toggle }: { node: FolderNode; depth: number; expanded: Set<string>; toggle: (id: string) => void }) {
  const open = expanded.has(node.id)
  return (
    <div className="tree-folder">
      <div className="tree-folder-row" style={{ paddingLeft: 14 + depth * 14 }} onClick={() => toggle(node.id)}>
        <span className="tree-folder-arrow">{open ? '▾' : '▸'}</span>
        <span>📂</span>
        <span>{node.name}</span>
      </div>
      {open && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({ node, depth }: { node: FileNode; depth: number }) {
  const activeFile = useTabsStore(s => s.activeFile)
  const { openTab } = useTabsStore()
  const isActive = activeFile === node.id

  return (
    <div className={`tree-file${isActive ? ' active' : ''}`} style={{ paddingLeft: 14 + depth * 14 }} onClick={() => openTab(node.id)}>
      <FileIcon ext={node.ext} />
      <span className="tree-file-name">{node.name}</span>
      {node.badge && <span className="tree-badge">{node.badge}</span>}
    </div>
  )
}

function TreeItem({ node, depth, expanded, toggle }: { node: TreeNode; depth: number; expanded: Set<string>; toggle: (id: string) => void }) {
  if (node.kind === 'folder') return <FolderRow node={node} depth={depth} expanded={expanded} toggle={toggle} />
  return <FileRow node={node} depth={depth} />
}

export function Explorer({ width }: { width: number }) {
  const { tree, root, openWorkspace } = useWorkspaceStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleOpen = async () => {
    const dir = await workspaceIpc.openDialog()
    if (dir) {
      await openWorkspace(dir)
      setExpanded(new Set())
    }
  }

  return (
    <div className="explorer" style={{ width }}>
      <div className="explorer-header">
        <span>{root ? root.split(/[\\/]/).pop() : '工作区'}</span>
      </div>
      {!root ? (
        <div className="explorer-empty">
          <p>尚未打开工作区</p>
          <button className="explorer-open-btn" onClick={handleOpen}>打开文件夹…</button>
        </div>
      ) : (
        <div className="explorer-scroll">
          {tree.map(node => (
            <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `tests/explorer.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileIcon } from '../src/components/explorer/FileIcon'

describe('FileIcon', () => {
  it('renders .ep extension', () => {
    render(<FileIcon ext="ep" />)
    expect(screen.getByText('.ep')).toBeInTheDocument()
  })

  it('renders .chr extension', () => {
    render(<FileIcon ext="chr" />)
    expect(screen.getByText('.chr')).toBeInTheDocument()
  })

  it('renders unknown extension with ref color', () => {
    const { container } = render(<FileIcon ext="pdf" />)
    expect(container.firstChild).toHaveStyle('color: var(--c-ref)')
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- tests/explorer.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Wire Explorer into App.tsx**

In `src/App.tsx`, replace the explorer placeholder div:

```tsx
// Replace:
<div style={{ width: explorerWidth, flexShrink: 0, background: 'var(--bg-1)', borderRight: '1px solid var(--border)' }}>
  {/* Explorer — Task 8 */}
  <div style={{ padding: 12, color: 'var(--text-2)', fontSize: 12 }}>EXPLORER (Task 8)</div>
</div>

// With:
<Explorer width={explorerWidth} />
```

Add import at top: `import { Explorer } from '@/components/explorer/Explorer'`

- [ ] **Step 7: Commit**

```bash
git add src/components/explorer/ tests/explorer.test.tsx src/App.tsx
git commit -m "feat: file explorer with recursive tree, file icons, open workspace"
```

---

## Task 9: Tab Bar + Breadcrumb

**Files:**
- Create: `src/components/tabs/tabs.css`
- Create: `src/components/tabs/TabBar.tsx`
- Create: `src/components/tabs/Breadcrumb.tsx`

- [ ] **Step 1: Create `src/components/tabs/tabs.css`**

```css
.tabbar { display: flex; align-items: center; height: 36px; background: var(--bg-1); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
.tabbar::-webkit-scrollbar { height: 0; }
.tab { display: flex; align-items: center; gap: 8px; padding: 0 14px; height: 100%; font-size: 13px; color: var(--text-2); white-space: nowrap; cursor: pointer; border-right: 1px solid var(--border); transition: color .12s; flex-shrink: 0; position: relative; }
.tab:hover { color: var(--text-1); background: var(--bg-3); }
.tab.active { color: var(--text-0); background: var(--bg-editor); }
.tab.active::after { content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: var(--accent); }
.tab-dirty { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.tab-close { width: 18px; height: 18px; border-radius: 4px; display: grid; place-items: center; font-size: 12px; color: var(--text-3); opacity: 0; transition: opacity .1s; }
.tab:hover .tab-close, .tab.active .tab-close { opacity: 1; }
.tab-close:hover { background: var(--bg-3); color: var(--text-0); }

.breadcrumb { height: 26px; display: flex; align-items: center; padding: 0 14px; gap: 4px; font-size: 12px; color: var(--text-2); border-bottom: 1px solid var(--border-soft); flex-shrink: 0; overflow: hidden; }
.breadcrumb-seg { color: var(--text-3); }
.breadcrumb-seg:last-child { color: var(--text-1); }
.breadcrumb-sep { color: var(--text-3); margin: 0 2px; }
```

- [ ] **Step 2: Create `src/components/tabs/TabBar.tsx`**

```tsx
import { useTabsStore } from '@/store'
import { useWorkspaceStore } from '@/store'
import { useChangesStore } from '@/store'
import { FileIcon } from '@/components/explorer/FileIcon'
import path from 'path-browserify'
import './tabs.css'

export function TabBar() {
  const { openTabs, activeFile, setActive, closeTab } = useTabsStore()
  const { dirtySet } = useWorkspaceStore()
  const { changes } = useChangesStore()

  return (
    <div className="tabbar">
      {openTabs.map(filePath => {
        const ext = filePath.split('.').pop() ?? ''
        const name = path.basename(filePath, '.' + ext)
        const isDirty = dirtySet.has(filePath) || changes.has(filePath)

        return (
          <div key={filePath} className={`tab${filePath === activeFile ? ' active' : ''}`} onClick={() => setActive(filePath)}>
            <FileIcon ext={ext} />
            <span>{name}</span>
            {isDirty
              ? <span className="tab-dirty" title="未保存" />
              : (
                <button className="tab-close" onClick={e => { e.stopPropagation(); closeTab(filePath) }} title="关闭">×</button>
              )
            }
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/tabs/Breadcrumb.tsx`**

```tsx
import { useTabsStore } from '@/store'
import { useWorkspaceStore } from '@/store'
import './tabs.css'

export function Breadcrumb() {
  const { activeFile } = useTabsStore()
  const { root } = useWorkspaceStore()

  if (!activeFile || !root) return <div className="breadcrumb" />

  const relative = activeFile.startsWith(root) ? activeFile.slice(root.length).replace(/^[\\/]/, '') : activeFile
  const parts = relative.split(/[\\/]/)

  return (
    <div className="breadcrumb">
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          <span className={`breadcrumb-seg${i === parts.length - 1 ? ' last' : ''}`}>{part}</span>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add `path-browserify` for renderer**

```bash
npm install path-browserify
npm install --save-dev @types/path-browserify
```

Then in `electron.vite.config.ts`, add to renderer config:
```typescript
resolve: {
  alias: {
    '@': resolve('src'),
    'path': 'path-browserify'   // add this line
  }
}
```

- [ ] **Step 5: Wire TabBar + Breadcrumb into App.tsx editor-area**

```tsx
// In App.tsx, replace editor-area div content:
<div className="editor-area">
  <TabBar />
  <Breadcrumb />
  <div style={{ flex: 1, overflow: 'auto', padding: 20, color: 'var(--text-1)' }}>
    {/* FileEditor — Task 17 */}
    FileEditor (Task 17)
  </div>
</div>
```

Add imports: `import { TabBar } from '@/components/tabs/TabBar'` and `import { Breadcrumb } from '@/components/tabs/Breadcrumb'`

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/ src/App.tsx electron.vite.config.ts package.json package-lock.json
git commit -m "feat: TabBar and Breadcrumb components"
```

---

## Task 10: Episode editor — Block renderer + DiffBar

**Files:**
- Create: `src/components/editors/episode/episode.css`
- Create: `src/components/editors/episode/Block.tsx`
- Create: `src/components/editors/episode/DiffBar.tsx`

- [ ] **Step 1: Create `src/components/editors/episode/episode.css`**

```css
.episode-editor { display: flex; height: 100%; min-height: 0; overflow: hidden; }

/* scene navigator */
.scene-nav { width: 220px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--bg-1); }
.snav-head { padding: 10px 12px 6px; font-size: 11px; font-weight: 600; color: var(--text-3); letter-spacing: .06em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
.snav-count { background: var(--bg-3); border-radius: 6px; padding: 1px 6px; font-size: 10px; color: var(--text-2); }
.snav-list { flex: 1; overflow-y: auto; }
.snav-item { padding: 7px 12px; cursor: pointer; border-left: 2px solid transparent; transition: all .12s; }
.snav-item:hover { background: var(--bg-3); }
.snav-item.on { background: color-mix(in srgb, var(--accent) 12%, transparent); border-left-color: var(--accent); }
.snav-row1 { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; }
.snav-no { font-weight: 700; color: var(--accent); font-size: 11px; }
.snav-ie { font-size: 11px; color: var(--text-3); background: var(--bg-3); padding: 1px 5px; border-radius: 4px; }
.snav-loc { color: var(--text-1); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snav-draft { font-size: 10px; color: var(--diff-del-fg); background: var(--diff-del-bg); padding: 1px 5px; border-radius: 4px; }

/* screenplay canvas */
.screenplay-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.screenplay-toolbar { height: 36px; padding: 0 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-soft); font-size: 12px; color: var(--text-2); flex-shrink: 0; }
.screenplay-scroll { flex: 1; overflow-y: auto; padding: 32px 0 64px; display: flex; justify-content: center; }
.page { width: min(780px, 100%); padding: 0 48px; }

/* blocks */
.blk { display: flex; align-items: flex-start; gap: 0; margin: 0; line-height: calc(var(--line-gap) * 1.75); font-family: var(--script-font); font-size: 14.5px; }
.blk-gutter { width: 48px; flex-shrink: 0; font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; padding-top: 3px; user-select: none; }
.blk-scene { padding: 12px 0 6px; font-weight: 700; color: var(--text-0); font-family: "Noto Sans SC", sans-serif; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; border-bottom: 1px solid var(--border-soft); margin-bottom: 4px; }
.blk-scene .sc-no { color: var(--accent); margin-right: 8px; }
.blk-scene .sc-ie { color: var(--text-3); margin-right: 8px; }
.blk-scene .sc-time { color: var(--text-3); margin-left: 10px; }
.blk-character { padding-top: 10px; font-weight: 700; color: var(--text-0); letter-spacing: .06em; text-transform: uppercase; font-size: 13.5px; }
.blk-character .ext { font-weight: 400; font-size: 12px; color: var(--text-2); text-transform: none; margin-left: 6px; }
.blk-action { color: var(--text-1); padding: 2px 0; }
.blk-dialogue { color: var(--text-0); padding-left: 80px; padding-right: 80px; }
.blk-paren { color: var(--text-2); font-style: italic; padding-left: 50px; }
[contenteditable]:focus { outline: none; }

/* diff */
.diff-add { background: var(--diff-add-bg); border-radius: 3px; }
.diff-del { background: var(--diff-del-bg); text-decoration: line-through; color: var(--diff-del-fg); opacity: .8; pointer-events: none; user-select: none; }

/* diff bar */
.diff-bar { display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: color-mix(in srgb, var(--accent) 10%, var(--bg-1)); border-bottom: 1px solid var(--border); font-size: 12.5px; flex-shrink: 0; }
.diff-bar-label { flex: 1; color: var(--text-1); }
.diff-bar-label b { color: var(--accent); }
.btn-accept { padding: 4px 14px; border-radius: 6px; background: var(--accent); color: #1a1205; font-weight: 600; font-size: 12px; }
.btn-reject { padding: 4px 14px; border-radius: 6px; background: var(--bg-3); color: var(--text-1); font-size: 12px; }
.btn-reject:hover { background: var(--diff-del-bg); color: var(--diff-del-fg); }
```

- [ ] **Step 2: Create `src/components/editors/episode/Block.tsx`**

```tsx
import { useCallback } from 'react'
import type { Block as BlockType, DiffStatus } from '@/types'

interface Props {
  blk: BlockType
  diff: DiffStatus
  onEdit?: (id: string, text: string) => void
}

export function Block({ blk, diff, onEdit }: Props) {
  const cls = diff === 'add' ? 'diff-add' : diff === 'del' ? 'diff-del' : ''
  const editable = !diff && !!onEdit && (blk.type === 'action' || blk.type === 'dialogue' || blk.type === 'paren')

  const commit = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (onEdit) onEdit(blk.id, e.currentTarget.innerText)
  }, [blk.id, onEdit])

  if (blk.type === 'scene') {
    return (
      <div className={`blk blk-scene ${cls}`} data-head={blk.id}>
        <span className="blk-gutter">场头</span>
        <span className="sc-no">{blk.number}</span>
        <span className="sc-ie">{blk.intext}</span>
        <span>{blk.location}</span>
        <span className="sc-time">{blk.time}</span>
      </div>
    )
  }
  if (blk.type === 'character') {
    return (
      <div className={`blk blk-character ${cls}`}>
        <span className="blk-gutter">人物</span>
        {blk.name}
        {blk.ext && <span className="ext">（{blk.ext}）</span>}
      </div>
    )
  }
  const label = { action: '动作', dialogue: '对白', paren: '潜台词' }[blk.type] ?? ''
  const klass = { action: 'blk-action', dialogue: 'blk-dialogue', paren: 'blk-paren' }[blk.type] ?? ''

  return (
    <div
      className={`blk ${klass} ${cls}`}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={editable ? commit : undefined}
    >
      <span className="blk-gutter" contentEditable={false}>{label}</span>
      {'text' in blk ? blk.text : ''}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/editors/episode/DiffBar.tsx`**

```tsx
interface Props {
  fileId: string
  onAccept: () => void
  onReject: () => void
}

export function DiffBar({ onAccept, onReject }: Props) {
  return (
    <div className="diff-bar">
      <span className="diff-bar-label"><b>AI 改动</b> — 审阅后接受或拒绝</span>
      <button className="btn-accept" onClick={onAccept}>✓ 接受</button>
      <button className="btn-reject" onClick={onReject}>✕ 拒绝</button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editors/episode/
git commit -m "feat: screenplay Block renderer and DiffBar"
```

---

## Task 11: SceneNav + EpisodeEditor assembly

**Files:**
- Create: `src/components/editors/episode/SceneNav.tsx`
- Create: `src/components/editors/episode/EpisodeEditor.tsx`

- [ ] **Step 1: Create `src/components/editors/episode/SceneNav.tsx`**

```tsx
import type { EpFile } from '@/types'

interface Segment {
  headId: string
  number: string
  intext: string
  location: string
  hasDraft: boolean
}

function getSegments(file: EpFile): Segment[] {
  return file.blocks
    .filter(b => b.type === 'scene')
    .map(b => {
      if (b.type !== 'scene') return null!
      const idx = file.blocks.indexOf(b)
      const following = file.blocks.slice(idx + 1)
      const next = following.findIndex(x => x.type === 'scene')
      const between = next >= 0 ? following.slice(0, next) : following
      const hasDraft = between.some(x => 'text' in x && x.text.includes('待'))
      return { headId: b.id, number: b.number, intext: b.intext, location: b.location, hasDraft }
    })
    .filter(Boolean)
}

interface Props {
  file: EpFile
  activeId: string | null
  onPick: (headId: string) => void
}

export function SceneNav({ file, activeId, onPick }: Props) {
  const segs = getSegments(file)
  return (
    <div className="scene-nav">
      <div className="snav-head">场景大纲 <span className="snav-count">{segs.length}</span></div>
      <div className="snav-list">
        {segs.map(s => (
          <div key={s.headId} className={`snav-item${s.headId === activeId ? ' on' : ''}`} onClick={() => onPick(s.headId)}>
            <div className="snav-row1">
              <span className="snav-no">{s.number}</span>
              <span className="snav-ie">{s.intext}</span>
              <span className="snav-loc">{s.location}</span>
              {s.hasDraft && <span className="snav-draft">待写</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/editors/episode/EpisodeEditor.tsx`**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import type { EpFile, DiffBlock } from '@/types'
import { SceneNav } from './SceneNav'
import { Block } from './Block'
import { DiffBar } from './DiffBar'
import { useWorkspaceStore } from '@/store'
import './episode.css'

interface Props {
  filePath: string
  file: EpFile
  diffBlocks?: DiffBlock[]
  onAccept: () => void
  onReject: () => void
}

export function EpisodeEditor({ filePath, file, diffBlocks, onAccept, onReject }: Props) {
  const { saveFile, markDirty } = useWorkspaceStore()
  const [navOpen, setNavOpen] = useState(true)
  const [focusedScene, setFocusedScene] = useState<string | null>(
    file.blocks.find(b => b.type === 'scene')?.id ?? null
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  // jump to scene in nav
  const jumpTo = useCallback((headId: string) => {
    setFocusedScene(headId)
    const el = scrollRef.current?.querySelector(`[data-head="${headId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // jump when diff appears
  useEffect(() => {
    if (diffBlocks && scrollRef.current) {
      const el = scrollRef.current.querySelector('.diff-add, .diff-del')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [diffBlocks])

  const onEdit = useCallback(async (blockId: string, text: string) => {
    const updated: EpFile = {
      ...file,
      blocks: file.blocks.map(b => b.id === blockId ? { ...b, text } as any : b)
    }
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [file, filePath, saveFile, markDirty])

  const rows = diffBlocks ?? file.blocks.map(b => ({ blk: b, diff: null as null }))

  return (
    <div className="episode-editor">
      {navOpen && <SceneNav file={file} activeId={focusedScene} onPick={jumpTo} />}
      <div className="screenplay-wrap">
        {diffBlocks && <DiffBar fileId={filePath} onAccept={onAccept} onReject={onReject} />}
        <div className="screenplay-toolbar">
          <button onClick={() => setNavOpen(o => !o)} style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {navOpen ? '◀ 隐藏大纲' : '▶ 场景大纲'}
          </button>
          <span style={{ flex: 1 }} />
          <span>{file.episode} · {file.title}</span>
        </div>
        <div className="screenplay-scroll" ref={scrollRef}>
          <div className="page">
            {'blk' in rows[0]
              ? (rows as DiffBlock[]).map((item, i) => <Block key={item.blk.id + i} blk={item.blk} diff={item.diff} onEdit={!diffBlocks ? onEdit : undefined} />)
              : (rows as EpFile['blocks']).map(b => <Block key={b.id} blk={b} diff={null} onEdit={onEdit} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editors/episode/
git commit -m "feat: EpisodeEditor with SceneNav and diff display"
```

---

## Task 12: Character / Outline / World editors + RefViewer

**Files:**
- Create: `src/components/editors/character/CharacterEditor.tsx`
- Create: `src/components/editors/character/character.css`
- Create: `src/components/editors/outline/OutlineEditor.tsx`
- Create: `src/components/editors/outline/outline.css`
- Create: `src/components/editors/world/WorldEditor.tsx`
- Create: `src/components/editors/world/world.css`
- Create: `src/components/editors/reference/RefViewer.tsx`
- Create: `src/components/editors/reference/reference.css`

- [ ] **Step 1: Create character editor CSS + component**

`src/components/editors/character/character.css`:
```css
.chr-editor { padding: 32px 48px; max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.chr-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
.chr-color-dot { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.chr-name { font-size: 22px; font-weight: 700; color: var(--text-0); }
.chr-role-badge { font-size: 12px; padding: 3px 10px; border-radius: 6px; background: var(--bg-3); color: var(--text-2); }
.chr-field { display: flex; flex-direction: column; gap: 6px; }
.chr-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; }
.chr-input, .chr-textarea { background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text-0); font-family: inherit; font-size: 13.5px; outline: none; resize: vertical; }
.chr-input:focus, .chr-textarea:focus { border-color: var(--accent); }
.chr-textarea { min-height: 72px; line-height: 1.65; }
.chr-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.chr-tag { padding: 3px 10px; border-radius: 6px; font-size: 12px; background: var(--bg-3); color: var(--text-1); }
```

`src/components/editors/character/CharacterEditor.tsx`:
```tsx
import { useState, useCallback } from 'react'
import type { ChrFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import './character.css'

interface Props { filePath: string; file: ChrFile }

export function CharacterEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const { saveFile, markDirty } = useWorkspaceStore()

  const update = useCallback(async (patch: Partial<ChrFile>) => {
    const updated = { ...data, ...patch }
    setData(updated)
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [data, filePath, saveFile, markDirty])

  return (
    <div className="chr-editor">
      <div className="chr-header">
        <div className="chr-color-dot" style={{ background: data.color }} />
        <div className="chr-name">{data.name}</div>
        <div className="chr-role-badge">{data.role}</div>
      </div>
      <div className="chr-field">
        <label className="chr-label">简介</label>
        <input className="chr-input" value={data.tagline} onChange={e => update({ tagline: e.target.value })} placeholder="一句话描述这个角色…" />
      </div>
      <div className="chr-field">
        <label className="chr-label">性格标签</label>
        <div className="chr-tags">{data.traits.map((t, i) => <span key={i} className="chr-tag">{t}</span>)}</div>
      </div>
      <div className="chr-field">
        <label className="chr-label">角色弧光</label>
        <textarea className="chr-textarea" value={data.arc} onChange={e => update({ arc: e.target.value })} placeholder="这个角色的成长轨迹…" />
      </div>
      <div className="chr-field">
        <label className="chr-label">说话方式</label>
        <textarea className="chr-textarea" value={data.voice} onChange={e => update({ voice: e.target.value })} placeholder="语气、节奏、口头禅…" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create outline editor CSS + component**

`src/components/editors/outline/outline.css`:
```css
.otl-editor { padding: 32px 48px; max-width: 780px; margin: 0 auto; }
.otl-logline { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; }
.otl-logline-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.otl-logline input { width: 100%; background: none; border: none; color: var(--text-0); font-size: 14px; font-family: var(--script-font); outline: none; }
.otl-act { margin-bottom: 24px; }
.otl-act-head { font-size: 13px; font-weight: 700; color: var(--c-otl); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border-soft); }
.otl-beat { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; }
.otl-beat-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); margin-top: 7px; flex-shrink: 0; }
.otl-beat input { flex: 1; background: none; border: none; border-bottom: 1px solid transparent; color: var(--text-1); font-family: var(--script-font); font-size: 14px; padding: 2px 0; outline: none; }
.otl-beat input:focus { border-bottom-color: var(--accent); color: var(--text-0); }
```

`src/components/editors/outline/OutlineEditor.tsx`:
```tsx
import { useState, useCallback } from 'react'
import type { OtlFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import './outline.css'

interface Props { filePath: string; file: OtlFile }

export function OutlineEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const { saveFile, markDirty } = useWorkspaceStore()

  const save = useCallback(async (updated: OtlFile) => {
    setData(updated)
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [filePath, saveFile, markDirty])

  return (
    <div className="otl-editor">
      <div className="otl-logline">
        <div className="otl-logline-label">核心梗概</div>
        <input value={data.logline} onChange={e => save({ ...data, logline: e.target.value })} placeholder="一句话说清楚这个故事…" />
      </div>
      {data.acts.map((act, ai) => (
        <div key={act.id} className="otl-act">
          <div className="otl-act-head">{act.act}</div>
          {act.beats.map((beat, bi) => (
            <div key={bi} className="otl-beat">
              <div className="otl-beat-dot" />
              <input value={beat} onChange={e => {
                const acts = data.acts.map((a, i) => i !== ai ? a : { ...a, beats: a.beats.map((b, j) => j !== bi ? b : e.target.value) })
                save({ ...data, acts })
              }} placeholder="情节点…" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create world editor CSS + component**

`src/components/editors/world/world.css`:
```css
.wld-editor { padding: 32px 48px; max-width: 780px; margin: 0 auto; }
.wld-title-input { width: 100%; background: none; border: none; border-bottom: 2px solid var(--border); color: var(--text-0); font-size: 20px; font-weight: 700; padding: 0 0 8px; margin-bottom: 20px; outline: none; font-family: inherit; }
.wld-title-input:focus { border-bottom-color: var(--c-wld); }
.wld-body-input { width: 100%; min-height: 320px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; color: var(--text-1); font-family: var(--script-font); font-size: 14.5px; line-height: 1.8; resize: vertical; outline: none; }
.wld-body-input:focus { border-color: var(--c-wld); }
```

`src/components/editors/world/WorldEditor.tsx`:
```tsx
import { useState, useCallback } from 'react'
import type { WldFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import './world.css'

interface Props { filePath: string; file: WldFile }

export function WorldEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const { saveFile, markDirty } = useWorkspaceStore()

  const save = useCallback(async (patch: Partial<WldFile>) => {
    const updated = { ...data, ...patch }
    setData(updated)
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [data, filePath, saveFile, markDirty])

  return (
    <div className="wld-editor">
      <input className="wld-title-input" value={data.title} onChange={e => save({ title: e.target.value })} placeholder="设定标题…" />
      <textarea className="wld-body-input" value={data.body} onChange={e => save({ body: e.target.value })} placeholder="描述这条世界观设定…" />
    </div>
  )
}
```

- [ ] **Step 4: Create reference viewer CSS + component**

`src/components/editors/reference/reference.css`:
```css
.ref-viewer { padding: 24px 48px; max-width: 780px; margin: 0 auto; }
.ref-header { font-size: 12px; color: var(--text-3); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); }
.ref-body { color: var(--text-1); font-size: 14px; line-height: 1.85; font-family: var(--script-font); white-space: pre-wrap; word-break: break-word; }
.ref-loading { color: var(--text-3); padding: 32px; text-align: center; }
```

`src/components/editors/reference/RefViewer.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { workspaceIpc } from '@/ipc/workspace'
import './reference.css'

interface Props { filePath: string }

export function RefViewer({ filePath }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  useEffect(() => {
    setLoading(true)
    workspaceIpc.readText(filePath)
      .then(t => { setText(t); setLoading(false) })
      .catch(() => { setText('无法读取文件内容。'); setLoading(false) })
  }, [filePath])

  return (
    <div className="ref-viewer">
      <div className="ref-header">📎 {fileName} · 只读参考</div>
      {loading
        ? <div className="ref-loading">加载中…</div>
        : <pre className="ref-body">{text}</pre>
      }
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/editors/
git commit -m "feat: CharacterEditor, OutlineEditor, WorldEditor, RefViewer"
```

---

## Task 13: FileEditor router + wire into App

**Files:**
- Create: `src/components/editors/FileEditor.tsx`
- Create: `tests/editors.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/editors/FileEditor.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { StoryFile, EpFile, ChrFile, OtlFile, WldFile } from '@/types'
import { useWorkspaceStore } from '@/store'
import { useChangesStore } from '@/store'
import { EpisodeEditor } from './episode/EpisodeEditor'
import { CharacterEditor } from './character/CharacterEditor'
import { OutlineEditor } from './outline/OutlineEditor'
import { WorldEditor } from './world/WorldEditor'
import { RefViewer } from './reference/RefViewer'

interface Props { filePath: string | null }

const REF_EXTS = new Set(['txt', 'md', 'pdf', 'docx'])

export function FileEditor({ filePath }: Props) {
  const { getFile } = useWorkspaceStore()
  const { changes, acceptChange, rejectChange } = useChangesStore()
  const [file, setFile] = useState<StoryFile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filePath) return
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    if (REF_EXTS.has(ext)) return
    setLoading(true)
    getFile(filePath).then(f => { setFile(f); setLoading(false) })
  }, [filePath, getFile])

  if (!filePath) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>打开文件开始编辑</div>

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (REF_EXTS.has(ext)) return <div style={{ flex: 1, overflow: 'auto' }}><RefViewer filePath={filePath} /></div>
  if (loading || !file) return <div style={{ padding: 32, color: 'var(--text-3)' }}>加载中…</div>

  const change = changes.get(filePath)
  const scrollWrap = { flex: 1, overflow: 'auto' }

  switch (ext) {
    case 'ep':
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <EpisodeEditor
            filePath={filePath}
            file={file as EpFile}
            diffBlocks={change?.diffBlocks}
            onAccept={() => acceptChange(filePath)}
            onReject={() => rejectChange(filePath)}
          />
        </div>
      )
    case 'chr': return <div style={scrollWrap}><CharacterEditor filePath={filePath} file={file as ChrFile} /></div>
    case 'otl': return <div style={scrollWrap}><OutlineEditor   filePath={filePath} file={file as OtlFile} /></div>
    case 'wld': return <div style={scrollWrap}><WorldEditor     filePath={filePath} file={file as WldFile} /></div>
    default:    return <div style={{ padding: 32, color: 'var(--text-3)' }}>不支持的文件类型：.{ext}</div>
  }
}
```

- [ ] **Step 2: Create `tests/editors.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Block } from '../src/components/editors/episode/Block'
import type { SceneBlock, ActionBlock } from '../src/types'

describe('Block', () => {
  it('renders scene block with location', () => {
    const blk: SceneBlock = { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '' }
    render(<Block blk={blk} diff={null} />)
    expect(screen.getByText('电台')).toBeInTheDocument()
    expect(screen.getByText('场头')).toBeInTheDocument()
  })

  it('renders action block with text', () => {
    const blk: ActionBlock = { id: 'b2', type: 'action', text: '灯亮了。' }
    render(<Block blk={blk} diff={null} />)
    expect(screen.getByText('灯亮了。')).toBeInTheDocument()
  })

  it('applies diff-add class', () => {
    const blk: ActionBlock = { id: 'b3', type: 'action', text: '新内容' }
    const { container } = render(<Block blk={blk} diff="add" />)
    expect(container.firstChild).toHaveClass('diff-add')
  })

  it('applies diff-del class', () => {
    const blk: ActionBlock = { id: 'b4', type: 'action', text: '旧内容' }
    const { container } = render(<Block blk={blk} diff="del" />)
    expect(container.firstChild).toHaveClass('diff-del')
  })
})
```

- [ ] **Step 3: Run editor tests**

```bash
npm run test -- tests/editors.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 4: Wire FileEditor into App.tsx**

In `src/App.tsx`, replace the editor-area placeholder:

```tsx
// Replace the editor-area content with:
<div className="editor-area">
  <TabBar />
  <Breadcrumb />
  <FileEditor filePath={activeFile} />
</div>
```

Where `activeFile` comes from: `const activeFile = useTabsStore(s => s.activeFile)`

Add imports:
```tsx
import { useTabsStore } from '@/store'
import { FileEditor } from '@/components/editors/FileEditor'
```

- [ ] **Step 5: Final run**

```bash
npm run dev
```

Expected: full editor mode — open a workspace folder via the explorer, click any `.ep`/`.chr`/`.otl`/`.wld` file to see its editor; tabs and breadcrumb update; panel resize works.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: 16 tests pass (9 from Plan 1 + 3 explorer + 4 editor).

- [ ] **Step 7: Final commit**

```bash
git add src/components/ src/App.tsx tests/
git commit -m "feat: FileEditor router — all editors wired, Plan 2 complete"
```
