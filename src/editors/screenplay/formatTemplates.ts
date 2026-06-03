// ── 剧本格式模板库（共享纯逻辑） ─────────────────────────────────────────────
// 一个「格式模板」是一组正则规则，用于把任意来源的剧本文本逐行归类为
// 场次头 / 转场 / 对白 / 描述（动作），再转换成 StoryClaw 的 .ep 轻标记格式。
//
// 工作流（由 screenplay-formatting 技能驱动）：
//   1. 用 rankTemplates 给原文打分，挑出最匹配的模板
//   2. 命中（ratio 达标且有场次头）→ applyTemplate 直接格式化
//   3. 没命中 → AI 依据当前格式新造规则，applyTemplate 试跑校验，达标后保存
//   4. 保存后下次直接命中
//
// 渲染端与主进程共用；持久化在主进程（见 electron/screenplay/formatStore.ts）。

import { serializeScreenplayMarkup } from './markup'

export interface FormatTemplate {
  id: string
  name: string
  description?: string
  /** 内置模板（不可删除） */
  builtin?: boolean
  /** 命中任一即判为场次头的正则源 */
  scene: string[]
  /** 命中任一即判为转场的正则源 */
  transition: string[]
  /** 对白正则源，需含 2 个捕获组：1=人物（含可选说明），2=台词 */
  dialogue: string[]
}

export interface MatchStats {
  total: number
  scene: number
  transition: number
  dialogue: number
  action: number
  /** 结构化行（场次+转场+对白）占比 */
  ratio: number
}

// ── 内置默认模板 ──────────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES: FormatTemplate[] = [
  {
    id: 'cn-standard',
    name: '中文短剧/剧集标准',
    description: '「第N场」场次头、「人物（说明）：台词」对白、常见中文转场词。',
    builtin: true,
    scene: ['^(?:#\\s*)?(?:第\\s*)?\\d+\\s*[场場](?:\\s|$|[，,、])', '^(?:#\\s*)?场\\s*\\d+'],
    transition: ['^(?:>\\s*)?(切至|转场|淡入|淡出|闪回(?:至)?|叠化|黑场|甩(?:镜)?|缩放|字幕|画外音)[：:\\s]?.{0,30}$'],
    dialogue: ['^([\\u4e00-\\u9fa5A-Za-z·]{1,8}(?:（[^）]*）)?)\\s*[：:]\\s*(.+)$']
  },
  {
    id: 'film-intext',
    name: '电影 INT/EXT（好莱坞式）',
    description: 'INT./EXT. 场景头、英文转场（CUT TO/FADE IN）、冒号式对白。',
    builtin: true,
    scene: ['^(?:#\\s*)?(?:INT|EXT|INT\\.?\\/EXT|I\\/E)\\.?\\s+'],
    transition: ['^(?:>\\s*)?(CUT TO|FADE IN|FADE OUT|DISSOLVE(?: TO)?|SMASH CUT|MATCH CUT)[：:\\s]?.*$', '[A-Z]{2,} TO[:：]\\s*$'],
    dialogue: ['^([A-Z][A-Z .·\\u4e00-\\u9fa5]{1,18}(?:\\([^)]*\\))?)\\s*[：:]\\s*(.+)$']
  },
  {
    id: 'novel-quote',
    name: '小说/对白引号体',
    description: '「人物说道：“台词”」这类引号包裹台词的散文体。',
    builtin: true,
    scene: ['^(?:#\\s*)?(?:第\\s*)?\\d+\\s*[章场場节]'],
    transition: ['^(?:>\\s*)?(镜头|画面)?(切|转|淡)[到至]'],
    dialogue: ['^([\\u4e00-\\u9fa5·]{1,6})(?:[说道講問问答])?\\s*[：:]?\\s*[“"「『](.+?)[”"」』]\\s*[。.]?$']
  }
]

// ── 正则编译（容错） ──────────────────────────────────────────────────────────
function compile(patterns: string[]): RegExp[] {
  const out: RegExp[] = []
  for (const src of patterns) {
    try { out.push(new RegExp(src)) } catch { /* 跳过非法正则 */ }
  }
  return out
}

type Compiled = { scene: RegExp[]; transition: RegExp[]; dialogue: RegExp[] }
function compileTemplate(t: FormatTemplate): Compiled {
  return { scene: compile(t.scene), transition: compile(t.transition), dialogue: compile(t.dialogue) }
}

type LineKind = 'scene' | 'transition' | 'dialogue' | 'action'

function classify(line: string, c: Compiled): { kind: LineKind; groups?: RegExpMatchArray } {
  if (c.scene.some(re => re.test(line))) return { kind: 'scene' }
  if (c.transition.some(re => re.test(line))) return { kind: 'transition' }
  for (const re of c.dialogue) {
    const m = line.match(re)
    if (m && m[1] && m[2]) return { kind: 'dialogue', groups: m }
  }
  return { kind: 'action' }
}

// ── 文本规整 ──────────────────────────────────────────────────────────────────
function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/\f/g, '\n').split('\n')
}
function cleanLine(line: string): string {
  return line.replace(/[ \t]+/g, ' ').trim()
}
function isNoise(line: string): boolean {
  return /^\d{1,4}$/.test(line) || /^第\s*\d+\s*页$/.test(line)
}

/** 给单个模板对一段文本打分。 */
export function scoreTemplate(text: string, t: FormatTemplate): MatchStats {
  const c = compileTemplate(t)
  const stats: MatchStats = { total: 0, scene: 0, transition: 0, dialogue: 0, action: 0, ratio: 0 }
  for (const raw of splitLines(text)) {
    const line = cleanLine(raw)
    if (!line || isNoise(line)) continue
    stats.total++
    stats[classify(line, c).kind]++
  }
  stats.ratio = stats.total ? (stats.scene + stats.transition + stats.dialogue) / stats.total : 0
  return stats
}

/** 把所有模板按匹配度从高到低排序。 */
export function rankTemplates(
  text: string,
  templates: FormatTemplate[]
): Array<{ template: FormatTemplate; stats: MatchStats }> {
  return templates
    .map(template => ({ template, stats: scoreTemplate(text, template) }))
    .sort((a, b) => {
      // 优先有场次头的，其次结构化占比，再次对白数量
      const sa = (a.stats.scene > 0 ? 1 : 0), sb = (b.stats.scene > 0 ? 1 : 0)
      if (sa !== sb) return sb - sa
      if (b.stats.ratio !== a.stats.ratio) return b.stats.ratio - a.stats.ratio
      return b.stats.dialogue - a.stats.dialogue
    })
}

/** 判断某次匹配是否「足够可信，可直接套用」。 */
export function isConfidentMatch(stats: MatchStats): boolean {
  return stats.total >= 3 && stats.scene >= 1 && stats.ratio >= 0.25
}

// ── 套用模板：文本 → .ep 轻标记 ───────────────────────────────────────────────
export interface ApplyResult {
  markup: string
  stats: MatchStats
  /** 仍被判为「描述」的样例行（便于 AI 判断是否漏了对白/场次规则） */
  unmatchedSamples: string[]
}

export function applyTemplate(
  text: string,
  t: FormatTemplate,
  meta: { title: string; episode?: string }
): ApplyResult {
  const c = compileTemplate(t)
  const stats: MatchStats = { total: 0, scene: 0, transition: 0, dialogue: 0, action: 0, ratio: 0 }
  const unmatchedSamples: string[] = []
  const body: string[] = []
  let lastBlank = false

  const pushBlank = () => { if (body.length && !lastBlank) { body.push(''); lastBlank = true } }

  for (const raw of splitLines(text)) {
    const line = cleanLine(raw)
    if (!line || isNoise(line)) { pushBlank(); continue }
    stats.total++
    const r = classify(line, c)
    stats[r.kind]++
    let out: string
    switch (r.kind) {
      case 'scene':      out = `# ${line.replace(/^#\s*/, '').trim()}`; break
      case 'transition': out = `> ${line.replace(/^>\s*/, '').trim()}`; break
      case 'dialogue':   out = `${r.groups![1].trim()}：${r.groups![2].trim()}`; break
      default:
        out = line
        if (unmatchedSamples.length < 12) unmatchedSamples.push(line)
    }
    if (body.length && !lastBlank) body.push('')
    body.push(out)
    lastBlank = false
  }

  stats.ratio = stats.total ? (stats.scene + stats.transition + stats.dialogue) / stats.total : 0

  const header = serializeScreenplayMarkup({
    version: 1,
    episode: (meta.episode || 'EP').replace(/\r?\n/g, ' ').trim() || 'EP',
    title: (meta.title || '导入剧本').replace(/\r?\n/g, ' ').trim() || '导入剧本',
    status: 'wip',
    logline: '',
    blocks: []
  }).split('\n\n')[0]

  return { markup: `${header}\n\n${body.join('\n').trim()}`.trimEnd(), stats, unmatchedSamples }
}

/** 校验模板里的正则是否都能编译。返回非法的正则源列表。 */
export function validateTemplate(t: Pick<FormatTemplate, 'scene' | 'transition' | 'dialogue'>): string[] {
  const bad: string[] = []
  for (const src of [...t.scene, ...t.transition, ...t.dialogue]) {
    try { new RegExp(src) } catch { bad.push(src) }
  }
  return bad
}
