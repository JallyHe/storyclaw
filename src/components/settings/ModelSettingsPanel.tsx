import { useCallback, useEffect, useState } from 'react'
import type { AgentConfigSnapshot, AgentModelConfig, AgentModelOption } from '@/types'
import { agentIpc } from '@/ipc/agent'
import { Ic } from '@/components/icons'
import {
  PROVIDER_TEMPLATES,
  PROVIDER_TEMPLATE_MAP,
  createDraftModel,
  getProviderGroupId
} from './modelCatalog'

export function ModelSettingsPanel() {
  const [config, setConfig] = useState<AgentConfigSnapshot | null>(null)
  const [options, setOptions] = useState<AgentModelOption[]>([])
  const [draft, setDraft] = useState<AgentModelConfig | null>(null)
  const [providerId, setProviderId] = useState('custom-openai')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState('')

  const reload = useCallback(() => {
    void agentIpc.getConfig().then(setConfig).catch(() => {})
    void agentIpc.listModels().then(setOptions).catch(() => {})
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const models = config?.models ?? []
  const activeId = config?.activeModelId ?? ''
  const provider = PROVIDER_TEMPLATE_MAP[providerId] ?? PROVIDER_TEMPLATE_MAP['custom-openai']
  const draftConfigured = Boolean(draft?.apiKey || draft?.providerId === 'ollama')
  const optionFor = (id: string) => options.find(o => o.id === id)

  const startNew = (pid = 'custom-openai') => {
    setProviderId(pid)
    setDraft(createDraftModel(pid))
    setShowKey(false)
    setStatus('')
  }

  const startEdit = (model: AgentModelConfig) => {
    setProviderId(getProviderGroupId(model.providerId))
    setDraft({ ...model })
    setShowKey(false)
    setStatus('')
  }

  const switchProvider = (pid: string) => {
    setProviderId(pid)
    const t = PROVIDER_TEMPLATE_MAP[pid] ?? PROVIDER_TEMPLATE_MAP['custom-openai']
    setDraft(cur => cur ? {
      ...cur,
      providerId: t.providerId ?? t.id,
      api: t.api,
      baseUrl: t.baseUrl,
      apiKey: cur.apiKey ?? (t.id === 'ollama' ? 'ollama' : undefined)
    } : createDraftModel(pid))
  }

  const patch = (p: Partial<AgentModelConfig>) => setDraft(cur => cur ? { ...cur, ...p } : cur)

  const persist = async (next: AgentConfigSnapshot) => {
    const saved = await agentIpc.saveConfig(next)
    setConfig(saved)
    void agentIpc.listModels().then(setOptions).catch(() => {})
    return saved
  }

  const saveDraft = async () => {
    if (!draft) return
    if (!draft.model.trim()) { setStatus('请填写模型 ID。'); return }
    const exists = models.some(m => m.id === draft.id)
    const nextModels = exists ? models.map(m => m.id === draft.id ? draft : m) : [...models, draft]
    await persist({ version: 1, activeModelId: draft.id, models: nextModels })
    setStatus('已保存并设为当前模型。')
    setDraft(null)
  }

  const deleteModel = async (target: AgentModelConfig) => {
    const nextModels = models.filter(m => m.id !== target.id)
    const nextActive = activeId === target.id ? (nextModels[0]?.id ?? '') : activeId
    await persist({ version: 1, activeModelId: nextActive, models: nextModels })
    if (draft?.id === target.id) setDraft(null)
    setStatus('模型已删除。')
  }

  const setActive = async (id: string) => {
    if (!config) return
    await persist({ ...config, activeModelId: id })
    setStatus('已切换当前模型。')
  }

  const testDraft = async () => {
    if (!draft) return
    setStatus('正在检查模型配置…')
    const exists = models.some(m => m.id === draft.id)
    const nextModels = exists ? models.map(m => m.id === draft.id ? draft : m) : [...models, draft]
    await persist({ version: 1, activeModelId: draft.id, models: nextModels })
    const result = await agentIpc.testModel(draft.id)
    setStatus(result.message)
  }

  return (
    <div className="set-section">
      <div className="set-section-head set-model-head">
        <div>
          <h3>模型</h3>
          <p className="set-section-desc">配置 Agent 使用的模型与 API Key，可添加多个并切换。</p>
        </div>
        <button className="set-btn primary" onClick={() => startNew()}>
          <Ic.plus width={14} height={14} /> 添加模型
        </button>
      </div>

      {/* 已保存模型列表 */}
      {models.length === 0 ? (
        <div className="set-empty small">
          <p>还没有配置任何模型。点击「添加模型」开始，默认入口是自定义 OpenAI 接口。</p>
        </div>
      ) : (
        <div className="set-model-list">
          {models.map(model => {
            const opt = optionFor(model.id)
            const isActive = model.id === activeId
            return (
              <div key={model.id} className={`set-model-row${isActive ? ' active' : ''}`}>
                <button
                  className="set-model-radio"
                  title={isActive ? '当前模型' : '设为当前模型'}
                  onClick={() => setActive(model.id)}
                >
                  <span className={isActive ? 'on' : ''} />
                </button>
                <div className="set-model-info" onClick={() => startEdit(model)}>
                  <div className="set-model-name">
                    {model.displayName || model.model || '未命名模型'}
                    {!model.enabled && <span className="set-tag muted">已停用</span>}
                    {opt && !opt.configured && <span className="set-tag warn">缺 Key</span>}
                  </div>
                  <div className="set-model-sub">{model.providerId}/{model.model}{model.api ? ` · ${model.api}` : ''}</div>
                </div>
                <button className="set-icon-btn" title="编辑" onClick={() => startEdit(model)}>
                  <Ic.sliders width={15} height={15} />
                </button>
                <button className="set-icon-btn danger" title="删除" onClick={() => deleteModel(model)}>
                  <Ic.x width={15} height={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 编辑/新增表单 */}
      {draft && (
        <div className="set-model-dialog-backdrop" onMouseDown={() => setDraft(null)}>
          <div
            className="set-model-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-dialog-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="set-model-dialog-head">
              <div>
                <h3 id="model-dialog-title">{models.some(m => m.id === draft.id) ? '编辑模型' : '添加模型'}</h3>
                <p className="set-section-desc">配置供应商、模型 ID 和访问密钥。</p>
              </div>
              <button className="set-icon-btn" title="关闭" onClick={() => setDraft(null)}>
                <Ic.x width={16} height={16} />
              </button>
            </div>
            <div className="set-model-editor">
          <div className="set-field">
            <label>供应商</label>
            <div className="set-provider-grid">
              {PROVIDER_TEMPLATES.map(p => (
                <button
                  key={p.id}
                  className={`set-provider${providerId === p.id ? ' on' : ''}`}
                  onClick={() => switchProvider(p.id)}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="set-field-row">
            <div className="set-field">
              <label>显示名称</label>
              <input
                value={draft.displayName}
                placeholder="例如：GPT-5 主力"
                onChange={e => patch({ displayName: e.target.value })}
              />
            </div>
            <div className="set-field">
              <label>模型 ID</label>
              <input
                value={draft.model}
                placeholder="例如：gpt-5 / deepseek-chat"
                onChange={e => patch({ model: e.target.value })}
              />
            </div>
          </div>

          {!provider.builtin && (
            <div className="set-field">
              <label>Base URL</label>
              <input
                value={draft.baseUrl ?? ''}
                placeholder={provider.baseUrlPlaceholder ?? 'https://api.example.com/v1'}
                onChange={e => patch({ baseUrl: e.target.value })}
              />
            </div>
          )}

          <div className="set-field">
            <label>API Key</label>
            <div className="set-key-row">
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey ?? ''}
                placeholder={provider.apiKeyPlaceholder ?? 'sk-...'}
                onChange={e => patch({ apiKey: e.target.value })}
              />
              <button className="set-btn ghost" onClick={() => setShowKey(v => !v)}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <div className="set-field-row compact">
            <label className="set-check">
              <input type="checkbox" checked={draft.reasoning} onChange={e => patch({ reasoning: e.target.checked })} />
              推理模型（reasoning）
            </label>
            <label className="set-check">
              <input type="checkbox" checked={draft.enabled} onChange={e => patch({ enabled: e.target.checked })} />
              启用
            </label>
          </div>

          {status && <div className="set-status">{status}</div>}

          <div className="set-editor-actions">
            <button className="set-btn ghost" onClick={() => testDraft()} disabled={!draftConfigured}>测试连接</button>
            <div style={{ flex: 1 }} />
            <button className="set-btn" onClick={() => setDraft(null)}>取消</button>
            <button className="set-btn primary" onClick={() => saveDraft()}>保存</button>
          </div>
            </div>
          </div>
        </div>
      )}

      {!draft && status && <div className="set-status">{status}</div>}
    </div>
  )
}
