import { useState, useCallback, useEffect, useRef, type MouseEvent, type KeyboardEvent, type DragEvent } from 'react'
import type { TreeNode, FileNode, FolderNode } from '@/types'
import { FILE_KIND, Ic } from '@/components/icons'
import { useWorkspaceStore, useTabsStore, useChangesStore } from '@/store'
import { workspaceIpc } from '@/ipc/workspace'

function statusClass(badge?: string) {
  if (!badge) return 'todo'
  if (badge === '已完成') return 'done'
  if (badge === '写作中') return 'wip'
  return 'todo'
}

const NODE_MIME = 'application/x-storyclaw-node'
const PREFETCH_EXTS = new Set(['ep', 'chr', 'wld', 'cfg'])

function EditableFileRow({ node, depth, isEditing, editValue, onChange, onConfirm, onCancel, activeFile, onOpen, changedSet, onContext, onNodeDragStart, selectedNodeId, onSelect }: {
  node: FileNode; depth: number; isEditing: boolean; editValue: string; onChange: (val: string) => void
  onConfirm: () => void; onCancel: () => void; activeFile: string | null
  onOpen: (id: string) => void | Promise<void>; changedSet: Set<string>; onContext: (event: MouseEvent, node: TreeNode) => void
  onNodeDragStart: (event: DragEvent, node: TreeNode) => void
  selectedNodeId?: string | null; onSelect: (node: TreeNode) => void
}) {
  const kind = FILE_KIND[node.ext] ?? { icon: Ic.fileScene, color: 'var(--accent)' }
  const isActive = activeFile === node.id
  const changed = changedSet.has(node.id)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="tree-row file-row editing" style={{ paddingLeft: 10 + depth * 15 }}>
        <span className="file-ico" style={{ color: kind.color }}>
          <kind.icon width={15} height={15} />
        </span>
        <input
          ref={inputRef}
          className="editable-input"
          value={editValue}
          onChange={e => onChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            e.stopPropagation()
            if (e.key === 'Enter') onConfirm()
            else if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => onConfirm()}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <div
      className={`tree-row file-row${isActive ? ' on' : ''}${selectedNodeId === node.id ? ' selected' : ''}`}
      style={{ paddingLeft: 10 + depth * 15 }}
      draggable
      onDragStart={event => onNodeDragStart(event, node)}
      onClick={() => { onSelect(node); onOpen(node.id) }}
      onContextMenu={event => onContext(event, node)}
      title={`${node.name}.${node.ext}`}
    >
      <span className="file-ico" style={{ color: kind.color }}>
        <kind.icon width={15} height={15} />
      </span>
      <span className="label">
        {node.name}<span className="file-ext">.{node.ext}</span>
      </span>
      {node.badge && <span className={`ep-badge st-${statusClass(node.badge)}`}>{node.badge}</span>}
      {changed && <span className="dirty-dot" title="有未确认的 AI 修改" />}
    </div>
  )
}

function EditableFolderRow({ node, depth, expanded, toggle, isEditing, editValue, onChange, onConfirm, onCancel, activeFile, onOpen, changedSet, onContext, editingNodeId, onNodeDragStart, onDropToFolder, dragOverId, setDragOverId, selectedNodeId, onSelect }: {
  node: FolderNode; depth: number; expanded: Set<string>; toggle: (id: string) => void
  isEditing: boolean; editValue: string; onChange: (val: string) => void; onConfirm: () => void; onCancel: () => void
  activeFile: string | null; onOpen: (id: string) => void | Promise<void>; changedSet: Set<string>; onContext: (event: MouseEvent, node: TreeNode) => void; editingNodeId: string | null
  onNodeDragStart: (event: DragEvent, node: TreeNode) => void
  onDropToFolder: (event: DragEvent, folderId: string) => void
  dragOverId: string | null; setDragOverId: (id: string | null) => void
  selectedNodeId?: string | null; onSelect: (node: TreeNode) => void
}) {
  const open = expanded.has(node.id)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="tree-row folder-row editing" style={{ paddingLeft: 8 + depth * 15 }}>
        <span className={`twisty${open ? ' open' : ''}`} style={{ visibility: 'hidden' }}>
          <Ic.chevRight width={13} height={13} />
        </span>
        <span className="folder-ico">
          <Ic.folder width={15} height={15} />
        </span>
        <input
          ref={inputRef}
          className="editable-input"
          value={editValue}
          onChange={e => onChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            e.stopPropagation()
            if (e.key === 'Enter') onConfirm()
            else if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => onConfirm()}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <>
      <div
        className={`tree-row folder-row${dragOverId === node.id ? ' drag-over' : ''}${selectedNodeId === node.id ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 15 }}
        draggable
        onDragStart={event => onNodeDragStart(event, node)}
        onDragOver={event => { event.preventDefault(); event.stopPropagation(); setDragOverId(node.id) }}
        onDragLeave={event => { event.stopPropagation(); if (dragOverId === node.id) setDragOverId(null) }}
        onDrop={event => onDropToFolder(event, node.id)}
        onClick={() => { onSelect(node); toggle(node.id) }}
        onContextMenu={event => onContext(event, node)}
      >
        <span className={`twisty${open ? ' open' : ''}`}>
          <Ic.chevRight width={13} height={13} />
        </span>
        <span className="folder-ico">
          {open
            ? <Ic.folderOpen width={15} height={15} />
            : <Ic.folder width={15} height={15} />
          }
        </span>
        <span className="label">{node.name}</span>
        {node.badge && <span className={`ep-badge st-${statusClass(node.badge)}`}>{node.badge}</span>}
      </div>
      {open && node.children.map(c => {
        const isEditingChild = editingNodeId === c.id
        return c.kind === 'folder'
          ? <EditableFolderRow key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} isEditing={isEditingChild} editValue={isEditingChild ? editValue : ""} onChange={onChange} onConfirm={onConfirm} onCancel={onCancel} activeFile={activeFile} onOpen={onOpen} changedSet={changedSet} onContext={onContext} editingNodeId={editingNodeId} onNodeDragStart={onNodeDragStart} onDropToFolder={onDropToFolder} dragOverId={dragOverId} setDragOverId={setDragOverId} selectedNodeId={selectedNodeId} onSelect={onSelect} />
          : <EditableFileRow key={c.id} node={c} depth={depth + 1} isEditing={isEditingChild} editValue={isEditingChild ? editValue : ""} onChange={onChange} onConfirm={onConfirm} onCancel={onCancel} activeFile={activeFile} onOpen={onOpen} changedSet={changedSet} onContext={onContext} onNodeDragStart={onNodeDragStart} selectedNodeId={selectedNodeId} onSelect={onSelect} />
      })}
    </>
  )
}

export function Explorer({ width }: { width: number }) {
  const { tree, root, openWorkspace, createFolder, createFile, renameItem, deleteItem, setEditing, updateEditingValue, commitEditing, cancelEditing, copyToClipboard, cutToClipboard, pasteFromClipboard, moveNode, importExternalFiles, refreshTree, getFile, editingNodeId, editingValue, clipboard, cutSourceId } = useWorkspaceStore()
  const activeFile = useTabsStore(s => s.activeFile)
  const openTabs = useTabsStore(s => s.openTabs)
  const openTab = useTabsStore(s => s.openTab)
  const closeTab = useTabsStore(s => s.closeTab)
  const renameTab = useTabsStore(s => s.renameTab)
  const changes = useChangesStore(s => s.changes)
  const changedSet = new Set(changes.keys())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode | null } | null>(null)
  const [newSubOpen, setNewSubOpen] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [rootDragOver, setRootDragOver] = useState(false)
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  const toggle = useCallback((id: string) => {
    if (id === '__collapseAll') { setExpanded(new Set()); return }
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  const handleOpen = async () => {
    const dir = await workspaceIpc.openDialog()
    if (dir) { await openWorkspace(dir); setExpanded(new Set()) }
  }

  useEffect(() => {
    if (!menu) return
    const close = () => { setMenu(null); setNewSubOpen(false) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  useEffect(() => {
    const clear = () => { setDragOverId(null); setRootDragOver(false) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  // Auto-refresh the tree when files change on disk (AI writes, external edits…).
  // Debounced so a burst of fs events triggers a single refresh.
  useEffect(() => {
    if (!root) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const stop = workspaceIpc.onWatch(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void refreshTree() }, 200)
    })
    return () => {
      if (timer) clearTimeout(timer)
      stop()
    }
  }, [root, refreshTree])

  const handleContext = (event: MouseEvent, node: TreeNode) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedNode(node)
    setMenu({ x: event.clientX, y: event.clientY, node })
  }

  const openFile = useCallback(async (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    if (PREFETCH_EXTS.has(ext)) {
      await getFile(path).catch(() => {})
    }
    openTab(path)
  }, [getFile, openTab])

  const parentDirFor = (node: TreeNode | null) => {
    if (!root) return ''
    if (!node) return root
    return node.kind === 'folder' ? node.id : dirname(node.id)
  }

  const requestNewFile = async (parentDir = root, fileName = '新建文本.txt') => {
    if (!parentDir) return
    try {
      const created = await createFile(parentDir, fileName)
      if (created) {
        setEditing(created, 'create-file', fileName)
      }
    } catch (err) {
      console.error('Failed to create file:', err)
    }
  }

  const requestNewFolder = async (parentDir = root) => {
    if (!parentDir) return
    try {
      const created = await createFolder(parentDir, '新建文件夹')
      if (created) {
        setEditing(created, 'create-folder', '新建文件夹')
        setExpanded(prev => new Set(prev).add(created))
      }
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }

  const requestRename = (node: TreeNode) => {
    const currentName = node.kind === 'file' ? `${node.name}.${node.ext}` : node.name
    setEditing(node.id, 'rename', currentName)
  }

  const requestDelete = async (node: TreeNode) => {
    try {
      await deleteItem(node.id)
      if (node.kind === 'file') closeTab(node.id)
      if (node.kind === 'folder') {
        openTabs.filter(path => path.startsWith(`${node.id}\\`) || path.startsWith(`${node.id}/`)).forEach(closeTab)
      }
    } catch (err: any) {
      console.error('Delete failed:', err?.message ?? '删除失败')
    }
  }

  const handleCopy = (node: TreeNode) => {
    copyToClipboard([node])
    void workspaceIpc.writeClipboardFilePaths([node.id], 'copy').catch(err => console.error('Write clipboard failed:', err))
  }

  const handleCut = (node: TreeNode) => {
    cutToClipboard([node])
    void workspaceIpc.writeClipboardFilePaths([node.id], 'cut').catch(err => console.error('Write clipboard failed:', err))
  }

  const handlePaste = async (targetDir: string) => {
    try {
      const systemPaths = await workspaceIpc.readClipboardFilePaths().catch(() => [])
      const isInternalCut = clipboard && cutSourceId && samePathList(systemPaths, clipboard.map(node => node.id))
      if (systemPaths.length > 0 && !isInternalCut) {
        await importExternalFiles(systemPaths, targetDir)
        setExpanded(prev => new Set(prev).add(targetDir))
        return
      }
      if (clipboard) await pasteFromClipboard(targetDir)
    } catch (err) {
      console.error('Paste failed:', err)
    }
  }

  const targetDirForSelection = () => {
    if (!root) return ''
    if (!selectedNode) return root
    return selectedNode.kind === 'folder' ? selectedNode.id : dirname(selectedNode.id)
  }

  const handleExplorerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editingNodeId) return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === 'c' && selectedNode) {
      event.preventDefault()
      handleCopy(selectedNode)
    } else if (key === 'x' && selectedNode) {
      event.preventDefault()
      handleCut(selectedNode)
    } else if (key === 'v') {
      event.preventDefault()
      void handlePaste(targetDirForSelection())
    }
  }

  const handleImportScreenplay = async (targetDir: string) => {
    if (!root) return
    try {
      const imported = await workspaceIpc.importScreenplays(root, targetDir)
      await refreshTree()
      setExpanded(prev => new Set(prev).add(targetDir))
      if (imported[0]) openTab(imported[0].absPath)
    } catch (err) {
      console.error('Import screenplay failed:', err)
    }
  }

  const handleCopyPath = (node: TreeNode) => {
    try {
      workspaceIpc.copyPathToClipboard(node.id)
    } catch (err) {
      console.error('Copy path failed:', err)
    }
  }

  const handleRevealInExplorer = (node: TreeNode) => {
    try {
      workspaceIpc.revealInExplorer(node.id)
    } catch (err) {
      console.error('Reveal in explorer failed:', err)
    }
  }

  const deleteLabel = (node: TreeNode) => {
    const name = node.kind === 'file' ? `${node.name}.${node.ext}` : node.name
    const kind = node.kind === 'folder' ? '文件夹' : '文件'
    return `${kind}"${name}"`
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleNodeDragStart = (event: DragEvent, node: TreeNode) => {
    event.stopPropagation()
    event.dataTransfer.setData(NODE_MIME, node.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  // Extract absolute disk paths from an external file drop
  const externalPaths = (event: DragEvent): string[] => {
    const files = Array.from(event.dataTransfer.files ?? [])
    return files
      .map(f => { try { return workspaceIpc.getPathForFile(f) } catch { return '' } })
      .filter(Boolean)
  }

  const dropInto = async (event: DragEvent, targetDir: string) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverId(null)
    setRootDragOver(false)

    // Case 1: external files dragged from the OS
    const paths = externalPaths(event)
    if (paths.length > 0) {
      await importExternalFiles(paths, targetDir)
      return
    }

    // Case 2: internal node move
    const sourceId = event.dataTransfer.getData(NODE_MIME)
    if (sourceId) {
      const moved = await moveNode(sourceId, targetDir)
      if (moved) {
        // keep the destination folder expanded so the moved item is visible
        setExpanded(prev => new Set(prev).add(targetDir))
      }
    }
  }

  const handleDropToFolder = (event: DragEvent, folderId: string) => {
    void dropInto(event, folderId)
  }

  const projectName = root ? root.split(/[\\/]/).pop() ?? '' : ''

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map(n => {
      const isEditing = editingNodeId === n.id
      if (n.kind === 'folder') {
        return (
          <EditableFolderRow
            key={n.id}
            node={n}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            isEditing={isEditing}
            editValue={editingValue}
            onChange={updateEditingValue}
            onConfirm={commitEditing}
            onCancel={cancelEditing}
            activeFile={activeFile}
            onOpen={openFile}
            changedSet={changedSet}
            onContext={handleContext}
            editingNodeId={editingNodeId}
            onNodeDragStart={handleNodeDragStart}
            onDropToFolder={handleDropToFolder}
            dragOverId={dragOverId}
            setDragOverId={setDragOverId}
            selectedNodeId={selectedNode?.id}
            onSelect={setSelectedNode}
          />
        )
      } else {
        return (
          <EditableFileRow
            key={n.id}
            node={n}
            depth={0}
            isEditing={isEditing}
            editValue={editingValue}
            onChange={updateEditingValue}
            onConfirm={commitEditing}
            onCancel={cancelEditing}
            activeFile={activeFile}
            onOpen={openFile}
            changedSet={changedSet}
            onContext={handleContext}
            onNodeDragStart={handleNodeDragStart}
            selectedNodeId={selectedNode?.id}
            onSelect={setSelectedNode}
          />
        )
      }
    })
  }

  return (
    <div className="sidebar explorer" style={{ width, flexShrink: 0 }}>
      <div className="explorer-head">
        <span className="eh-title">
          <Ic.book width={14} height={14} />
          {root ? `《${projectName}》` : 'StoryClaw'}
        </span>
        {root && <span className="eh-meta">剧本项目</span>}
      </div>
      <div className="explorer-sub">
        <span>资源管理器</span>
        <div className="eh-actions">
          <button title="新建文本" disabled={!root} onClick={() => requestNewFile()}><Ic.filePlus width={14} height={14} /></button>
          <button title="新建文件夹" disabled={!root} onClick={() => requestNewFolder()}><Ic.folderPlus width={14} height={14} /></button>
          <button title="刷新" disabled={!root} onClick={() => void refreshTree()}><Ic.refresh width={14} height={14} /></button>
          <button title="折叠全部" disabled={!root} onClick={() => toggle('__collapseAll')}><Ic.collapseAll width={14} height={14} /></button>
        </div>
      </div>
      {!root ? (
        <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 12px' }}>尚未打开工作区</p>
          <button
            onClick={handleOpen}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'var(--bg-3)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            打开文件夹…
          </button>
        </div>
      ) : (
        <div
          role="tree"
          tabIndex={0}
          className={`sb-scroll tree${rootDragOver && !dragOverId ? ' drag-over-root' : ''}`}
          onKeyDown={handleExplorerKeyDown}
          onContextMenu={event => {
            event.preventDefault()
            setMenu({ x: event.clientX, y: event.clientY, node: null })
          }}
          onDragOver={event => {
            // Only treat as root drop if not over a folder row (which stops propagation)
            event.preventDefault()
            setRootDragOver(true)
          }}
          onDragLeave={event => {
            // Reset when leaving the scroll container itself
            if (event.currentTarget === event.target) setRootDragOver(false)
          }}
          onDrop={event => { if (root) void dropInto(event, root) }}
        >
          {renderTree(tree)}
        </div>
      )}
      {root && menu && (
        <div className="tree-menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
          <div
            className="menu-item has-sub"
            onMouseEnter={() => setNewSubOpen(true)}
            onMouseLeave={() => setNewSubOpen(false)}
          >
            <span className="mi-lbl">新建</span>
            <span className="mi-arrow">▸</span>
            {newSubOpen && (
              <div className="tree-submenu">
                <button onClick={() => { requestNewFile(parentDirFor(menu.node), '新建分集大纲.md'); setMenu(null) }}>分集大纲 (.md)</button>
                <button onClick={() => { requestNewFile(parentDirFor(menu.node), '新建剧本.ep'); setMenu(null) }}>剧本 (.ep)</button>
                <button onClick={() => { requestNewFile(parentDirFor(menu.node), '新建人物.chr'); setMenu(null) }}>人物 (.chr)</button>
                <button onClick={() => { requestNewFile(parentDirFor(menu.node), '新建文本.txt'); setMenu(null) }}>文本 (.txt)</button>
                <button onClick={() => { requestNewFolder(parentDirFor(menu.node)); setMenu(null) }}>新建文件夹</button>
              </div>
            )}
          </div>
          {menu.node && <button onClick={() => { handleCopy(menu.node!); setMenu(null) }}>复制</button>}
          {menu.node && <button onClick={() => { handleCut(menu.node!); setMenu(null) }}>剪切</button>}
          <button onClick={() => { handlePaste(parentDirFor(menu.node)); setMenu(null) }}>粘贴</button>
          <button onClick={() => { handleImportScreenplay(parentDirFor(menu.node)); setMenu(null) }}>导入剧本…</button>
          {menu.node && <button onClick={() => { handleCopyPath(menu.node!); setMenu(null) }}>复制路径</button>}
          {menu.node && <button onClick={() => { handleRevealInExplorer(menu.node!); setMenu(null) }}>在资源管理器中打开</button>}
          {menu.node && <button onClick={() => { requestRename(menu.node!); setMenu(null) }}>重命名</button>}
          {menu.node && <button className="danger" onClick={() => { requestDelete(menu.node!); setMenu(null) }}>删除</button>}
        </div>
      )}
    </div>
  )
}

function dirname(path: string) {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return index > 0 ? path.slice(0, index) : path
}

function samePathList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const normalize = (value: string) => value.replace(/\\/g, '/').toLowerCase()
  const left = a.map(normalize).sort()
  const right = b.map(normalize).sort()
  return left.every((value, index) => value === right[index])
}
