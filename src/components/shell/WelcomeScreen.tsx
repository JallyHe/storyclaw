import { useState, useEffect } from 'react'
import { Ic } from '@/components/icons'
import { useWorkspaceStore } from '@/store'
import { workspaceIpc } from '@/ipc/workspace'
import storyclawLogo from '@/assets/storyclaw-logo.png'

interface RecentProject {
  path: string
  name: string
  openedAt: number
}

const RECENTS_KEY = 'storyclaw:recentProjects'
const MAX_RECENTS = 8

export function getRecentProjects(): RecentProject[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentProject[]
  } catch { return [] }
}

export function addRecentProject(path: string) {
  const name = path.split(/[\\/]/).pop() ?? path
  const recents = getRecentProjects().filter(r => r.path !== path)
  const updated: RecentProject[] = [
    { path, name, openedAt: Date.now() },
    ...recents
  ].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

interface Props {
  onNewProject: () => void
}

export function WelcomeScreen({ onNewProject }: Props) {
  const { openWorkspace } = useWorkspaceStore()
  const [recents, setRecents] = useState<RecentProject[]>(getRecentProjects)

  useEffect(() => {
    setRecents(getRecentProjects())
  }, [])

  const handleOpen = async () => {
    const dir = await workspaceIpc.openDialog()
    if (dir) {
      addRecentProject(dir)
      setRecents(getRecentProjects())
      await openWorkspace(dir)
    }
  }

  const handleOpenRecent = async (path: string) => {
    addRecentProject(path)
    setRecents(getRecentProjects())
    await openWorkspace(path)
  }

  const handleNew = () => {
    onNewProject()
  }

  return (
    <div className="welcome">
      {/* Logo + title */}
      <div className="welcome-logo">
        <img src={storyclawLogo} alt="" />
      </div>
      <h1 className="welcome-title">StoryClaw</h1>
      <p className="welcome-sub">AI 驱动的剧本创作 IDE</p>

      {/* Action buttons */}
      <div className="welcome-actions">
        <button className="welcome-btn primary" onClick={handleNew}>
          <Ic.plus width={16} height={16} />
          新建项目
        </button>
        <button className="welcome-btn secondary" onClick={handleOpen}>
          <Ic.folder width={16} height={16} />
          打开文件夹
        </button>
      </div>

      {/* Recent projects */}
      <div className="welcome-recents">
        <div className="wr-label">最近打开</div>
        {recents.length === 0 ? (
          <div className="wr-empty">暂无最近项目</div>
        ) : (
          <div className="wr-list">
            {recents.map(r => (
              <div key={r.path} className="wr-item" onClick={() => handleOpenRecent(r.path)}>
                <div className="wr-item-ico">
                  <Ic.film width={18} height={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wr-item-name">《{r.name}》</div>
                  <div className="wr-item-path">{r.path}</div>
                </div>
                <span className="wr-item-time">{timeAgo(r.openedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
