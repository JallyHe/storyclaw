import { useState, useEffect, useCallback, useRef } from 'react'
import { FILE_KIND, Ic } from '@/components/icons'
import { useWorkspaceStore, useTabsStore } from '@/store'
import { workspaceIpc, type FileSearchResult, type SearchOptions } from '@/ipc/workspace'

interface Props { width: number }

export function SearchPanel({ width }: Props) {
  const root = useWorkspaceStore(s => s.root)
  const refreshTree = useWorkspaceStore(s => s.refreshTree)
  const openTab = useTabsStore(s => s.openTab)

  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [opts, setOpts] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false })
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string, options: SearchOptions) => {
    if (!root || !q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await workspaceIpc.search(root, q, options)
      setResults(res)
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [root])

  // Debounced search on query / options change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(query, opts), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, opts, runSearch])

  const totalMatches = results.reduce((n, r) => n + r.matches.length, 0)

  const toggleOpt = (key: keyof SearchOptions) => setOpts(o => ({ ...o, [key]: !o[key] }))
  const toggleCollapse = (id: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const replaceFile = async (file: FileSearchResult) => {
    if (!query.trim()) return
    try {
      await workspaceIpc.replaceInFile(file.path, query, replacement, opts)
      await refreshTree()
      // re-run search to refresh results
      void runSearch(query, opts)
    } catch (err) {
      console.error('Replace failed:', err)
    }
  }

  const replaceAll = async () => {
    if (!query.trim() || results.length === 0) return
    try {
      for (const file of results) {
        await workspaceIpc.replaceInFile(file.path, query, replacement, opts)
      }
      await refreshTree()
      void runSearch(query, opts)
    } catch (err) {
      console.error('Replace all failed:', err)
    }
  }

  const renderLine = (lineText: string, column: number, length: number) => {
    const before = lineText.slice(Math.max(0, column - 30), column)
    const match = lineText.slice(column, column + length)
    const after = lineText.slice(column + length, column + length + 60)
    return (
      <>
        {column > 30 && <span className="sr-ellipsis">…</span>}
        <span className="sr-before">{before}</span>
        <span className="sr-hit">{match}</span>
        <span className="sr-after">{after}</span>
      </>
    )
  }

  return (
    <div className="sidebar search-panel" style={{ width, flexShrink: 0 }}>
      <div className="explorer-sub" style={{ paddingTop: 12 }}>
        <span>搜索</span>
        <div className="eh-actions">
          <button
            title={showReplace ? '隐藏替换' : '显示替换'}
            className={showReplace ? 'on' : ''}
            onClick={() => setShowReplace(v => !v)}
          >
            <Ic.chevR width={14} height={14} style={{ transform: showReplace ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        </div>
      </div>

      {/* Search + replace inputs */}
      <div className="search-fields">
        <div className="search-row">
          <div className="search-box">
            <input
              className="search-input"
              autoFocus
              placeholder="搜索"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="search-opts">
              <button title="区分大小写" className={opts.caseSensitive ? 'on' : ''} onClick={() => toggleOpt('caseSensitive')}>Aa</button>
              <button title="全字匹配" className={opts.wholeWord ? 'on' : ''} onClick={() => toggleOpt('wholeWord')}>ab</button>
              <button title="正则表达式" className={opts.regex ? 'on' : ''} onClick={() => toggleOpt('regex')}>.*</button>
            </div>
          </div>
        </div>

        {showReplace && (
          <div className="search-row">
            <div className="search-box">
              <input
                className="search-input"
                placeholder="替换"
                value={replacement}
                onChange={e => setReplacement(e.target.value)}
              />
            </div>
            <button
              className="replace-all-btn"
              title="全部替换"
              disabled={!query.trim() || results.length === 0}
              onClick={() => void replaceAll()}
            >
              全部替换
            </button>
          </div>
        )}
      </div>

      <div className="sb-scroll">
        {query.trim() && (
          <div className="search-count">
            {searching ? '搜索中…' : `${totalMatches} 个结果 · ${results.length} 个文件`}
          </div>
        )}

        {results.map(file => {
          const kind = FILE_KIND[file.ext] ?? { icon: Ic.fileScene, color: 'var(--text-2)' }
          const isCollapsed = collapsed.has(file.path)
          return (
            <div key={file.path} className="search-group">
              <div className="sg-file" onClick={() => toggleCollapse(file.path)}>
                <span className={`twisty${isCollapsed ? '' : ' open'}`}><Ic.chevRight width={12} height={12} /></span>
                <span className="file-ico" style={{ color: kind.color }}>
                  <kind.icon width={14} height={14} />
                </span>
                <span className="sg-name">{file.name}</span>
                <span className="sg-path" title={file.relPath}>{file.relPath.replace(/\/[^/]*$/, '')}</span>
                <span className="sg-n">{file.matches.length}</span>
                {showReplace && (
                  <button
                    className="sg-replace"
                    title="替换此文件"
                    onClick={e => { e.stopPropagation(); void replaceFile(file) }}
                  >
                    <Ic.refresh width={12} height={12} />
                  </button>
                )}
              </div>
              {!isCollapsed && file.matches.map((m, i) => (
                <div
                  key={i}
                  className="search-result"
                  title={`第 ${m.line} 行`}
                  onClick={() => openTab(file.path, {
                    line: m.line,
                    column: m.column,
                    length: m.length,
                    matchText: m.lineText.slice(m.column, m.column + m.length)
                  })}
                >
                  <span className="sr-line">{m.line}</span>
                  <span className="sr-text">{renderLine(m.lineText, m.column, m.length)}</span>
                </div>
              ))}
            </div>
          )
        })}

        {!query.trim() && (
          <div className="search-empty">输入关键词，在工作区全部文件中检索。</div>
        )}
        {query.trim() && !searching && results.length === 0 && (
          <div className="search-empty">未找到「{query}」。</div>
        )}
      </div>
    </div>
  )
}
