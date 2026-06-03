import { useState } from 'react'
import { workspaceIpc } from '@/ipc/workspace'
import { useWorkspaceStore } from '@/store'
import { addRecentProject } from '@/components/shell/WelcomeScreen'
import './wizard.css'

type ProjectType = 'film' | 'series' | 'short'
type ScreenplayLayout = 'single-file-multi-episode' | 'one-file-per-episode' | 'single-film-file'

interface WizardData {
  name: string
  type: ProjectType
  episodes: number
  episodeDurationMinutes: number
  genre: string
  synopsis: string
  screenplayLayout: ScreenplayLayout
  targetDir: string
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="wizard-steps-indicator">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`ws-dot${i <= step ? ' done' : ''}`} />
      ))}
    </div>
  )
}

function Step1({ data, setData }: { data: WizardData; setData: (d: Partial<WizardData>) => void }) {
  return (
    <>
      <div className="wz-field">
        <label className="wz-label">项目名称</label>
        <input
          className="wz-input"
          value={data.name}
          onChange={e => setData({ name: e.target.value })}
          placeholder="例如：回声、深海往事…"
          autoFocus
        />
      </div>

      <div className="wz-field">
        <label className="wz-label">类型</label>
        <div className="wz-radios">
          {([
            ['film', '电影', '单个电影剧本'],
            ['series', '电视剧', '默认一集一个剧本文件'],
            ['short', '短剧', '默认一个剧本文件包含多集']
          ] as const).map(([id, label, sub]) => (
            <div
              key={id}
              className={`wz-radio${data.type === id ? ' selected' : ''}`}
              onClick={() => setData({
                type: id,
                episodes: id === 'film' ? 1 : data.episodes,
                episodeDurationMinutes: id === 'film' ? 100 : id === 'short' ? 3 : 45,
                screenplayLayout: defaultLayoutForType(id)
              })}
            >
              <div className="wz-radio-label">{label}</div>
              <div className="wz-radio-sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wz-field">
        <label className="wz-label">题材</label>
        <input
          className="wz-input"
          value={data.genre}
          onChange={e => setData({ genre: e.target.value })}
          placeholder="例如：青春偶像、悬疑、古装喜剧…"
        />
      </div>

      <div className="wz-field">
        <label className="wz-label">简介</label>
        <textarea
          className="wz-input"
          value={data.synopsis}
          onChange={e => setData({ synopsis: e.target.value })}
          rows={3}
          placeholder="一句话或一小段描述项目核心设定…"
        />
      </div>

      {data.type !== 'film' && (
        <div className="wz-field">
          <label className="wz-label">计划集数</label>
          <input
            className="wz-input"
            type="number"
            min={1}
            max={100}
            value={data.episodes}
            onChange={e => setData({ episodes: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ width: 100 }}
          />
        </div>
      )}

      <div className="wz-field">
        <label className="wz-label">每集时长（分钟）</label>
        <input
          className="wz-input"
          type="number"
          min={1}
          value={data.episodeDurationMinutes}
          onChange={e => setData({ episodeDurationMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
          style={{ width: 140 }}
        />
      </div>

      <div className="wz-field">
        <label className="wz-label">剧本组织方式</label>
        <select
          className="wz-input"
          value={data.screenplayLayout}
          onChange={e => setData({ screenplayLayout: e.target.value as ScreenplayLayout })}
        >
          <option value="single-file-multi-episode">一个剧本文件包含多集</option>
          <option value="one-file-per-episode">一集一个剧本文件</option>
          <option value="single-film-file">电影单文件</option>
        </select>
      </div>
    </>
  )
}

function Step2({ data }: { data: WizardData }) {
  const lines = [`《${data.name}》/`, '├── 项目配置.cfg', '├── 大纲/', '│   └── 全剧大纲.md', '├── 剧集/']
  lines.push('├── 人物/', '│   └── 主角.chr', '├── 设定/', '│   └── 项目设定.wld', '└── 参考/')

  return (
    <div className="wz-field">
      <label className="wz-label">将生成以下结构</label>
      <div className="wz-preview">{lines.join('\n')}</div>
      <div className="wz-field-hint" style={{ marginTop: 10 }}>
        不会初始化空剧本文件。Agent 和资源管理器会按项目配置创建剧本。
      </div>
    </div>
  )
}

function defaultLayoutForType(type: ProjectType): ScreenplayLayout {
  if (type === 'short') return 'single-file-multi-episode'
  if (type === 'film') return 'single-film-file'
  return 'one-file-per-episode'
}

interface Props { onClose: () => void }

export function Wizard({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [data, setDataRaw] = useState<WizardData>({
    name: '',
    type: 'series',
    episodes: 12,
    episodeDurationMinutes: 45,
    genre: '',
    synopsis: '',
    screenplayLayout: 'one-file-per-episode',
    targetDir: ''
  })
  const [creating, setCreating] = useState(false)
  const { openWorkspace } = useWorkspaceStore()

  const setData = (patch: Partial<WizardData>) => setDataRaw(d => ({ ...d, ...patch }))
  const canNext = data.name.trim().length > 0 && (step === 0 || data.targetDir.trim().length > 0)

  const chooseTargetDir = async () => {
    const dir = await workspaceIpc.openDialog().catch(() => null)
    if (dir) setData({ targetDir: dir })
  }

  const handleNext = async () => {
    if (step < 1) { setStep(s => s + 1); return }
    setCreating(true)
    const root = await workspaceIpc.create({
      name: data.name,
      type: data.type,
      episodes: data.episodes,
      episodeDurationMinutes: data.episodeDurationMinutes,
      genre: data.genre,
      synopsis: data.synopsis,
      screenplayLayout: data.screenplayLayout,
      episodeTitles: [],   // no per-episode titles
      targetDir: data.targetDir
    })
    addRecentProject(root)
    await openWorkspace(root)
    setCreating(false)
    onClose()
  }

  const titles = ['新建项目', '确认创建']
  const subs   = ['告诉我你在写什么', '确认结构后点击创建']

  return (
    <div className="wizard-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wizard-modal">
        <div className="wizard-header">
          <div className="wizard-title">{titles[step]}</div>
          <p className="wizard-sub">{subs[step]}</p>
        </div>
        <StepIndicator step={step} total={2} />
        <div className="wizard-body">
          {step === 0 && <Step1 data={data} setData={setData} />}
          {step === 1 && (
            <>
              <Step2 data={data} />
              <div className="wz-field">
                <label className="wz-label">保存位置</label>
                <div className="wz-path-row">
                  <input className="wz-input" value={data.targetDir} onChange={e => setData({ targetDir: e.target.value })} placeholder="例如 D:\\StoryProjects" />
                  <button className="wz-btn-back" onClick={chooseTargetDir}>选择…</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="wizard-footer">
          {step > 0 && (
            <button className="wz-btn-back" onClick={() => setStep(s => s - 1)}>返回</button>
          )}
          <button
            className="wz-btn-next"
            disabled={!canNext || creating}
            onClick={handleNext}
          >
            {creating ? '创建中…' : step < 1 ? '下一步' : '创建项目'}
          </button>
        </div>
      </div>
    </div>
  )
}
