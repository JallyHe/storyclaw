import { useCallback, useEffect, useState } from 'react'
import { serverConnectionIpc, type ConnectionState } from '@/ipc/serverConnection'
import { agentIpc } from '@/ipc/agent'

export function ServerConnectionPanel() {
  const [state, setState] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ serverUrl: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadState = useCallback(async () => {
    try {
      const s = await serverConnectionIpc.getState()
      setState(s)
    } catch {
      setState(null)
    }
  }, [])

  useEffect(() => { void loadState() }, [loadState])

  const handleConnect = async () => {
    setError('')
    setSuccess('')
    if (!form.serverUrl || !form.email || !form.password) {
      setError('请填写所有字段')
      return
    }
    setLoading(true)
    try {
      const result = await serverConnectionIpc.connect(form.serverUrl, form.email, form.password)
      if (result.success) {
        setSuccess(`✓ 已连接，加载了 ${result.modelCount} 个模型`)
        setForm(f => ({ ...f, password: '' }))
        await loadState()
        // Reload model list in ModelSettingsPanel (other components will re-fetch on their own)
        void agentIpc.listModels().catch(() => {})
      } else {
        setError(result.error ?? '连接失败')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '连接失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setError('')
    setSuccess('')
    await serverConnectionIpc.disconnect()
    setState(null)
    void agentIpc.listModels().catch(() => {})
  }

  const formatExpiry = (ts: number | null) => {
    if (!ts) return '永不过期'
    return new Date(ts * 1000).toLocaleDateString('zh-CN')
  }

  return (
    <div className="set-section" style={{ marginTop: '1.5rem' }}>
      <div className="set-section-head">
        <div>
          <h3>连接 AI 服务</h3>
          <p className="set-section-desc">
            连接自托管的 sub2api 服务，自动加载可用模型和积分余额。
          </p>
        </div>
      </div>

      {state ? (
        /* Connected state */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="int-card" style={{ alignItems: 'flex-start' }}>
            <div className="int-card-main">
              <div className="int-card-title">
                <span className="int-dot connected" title="已连接" />
                {state.serverUrl}
              </div>
              <div className="int-card-desc">
                账号：{state.email} · 已加载 {state.modelCount} 个模型
                {state.balance > 0 && ` · 积分：${state.balance.toLocaleString()}`}
                {state.expiresAt && ` · 到期：${formatExpiry(state.expiresAt)}`}
              </div>
            </div>
            <button className="set-btn" onClick={handleDisconnect}>
              断开
            </button>
          </div>
          {success && <p style={{ color: 'var(--color-ok, #16a34a)', fontSize: '0.8rem' }}>{success}</p>}
        </div>
      ) : (
        /* Login form */
        <div className="set-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 400 }}>
          <input
            className="set-input"
            type="url"
            placeholder="服务器地址，如 https://your-server.com"
            value={form.serverUrl}
            onChange={e => setForm(f => ({ ...f, serverUrl: e.target.value }))}
          />
          <input
            className="set-input"
            type="email"
            placeholder="邮箱"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <input
            className="set-input"
            type="password"
            placeholder="密码"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') void handleConnect() }}
          />
          {error && <p style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8rem' }}>{error}</p>}
          {success && <p style={{ color: 'var(--color-ok, #16a34a)', fontSize: '0.8rem' }}>{success}</p>}
          <button
            className="set-btn primary"
            disabled={loading}
            onClick={() => void handleConnect()}
          >
            {loading ? '连接中…' : '连接'}
          </button>
        </div>
      )}
    </div>
  )
}
