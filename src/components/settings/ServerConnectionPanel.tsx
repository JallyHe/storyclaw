import { useCallback, useEffect, useRef, useState } from 'react'
import { serverConnectionIpc, type ConnectionState } from '@/ipc/serverConnection'

export function ServerConnectionPanel() {
  const [state, setState] = useState<ConnectionState | null>(null)
  const [serverUrl, setServerUrl] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const offRef = useRef<(() => void) | null>(null)

  const loadState = useCallback(async () => {
    const s = await serverConnectionIpc.getState().catch(() => null)
    setState(s)
    if (s?.serverUrl) setServerUrl(s.serverUrl)
  }, [])

  useEffect(() => {
    void loadState()

    // Listen for the deep-link callback from main process
    const off = serverConnectionIpc.onConnected(async () => {
      setWaiting(false)
      setError('')
      await loadState()
    })
    offRef.current = off
    return off
  }, [loadState])

  const handleLogin = () => {
    setError('')
    const url = serverUrl.trim()
    if (!url) { setError('请填写服务器地址'); return }
    setWaiting(true)
    void serverConnectionIpc.openAuthBrowser(url)
  }

  const handleDisconnect = async () => {
    await serverConnectionIpc.disconnect()
    setState(null)
  }

  return (
    <div className="set-section" style={{ marginTop: '1.5rem' }}>
      <div className="set-section-head">
        <div>
          <h3>连接 AI 服务</h3>
          <p className="set-section-desc">
            连接订阅服务后，AI 模型将自动加载，无需手动配置 API Key。
          </p>
        </div>
      </div>

      {state?.token ? (
        /* ── 已连接状态 ── */
        <div className="int-card" style={{ alignItems: 'flex-start' }}>
          <div className="int-card-main">
            <div className="int-card-title">
              <span className="int-dot connected" title="已连接" />
              {state.serverUrl}
            </div>
            <div className="int-card-desc">
              已加载 {state.modelCount} 个模型
              {state.balance > 0 && `　积分余额：${state.balance.toLocaleString()}`}
            </div>
            <button
              className="int-guide"
              style={{ color: '#e05252', marginTop: 6 }}
              onClick={() => void handleDisconnect()}
            >
              断开连接
            </button>
          </div>
        </div>
      ) : (
        /* ── 未连接：输入服务器地址 + 浏览器跳转 ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 380 }}>
          <input
            className="set-input"
            type="url"
            placeholder="服务器地址，如 https://api.storyclaw.com"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          />

          {error && (
            <p style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8rem' }}>{error}</p>
          )}

          {waiting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#888' }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
              浏览器已打开，完成登录后将自动返回…
              <button
                className="int-guide"
                onClick={() => setWaiting(false)}
                style={{ marginLeft: 'auto' }}
              >
                取消
              </button>
            </div>
          ) : (
            <button className="set-btn primary" onClick={handleLogin}>
              在浏览器中登录
            </button>
          )}

          <p style={{ fontSize: '0.75rem', color: '#555', lineHeight: 1.5 }}>
            点击后将打开浏览器完成登录，登录成功后自动返回并配置模型。
          </p>
        </div>
      )}
    </div>
  )
}
