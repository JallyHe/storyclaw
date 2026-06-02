# StoryClaw Plan 4 — New Project Wizard & Sample Workspace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the three-step new project wizard modal, wire it into the App, and generate the sample 《回声》workspace (matching design spec content) for first-launch experience.

**Architecture:** Wizard is a modal overlay component in `src/components/wizard/`; sample workspace is generated via the `scaffoldProject` function from Plan 1's `electron/fs/workspace.ts` extended with seeded content; first-launch detection uses localStorage.

**Prerequisite:** Plans 1–3 complete.

---

## File Map

```
src/components/wizard/
├── Wizard.tsx        # multi-step modal (3 steps)
├── wizard.css
src/
└── App.tsx           # show wizard on first launch or "New Project" click
workspace-example/    # pre-generated 《回声》 sample (committed to repo)
electron/fs/
└── sample.ts         # generates seeded 《回声》 content
```

---

## Task 21: New Project Wizard modal

**Files:**
- Create: `src/components/wizard/wizard.css`
- Create: `src/components/wizard/Wizard.tsx`

- [ ] **Step 1: Create `src/components/wizard/wizard.css`**

```css
.wizard-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 100; }
.wizard-modal { background: var(--bg-1); border: 1px solid var(--border); border-radius: 14px; width: 520px; max-width: 96vw; box-shadow: var(--shadow); overflow: hidden; }
.wizard-header { padding: 22px 24px 0; }
.wizard-title { font-size: 18px; font-weight: 700; color: var(--text-0); margin-bottom: 4px; }
.wizard-sub { font-size: 13px; color: var(--text-2); }
.wizard-steps-indicator { display: flex; gap: 6px; padding: 14px 24px 0; }
.ws-dot { height: 3px; flex: 1; border-radius: 2px; background: var(--border); transition: background .2s; }
.ws-dot.done { background: var(--accent); }
.wizard-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.wz-field { display: flex; flex-direction: column; gap: 6px; }
.wz-label { font-size: 12px; font-weight: 600; color: var(--text-2); text-transform: uppercase; letter-spacing: .06em; }
.wz-input { background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: var(--text-0); font-family: inherit; font-size: 14px; outline: none; }
.wz-input:focus { border-color: var(--accent); }
.wz-radios { display: flex; gap: 8px; }
.wz-radio { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; text-align: center; transition: all .12s; background: var(--bg-2); }
.wz-radio.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg-2)); color: var(--text-0); }
.wz-radio-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
.wz-radio.selected .wz-radio-label { color: var(--text-0); }
.wz-radio-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.wz-ep-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
.wz-ep-row { display: flex; align-items: center; gap: 8px; }
.wz-ep-num { font-size: 12px; font-weight: 600; color: var(--text-3); width: 36px; flex-shrink: 0; }
.wz-ep-input { flex: 1; background: var(--bg-2); border: 1px solid var(--border); border-radius: 7px; padding: 7px 10px; color: var(--text-0); font-family: inherit; font-size: 13px; outline: none; }
.wz-ep-input:focus { border-color: var(--accent); }
.wz-preview { background: var(--bg-2); border: 1px solid var(--border); border-radius: 9px; padding: 12px 14px; font-family: monospace; font-size: 12px; color: var(--text-2); line-height: 1.7; max-height: 200px; overflow-y: auto; }
.wizard-footer { padding: 16px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border); }
.wz-btn-back { padding: 8px 18px; border-radius: 8px; background: var(--bg-3); color: var(--text-1); font-size: 13px; }
.wz-btn-next { padding: 8px 20px; border-radius: 8px; background: var(--accent); color: #1a1205; font-size: 13px; font-weight: 600; }
.wz-btn-next:disabled { opacity: .45; cursor: not-allowed; }
```

- [ ] **Step 2: Create `src/components/wizard/Wizard.tsx`**

```tsx
import { useState } from 'react'
import { workspaceIpc } from '@/ipc/workspace'
import { useWorkspaceStore } from '@/store'
import './wizard.css'

type ProjectType = 'film' | 'series'

interface WizardData {
  name: string
  type: ProjectType
  episodes: number
  episodeTitles: string[]
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
        <input className="wz-input" value={data.name} onChange={e => setData({ name: e.target.value })} placeholder="例如：回声、深海往事…" autoFocus />
      </div>
      <div className="wz-field">
        <label className="wz-label">类型</label>
        <div className="wz-radios">
          {([['film', '单片', '电影或单集短片'], ['series', '剧集', '多集连续剧本']] as const).map(([id, label, sub]) => (
            <div key={id} className={`wz-radio${data.type === id ? ' selected' : ''}`} onClick={() => setData({ type: id })}>
              <div className="wz-radio-label">{label}</div>
              <div className="wz-radio-sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Step2({ data, setData }: { data: WizardData; setData: (d: Partial<WizardData>) => void }) {
  if (data.type === 'film') {
    return <p style={{ color: 'var(--text-2)', fontSize: 13 }}>单片项目将生成一个剧本文件和配套大纲、人物、设定目录。</p>
  }
  return (
    <div className="wz-field">
      <label className="wz-label">集数（{data.episodes} 集）</label>
      <input type="range" min={1} max={13} value={data.episodes}
        onChange={e => {
          const n = Number(e.target.value)
          const titles = Array.from({ length: n }, (_, i) => data.episodeTitles[i] ?? '')
          setData({ episodes: n, episodeTitles: titles })
        }}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
      <div className="wz-ep-list">
        {Array.from({ length: data.episodes }, (_, i) => (
          <div key={i} className="wz-ep-row">
            <span className="wz-ep-num">EP{String(i + 1).padStart(2, '0')}</span>
            <input className="wz-ep-input" value={data.episodeTitles[i] ?? ''} placeholder="集名（可空，后续修改）"
              onChange={e => {
                const titles = [...data.episodeTitles]
                titles[i] = e.target.value
                setData({ episodeTitles: titles })
              }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Step3({ data }: { data: WizardData }) {
  const lines: string[] = [`《${data.name}》/`, '├── 大纲/']
  lines.push('│   ├── 全剧大纲.otl')
  if (data.type === 'series') {
    for (let i = 1; i <= data.episodes; i++) lines.push(`│   ├── EP${String(i).padStart(2,'0')} 大纲.otl`)
    lines.push('├── 剧集/')
    for (let i = 1; i <= data.episodes; i++) {
      const t = data.episodeTitles[i-1] || '未命名'
      lines.push(`│   ├── EP${String(i).padStart(2,'0')} ${t}.ep`)
    }
  } else {
    lines.push(`├── 剧集/`, `│   └── ${data.name}.ep`)
  }
  lines.push('├── 人物/', '│   └── 主角.chr', '├── 设定/', '│   └── 世界观概述.wld', '└── 参考/')
  return (
    <div className="wz-field">
      <label className="wz-label">将生成以下结构</label>
      <div className="wz-preview">{lines.join('\n')}</div>
    </div>
  )
}

interface Props { onClose: () => void }

export function Wizard({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [data, setDataRaw] = useState<WizardData>({ name: '', type: 'series', episodes: 3, episodeTitles: ['', '', ''] })
  const [creating, setCreating] = useState(false)
  const { openWorkspace } = useWorkspaceStore()

  const setData = (patch: Partial<WizardData>) => setDataRaw(d => ({ ...d, ...patch }))

  const canNext = step === 0 ? data.name.trim().length > 0 : true

  const handleNext = async () => {
    if (step < 2) { setStep(s => s + 1); return }
    // Step 3 → create
    setCreating(true)
    const dir = await workspaceIpc.openDialog().catch(() => null)
    if (!dir) { setCreating(false); return }
    const root = await workspaceIpc.create({
      name: data.name,
      type: data.type,
      episodes: data.type === 'series' ? data.episodes : 1,
      episodeTitles: data.type === 'series' ? data.episodeTitles : [data.name],
      targetDir: dir
    })
    await openWorkspace(root)
    setCreating(false)
    onClose()
  }

  const titles = ['新建项目', '集数配置', '确认创建']

  return (
    <div className="wizard-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wizard-modal">
        <div className="wizard-header">
          <div className="wizard-title">{titles[step]}</div>
          <div className="wizard-sub">{step === 0 ? '告诉我你在写什么' : step === 1 ? '配置项目结构' : '确认无误后点击创建'}</div>
        </div>
        <StepIndicator step={step} total={3} />
        <div className="wizard-body">
          {step === 0 && <Step1 data={data} setData={setData} />}
          {step === 1 && <Step2 data={data} setData={setData} />}
          {step === 2 && <Step3 data={data} />}
        </div>
        <div className="wizard-footer">
          {step > 0 && <button className="wz-btn-back" onClick={() => setStep(s => s - 1)}>返回</button>}
          <button className="wz-btn-next" disabled={!canNext || creating} onClick={handleNext}>
            {creating ? '创建中…' : step < 2 ? '下一步' : '创建项目'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/
git commit -m "feat: new project wizard (3-step modal)"
```

---

## Task 22: Wire wizard into App + first-launch logic

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `src/App.tsx` to include wizard and New Project button**

Add to the imports section:
```tsx
import { useState } from 'react'
import { Wizard } from '@/components/wizard/Wizard'
```

Add wizard state inside `App()`:
```tsx
const [showWizard, setShowWizard] = useState(() => {
  // Show wizard on first launch (no workspace ever opened)
  return !localStorage.getItem('storyclaw:lastWorkspace')
})
```

Add to the Titlebar (after the view switch segment, before theme button):
```tsx
<button className="tb-icon" title="新建项目" onClick={() => setShowWizard(true)}>＋</button>
```

Add at the bottom of the returned JSX (before the closing `</div>`):
```tsx
{showWizard && <Wizard onClose={() => setShowWizard(false)} />}
```

Also, update `openWorkspace` call to persist the path:
In `useWorkspaceStore.openWorkspace`, after setting state, add:
```typescript
localStorage.setItem('storyclaw:lastWorkspace', dir)
```

Actually, do this in `App.tsx` by wrapping the workspace open:
```tsx
// In App.tsx, subscribe to workspace root changes:
const root = useWorkspaceStore(s => s.root)
useEffect(() => {
  if (root) localStorage.setItem('storyclaw:lastWorkspace', root)
}, [root])
```

- [ ] **Step 2: Add "Open Folder" button to titlebar**

In `Titlebar.tsx`, add an open-workspace button:
```tsx
// Import workspaceIpc and useWorkspaceStore at top of Titlebar.tsx
import { workspaceIpc } from '@/ipc/workspace'
import { useWorkspaceStore } from '@/store'

// Inside Titlebar component, add:
const { openWorkspace } = useWorkspaceStore()
const handleOpen = async () => {
  const dir = await workspaceIpc.openDialog()
  if (dir) openWorkspace(dir)
}

// Add button next to theme toggle (inside return):
<button className="tb-icon" title="打开文件夹" onClick={handleOpen}>📂</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/shell/Titlebar.tsx
git commit -m "feat: wizard trigger on first launch, open folder button in titlebar"
```

---

## Task 23: Sample workspace (《回声》seeded content)

**Files:**
- Create: `electron/fs/sample.ts`
- Create: `workspace-example/` (generated files)

- [ ] **Step 1: Create `electron/fs/sample.ts`**

```typescript
import fs from 'fs/promises'
import path from 'path'
import { serializeFile } from './serializer'

export async function generateSampleWorkspace(targetDir: string): Promise<string> {
  const root = path.join(targetDir, '《回声》')
  const dirs = ['大纲', '剧集', '人物', '设定', '参考']
  await fs.mkdir(root, { recursive: true })
  for (const d of dirs) await fs.mkdir(path.join(root, d), { recursive: true })

  // 大纲
  await fs.writeFile(path.join(root, '大纲', '全剧大纲.otl'), serializeFile({
    version: 1, scope: 'series',
    logline: '一位失眠的深夜电台主播，在直播热线里接到一通来自三年前已经去世的来电者的电话。',
    acts: [
      { id: 'a1', act: '第一幕 · 建立（EP01）', beats: ['深夜电台《回声》，苏晚的孤独日常与克制的声音。', '接到一通诡异来电，对方自称认识她，号码却查无记录。'] },
      { id: 'a2', act: '第二幕 · 调查（EP02）', beats: ['苏晚回家翻出旧磁带，引出三年前去世的陈默。', '来电每晚同一时间出现，透露只有陈默才知道的细节。', '苏晚开始怀疑：是恶作剧，还是她自己出了问题？'] },
      { id: 'a3', act: '第三幕 · 真相（EP03）', beats: ['苏晚回到事发的高架桥，直面那晚她隐瞒的真相。', '最后一通电话：原来是苏晚自己录下、却从未敢听完的留言。'] }
    ]
  }), 'utf-8')

  for (const [ep, logline, acts] of [
    ['EP01', '深夜热线接到一通查无记录的来电，对方却叫得出苏晚的名字。', [
      { id: 'e1a1', act: '开场', beats: ['建立《回声》深夜节目与苏晚克制的声音。', '第一通来电：「……苏晚，好久不见。」'] },
      { id: 'e1a2', act: '推进', beats: ['苏晚要老周查号，系统里却没有这通来电记录。', '回家翻出旧磁带「陈默 · 最后一期」。'] },
      { id: 'e1a3', act: '钩子', beats: ['闪回三年前那场雨夜车祸的瞬间（只用声音与光）。'] }
    ]],
    ['EP02', '来电每晚准时出现，苏晚试图求证，却被现实一次次否定。', [
      { id: 'e2a1', act: '升级', beats: ['拨打陈默旧号码——空号。', '来电说出只有陈默才知道的细节。'] },
      { id: 'e2a2', act: '怀疑', beats: ['老周劝苏晚停播。', '苏晚分不清：来电真实，还是自己疯了。'] }
    ]],
    ['EP03', '苏晚回到高架桥，直面真相——最后一通来电是她自己录下的留言。', [
      { id: 'e3a1', act: '直面', beats: ['重返事发高架桥。', '终于按下播放键，听完磁带。'] },
      { id: 'e3a2', act: '揭示', beats: ['所有来电都是她三年前录下、却不敢听完的留言。', '对着空荡的直播间，说出从未说出口的那句话。'] }
    ]]
  ] as const) {
    await fs.writeFile(path.join(root, '大纲', `${ep} 大纲.otl`), serializeFile({
      version: 1, scope: 'episode', episode: ep, logline, acts
    }), 'utf-8')
  }

  // 剧集
  await fs.writeFile(path.join(root, '剧集', 'EP01 幽灵来电.ep'), serializeFile({
    version: 1, episode: 'EP01', title: '幽灵来电', status: 'done',
    logline: '深夜热线接到一通查无记录的来电，对方却叫得出苏晚的名字。',
    blocks: [
      { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '城市之声电台 · 直播间', time: '夜', synopsis: '苏晚主持深夜节目，建立孤独而克制的日常。' },
      { id: 'b2', type: 'action', text: '调音台的指示灯在黑暗里明灭。一只手推上推子，红色的「ON AIR」亮起。' },
      { id: 'b3', type: 'action', text: '苏晚（32）戴着耳机，对着话筒。她的声音很稳，眼睛却是空的。桌上摆着一杯早已凉透的咖啡。' },
      { id: 'b4', type: 'character', name: '苏晚' },
      { id: 'b5', type: 'dialogue', text: '凌晨两点零七分，这里是《回声》。如果你也睡不着，没关系——至少今晚，有人陪你醒着。' },
      { id: 'b6', type: 'character', name: '苏晚' },
      { id: 'b7', type: 'dialogue', text: '热线已经打开了。第一位听众，你在吗？' },
      { id: 'b8', type: 'paren', text: '（一阵电流杂音）' },
      { id: 'b9', type: 'character', name: '来电者', ext: 'V.O.' },
      { id: 'b10', type: 'dialogue', text: '……苏晚。好久不见。' },
      { id: 'b11', type: 'action', text: '苏晚的手指停在推子上。她不认识这个声音——可它认识她。' },
      { id: 'b20', type: 'scene', number: '2', intext: '内景', location: '城市之声电台 · 控制室', time: '夜', synopsis: '苏晚要求老周查来电记录，却查无此号。' },
      { id: 'b21', type: 'action', text: '广告时段。苏晚摘下耳机冲进控制室，老周正盯着屏幕皱眉。' },
      { id: 'b22', type: 'character', name: '苏晚' },
      { id: 'b23', type: 'dialogue', text: '刚才那通电话，号码呢？' },
      { id: 'b24', type: 'character', name: '老周' },
      { id: 'b25', type: 'dialogue', text: '邪门。系统里根本没有这通来电记录。线路一直是空的。' },
      { id: 'b26', type: 'paren', text: '（苏晚盯着空白的来电列表，喉咙发紧）' },
      { id: 'b27', type: 'character', name: '苏晚' },
      { id: 'b28', type: 'dialogue', text: '……再放一遍录音。' },
      { id: 'b30', type: 'scene', number: '3', intext: '内景', location: '苏晚的公寓 · 客厅', time: '凌晨', synopsis: '苏晚回家翻出旧物，三年前的车祸浮出水面。' },
      { id: 'b31', type: 'action', text: '公寓很干净，干净得像无人居住。苏晚跪在地板上，从纸箱底翻出一台旧录音机和一盘磁带。' },
      { id: 'b32', type: 'action', text: '磁带上贴着褪色的标签，字迹是她的：「陈默 · 最后一期」。' },
      { id: 'b33', type: 'character', name: '陈默', ext: 'V.O.' },
      { id: 'b34', type: 'dialogue', text: '如果有一天我不在了，你还会播我的声音吗？' },
      { id: 'b35', type: 'action', text: '苏晚的手悬在播放键上方，迟迟没有按下。窗外，城市的霓虹在雨里融化。' },
      { id: 'b40', type: 'scene', number: '4', intext: '外景', location: '城市高架桥', time: '回忆 · 雨夜', synopsis: '闪回三年前那场车祸的瞬间。（待补完）' },
      { id: 'b41', type: 'action', text: '雨刮器疯狂摆动。一对车灯刺破雨幕，急速逼近。' },
      { id: 'b42', type: 'action', text: '（此处待补完——闪回需要交代陈默与苏晚的关系）' }
    ]
  }), 'utf-8')

  await fs.writeFile(path.join(root, '剧集', 'EP02 查无此号.ep'), serializeFile({
    version: 1, episode: 'EP02', title: '查无此号', status: 'wip',
    logline: '来电每晚准时出现，苏晚试图求证，却被现实一次次否定。',
    blocks: [
      { id: 'c10', type: 'scene', number: '1', intext: '内景', location: '苏晚的公寓 · 卧室', time: '凌晨', synopsis: '苏晚拨打陈默的旧号码，听筒里只有空号提示音。' },
      { id: 'c11', type: 'action', text: '苏晚盯着手机屏幕，一个早已不该存在的号码。她按下拨号键。' },
      { id: 'c12', type: 'paren', text: '（听筒里：「您拨打的号码是空号……」）' },
      { id: 'c13', type: 'action', text: '她挂断，又拨。又一次。空号的女声机械而冷漠。' },
      { id: 'c20', type: 'scene', number: '2', intext: '内景', location: '城市之声电台 · 直播间', time: '夜', synopsis: '老周劝苏晚停播，苏晚拒绝。（待写）' },
      { id: 'c21', type: 'action', text: '（待写——老周隔着玻璃看苏晚，眼神担忧）' }
    ]
  }), 'utf-8')

  await fs.writeFile(path.join(root, '剧集', 'EP03 最后留言.ep'), serializeFile({
    version: 1, episode: 'EP03', title: '最后留言', status: 'todo',
    logline: '苏晚回到高架桥，直面那晚的真相——最后一通来电，是她自己录下的留言。',
    blocks: [
      { id: 'd10', type: 'scene', number: '1', intext: '外景', location: '城市高架桥', time: '夜', synopsis: '苏晚重返事发的高架桥，终于按下播放键。' },
      { id: 'd11', type: 'action', text: '（待写）' },
      { id: 'd20', type: 'scene', number: '2', intext: '内景', location: '城市之声电台 · 直播间', time: '夜', synopsis: '真相揭示：所有来电都是她三年前录下、却不敢听完的留言。' },
      { id: 'd21', type: 'action', text: '（待写）' }
    ]
  }), 'utf-8')

  // 人物
  for (const chr of [
    { name: '苏晚', role: '主角', age: 32, color: '#e0a458', tagline: '深夜电台主播，理性、克制，用别人的故事填满自己的失眠。', traits: ['失眠', '情感隔离', '声音是她唯一的盔甲'], arc: '从逃避到直面——承认那晚她本可以阻止悲剧。', voice: '措辞精准、克制，很少用感叹号；情绪崩塌时句子会突然变短。', appearsIn: ['EP01', 'EP02', 'EP03'] },
    { name: '陈默', role: '来电者/声音', age: 35, color: '#7aa2c4', tagline: '三年前车祸去世。曾是苏晚的搭档，也是她不敢提起的人。', traits: ['温和', '不肯放手', '只存在于声音里'], arc: '从「幽灵」到「苏晚内心的回声」——他其实从未离开过她的愧疚。', voice: '慢、留白多，常以反问结束。', appearsIn: ['EP01', 'EP03'] },
    { name: '老周', role: '配角', age: 54, color: '#8fae8f', tagline: '电台老制作人，苏晚唯一的现实锚点。', traits: ['务实', '嘴硬心软'], arc: '提供外部视角，最终推动苏晚面对真相。', voice: '口语化，爱用反问和俏皮话，但关键时刻很认真。', appearsIn: ['EP01', 'EP02'] }
  ]) {
    await fs.writeFile(path.join(root, '人物', `${chr.name}.chr`), serializeFile({ version: 1, ...chr }), 'utf-8')
  }

  // 设定
  for (const [filename, wld] of [
    ['回声节目.wld', { version: 1 as const, title: '《回声》节目', body: '凌晨两点到四点的深夜热线节目，听众多为失眠者。规则：不留真名，只讲故事。这档节目是苏晚的避难所，也是她的牢笼。' }],
    ['城市之声电台.wld', { version: 1 as const, title: '城市之声电台', body: '一栋老旧的广播大楼，深夜只剩苏晚和老周。直播间的隔音玻璃、走廊声控灯、永远修不好的二号线路——都将成为叙事符号。' }],
    ['声音的规则.wld', { version: 1 as const, title: '声音的规则（核心设定）', body: '本片所有「超自然」都只通过声音发生，画面绝不直接呈现鬼魂。来电是否真实，留给观众判断。结尾揭示：声音来自苏晚自己三年前录下的留言。' }],
    ['视觉基调.wld', { version: 1 as const, title: '视觉基调', body: '低照度、霓虹与雨。冷蓝为主，唯有直播间「ON AIR」的红光是暖的。' }]
  ] as const) {
    await fs.writeFile(path.join(root, '设定', filename), serializeFile(wld), 'utf-8')
  }

  // README in 参考/
  await fs.writeFile(path.join(root, '参考', 'README.md'),
    '# 参考资料\n\n将原著小说、参考剧本、改编说明等文档拖入此目录。\n支持格式：`.txt` `.md` `.pdf`\n\nPi Agent 可读取这些文件作为创作上下文。\n',
    'utf-8'
  )

  return root
}
```

- [ ] **Step 2: Add IPC handler for sample workspace**

In `electron/main.ts`, add after the other IPC handlers:

```typescript
import { generateSampleWorkspace } from './fs/sample'

ipcMain.handle('workspace:createSample', async (_e, targetDir: string) => {
  return generateSampleWorkspace(targetDir)
})
```

In `electron/preload.ts`, add to the workspace api object:
```typescript
createSample: (targetDir: string): Promise<string> => ipcRenderer.invoke('workspace:createSample', targetDir),
```

In `src/ipc/workspace.ts`, add:
```typescript
createSample: (targetDir: string): Promise<string> => window.api.workspace.createSample(targetDir),
```

In `src/env.d.ts` workspace section, add:
```typescript
createSample(targetDir: string): Promise<string>
```

- [ ] **Step 3: Generate workspace-example into repo**

Add a script to package.json:
```json
"generate-sample": "node -e \"require('./out/main/index.js')\" "
```

Actually, generate directly using Node since electron/fs/sample.ts can run standalone:

```bash
npx ts-node --project tsconfig.node.json -e "
const { generateSampleWorkspace } = require('./electron/fs/sample');
generateSampleWorkspace('./workspace-example').then(p => console.log('Generated:', p));
"
```

If ts-node is not available, build and run:
```bash
npm run build
node -e "const {generateSampleWorkspace}=require('./out/main/fs/sample');generateSampleWorkspace('./workspace-example').then(p=>console.log('Done:',p))"
```

- [ ] **Step 4: Add "Try Sample" button to Wizard Step 3**

In `src/components/wizard/Wizard.tsx`, in `Step3` and handleNext, add a sample button:

```tsx
// In Wizard.tsx, add to wizard-footer alongside next button:
{step === 2 && (
  <button
    className="wz-btn-back"
    onClick={async () => {
      setCreating(true)
      const dir = await workspaceIpc.openDialog().catch(() => null)
      if (!dir) { setCreating(false); return }
      const root = await (window.api.workspace as any).createSample(dir)
      await openWorkspace(root)
      setCreating(false)
      onClose()
    }}
    disabled={creating}
    style={{ marginRight: 'auto' }}
  >
    载入《回声》样本
  </button>
)}
```

- [ ] **Step 5: Commit all**

```bash
git add electron/fs/sample.ts electron/main.ts electron/preload.ts src/ipc/workspace.ts src/env.d.ts src/components/wizard/ workspace-example/
git commit -m "feat: sample workspace generator (《回声》) + wizard load-sample button"
```

---

## Task 24: Final integration test + cleanup

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all tests pass (≥ 16 tests).

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Launch and smoke test**

```bash
npm run dev
```

Manual checklist:
- [ ] Wizard appears on first launch
- [ ] Create a new series project → workspace opens in explorer
- [ ] Click `.ep` file → screenplay editor shows blocks
- [ ] Click `.chr` file → character card form renders
- [ ] Click `.otl` file → outline editor renders
- [ ] Click `.wld` file → world editor renders
- [ ] Switch to Agent mode → sessions + hero page visible
- [ ] Type a message in Copilot → typing indicator shows, agent responds
- [ ] Toggle dark/light theme → all panels update
- [ ] Drag resize handles → panel widths change
- [ ] Changes panel shows "暂无待审改动" when empty

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: Plan 4 complete — StoryClaw MVP ready"
```
