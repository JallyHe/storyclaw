import { useCallback, useEffect, useState } from 'react'
import { Ic } from '@/components/icons'
import { serverConnectionIpc, type ConnectionState } from '@/ipc/serverConnection'

const STORYCLAW_SERVER_URL = import.meta.env.DEV ? 'http://localhost:3030' : 'https://api.storyclaw.com'

function avatarText(state: ConnectionState): string {
  const base = state.email || state.serverUrl || '未'
  return base.trim().slice(0, 1).toUpperCase()
}

function formatCredits(balance: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: Number.isInteger(balance) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(balance)
}

export function AccountSettingsPanel() {
  const [state, setState] = useState<ConnectionState | null>(null)
  const [waiting, setWaiting] = useState(false)

  const loadState = useCallback(async () => {
    const next = await serverConnectionIpc.getState().catch(() => null)
    setState(next)
  }, [])

  useEffect(() => {
    void loadState()
    return serverConnectionIpc.onConnected(async () => {
      setWaiting(false)
      await loadState()
    })
  }, [loadState])

  const handleLogin = () => {
    setWaiting(true)
    void serverConnectionIpc.openAuthBrowser(STORYCLAW_SERVER_URL)
  }

  const handleDisconnect = async () => {
    await serverConnectionIpc.disconnect()
    setState(null)
  }

  return (
    <div className="account-panel">
      <div className="set-section-head account-head">
        <div>
          <h2>账户管理</h2>
          <p className="set-section-desc">登录后可同步服务端模型，并查看账户积分。</p>
        </div>
      </div>

      {state?.token ? (
        <>
          <div className="account-profile">
            <div className="account-avatar">{avatarText(state)}</div>
            <div className="account-profile-copy">
              <div className="account-name">{state.email || '已登录账户'}</div>
              <div className="account-sub">{state.serverUrl}</div>
            </div>
          </div>

          <button className="set-btn ghost account-logout" onClick={() => void handleDisconnect()}>
            退出登录
          </button>

          <div className="account-plan-card">
            <div className="account-plan-head">
              <div className="account-plan-title">体验版</div>
              <button className="account-upgrade">升级</button>
            </div>
            <div className="account-plan-body">
              <div className="account-credit-label">
                <Ic.spark width={22} height={22} />
                <span>积分余额</span>
              </div>
              <div className="account-credit-value">{formatCredits(state.balance)}</div>
            </div>
            <div className="account-plan-meta">
              <span>已加载 {state.modelCount} 个模型</span>
              {state.expiresAt && <span>到期：{new Date(state.expiresAt * 1000).toLocaleDateString()}</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="account-empty">
          <div className="account-empty-icon"><Ic.user width={28} height={28} /></div>
          <div>
            <div className="account-empty-title">未登录</div>
            <div className="account-empty-desc">登录 StoryClaw 服务后，可自动加载模型并查看积分余额。</div>
          </div>
          <div className="account-login-row">
            <button className="set-btn primary" onClick={handleLogin} disabled={waiting}>
              {waiting ? '等待登录…' : '在浏览器中登录'}
            </button>
          </div>
          <div className="account-fixed-server">服务地址：{STORYCLAW_SERVER_URL}</div>
          {waiting && <div className="account-hint">浏览器已打开，完成登录后会自动返回 StoryClaw。</div>}
        </div>
      )}
    </div>
  )
}
