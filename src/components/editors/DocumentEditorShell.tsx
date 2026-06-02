import { useState } from 'react'
import type { ReactNode } from 'react'
import { Ic } from '@/components/icons'

export interface DocOutlineItem {
  key: string
  label: string
  indent: number       // 0 = primary (scene / H1), 1 = H2, 2 = H3
  parentKey?: string
  collapsible?: boolean
  onClick: () => void
}

interface Props {
  toolbar: ReactNode
  outlineItems?: DocOutlineItem[]
  statusLeft?: ReactNode
  children: ReactNode
}

const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150] as const
const LS_OUTLINE = 'storyclaw-outline-open'

function readOutlineOpen(): boolean {
  try {
    const v = localStorage.getItem(LS_OUTLINE)
    return v === null ? true : v === 'true'
  } catch { return true }
}

function writeOutlineOpen(v: boolean) {
  try { localStorage.setItem(LS_OUTLINE, String(v)) } catch {}
}

export function DocumentEditorShell({ toolbar, outlineItems, statusLeft, children }: Props) {
  // Persist open/closed state across file switches
  const [showOutline, setShowOutline] = useState(readOutlineOpen)
  const [zoom, setZoom] = useState(100)
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set())

  const hasOutline = outlineItems !== undefined

  const toggleOutline = () => {
    setShowOutline(prev => {
      const next = !prev
      writeOutlineOpen(next)
      return next
    })
  }

  const zoomOut = () => {
    const prev = [...ZOOM_STEPS].reverse().find(z => z < zoom)
    if (prev !== undefined) setZoom(prev)
  }
  const zoomIn = () => {
    const next = ZOOM_STEPS.find(z => z > zoom)
    if (next !== undefined) setZoom(next)
  }

  // Panel is always mounted (never conditionally rendered) to avoid
  // DOM add/remove causing editor flicker. Width collapses via CSS transition.
  const panelOpen = hasOutline && showOutline
  const visibleOutlineItems = (outlineItems ?? []).filter(item => !item.parentKey || !collapsedKeys.has(item.parentKey))

  const toggleItemCollapsed = (key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="doc-shell">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="doc-shell-toolbar">
        <div className="doc-shell-tools">{toolbar}</div>
        {hasOutline && (
          <button
            className={`doc-outline-toggle${showOutline ? ' on' : ''}`}
            onClick={toggleOutline}
            title={showOutline ? '隐藏大纲' : '显示大纲'}
          >
            <Ic.list width={14} height={14} />
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="doc-shell-body">
        {/* Outline panel — always in DOM, width-animates open/closed */}
        {hasOutline && (
          <nav className={`doc-outline-panel${panelOpen ? '' : ' collapsed'}`}>
            <div className="doc-outline-head">大纲</div>
            <div className="doc-outline-list">
              {visibleOutlineItems.map(item => (
                <button
                  key={item.key}
                  className="doc-outline-item"
                  style={{ paddingLeft: 12 + item.indent * 12 }}
                  onClick={() => item.onClick()}
                  title={item.label}
                >
                  {item.collapsible && (
                    <span
                      className={`doi-caret${collapsedKeys.has(item.key) ? ' collapsed' : ''}`}
                      onClick={event => {
                        event.stopPropagation()
                        toggleItemCollapsed(item.key)
                      }}
                    >
                      ▾
                    </span>
                  )}
                  {item.indent > 0 && <span className="doi-sub-mark" />}
                  <span className="doi-label">{item.label || '—'}</span>
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Canvas / scroll area */}
        <div className="doc-shell-canvas">
          <div
            className="doc-shell-canvas-inner"
            style={{ '--doc-zoom': zoom / 100 } as React.CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>

      {/* ── Status / zoom bar ───────────────────────────────── */}
      <div className="doc-shell-statusbar">
        <div className="doc-status-left">{statusLeft}</div>
        <div className="doc-zoom-row">
          <button className="doc-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]}>−</button>
          <span className="doc-zoom-val" onClick={() => setZoom(100)} title="点击重置为 100%">{zoom}%</span>
          <button className="doc-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</button>
        </div>
      </div>
    </div>
  )
}
