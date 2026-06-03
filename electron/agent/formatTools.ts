// ── 剧本格式化工具（供 screenplay-formatting 技能调用） ───────────────────────
import { defineTool } from '@earendil-works/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import {
  applyTemplate,
  isConfidentMatch,
  rankTemplates,
  validateTemplate,
  type FormatTemplate
} from '../../src/editors/screenplay/formatTemplates'
import { loadAllTemplates, saveLearnedTemplate } from '../screenplay/formatStore'

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }], details: {} }
}

/** 用一段原文匹配最合适的格式模板。 */
export const matchScreenplayFormat = defineTool({
  name: 'match_screenplay_format',
  label: '匹配剧本格式',
  description: '把一段原始剧本文本与已有格式模板逐一打分，返回最匹配的模板及结构化统计（场次/转场/对白/描述行数与占比）。命中可信时建议直接用 apply_format_template 套用；否则需要你新造规则。',
  parameters: Type.Object({
    text: Type.String({ description: '原始剧本文本（可只取前若干段做格式判断）' })
  }),
  execute: async (_id, { text: raw }) => {
    const templates = await loadAllTemplates()
    const ranked = rankTemplates(String(raw ?? ''), templates).slice(0, 4)
    if (ranked.length === 0) return text('当前没有任何格式模板。')
    const best = ranked[0]
    const lines = ranked.map(({ template, stats }) =>
      `- ${template.id}（${template.name}）: 共${stats.total}行 / 场次${stats.scene} 转场${stats.transition} 对白${stats.dialogue} 描述${stats.action}，结构化占比 ${(stats.ratio * 100).toFixed(0)}%`
    )
    const verdict = isConfidentMatch(best.stats)
      ? `✅ 推荐套用模板「${best.template.id}」（${best.template.name}）：调用 apply_format_template(templateId="${best.template.id}")。`
      : `⚠️ 没有足够可信的模板命中。请分析这段文本的场次头/转场/对白写法，自造正则规则，用 apply_format_template 传入 template 试跑，达标后用 save_format_template 保存。`
    return text(`格式匹配结果：\n${lines.join('\n')}\n\n${verdict}`)
  }
})

const TemplateShape = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  scene: Type.Array(Type.String()),
  transition: Type.Array(Type.String()),
  dialogue: Type.Array(Type.String({ description: '需含 2 个捕获组：1=人物，2=台词' }))
})

/** 套用模板把原文转成 .ep 轻标记。可传 templateId 用已有模板，或传 template 试跑新规则。 */
export const applyFormatTemplate = defineTool({
  name: 'apply_format_template',
  label: '套用格式模板',
  description: '按指定模板把原始剧本文本转换成 StoryClaw 的 .ep 轻标记格式并返回结果。templateId 用已保存模板；或传入 template（自造规则）先试跑。返回转换后的 .ep 文本、统计与仍被判为「描述」的样例行。满意后用 write_screenplay 写入 .ep 文件。',
  parameters: Type.Object({
    text: Type.String({ description: '原始剧本文本' }),
    title: Type.String({ description: '剧本标题（写入 @title）' }),
    episode: Type.Optional(Type.String({ description: '剧集标识，默认 EP' })),
    templateId: Type.Optional(Type.String({ description: '已有模板 id（与 template 二选一）' })),
    template: Type.Optional(TemplateShape)
  }),
  execute: async (_id, args) => {
    const raw = String(args.text ?? '')
    const title = String(args.title ?? '导入剧本')
    const episode = args.episode ? String(args.episode) : undefined

    let template: FormatTemplate | undefined
    if (args.template) {
      const bad = validateTemplate(args.template as any)
      if (bad.length) return text(`正则非法，无法试跑：${bad.join(' | ')}`)
      template = { id: 'preview', builtin: false, ...(args.template as any) }
    } else if (args.templateId) {
      template = (await loadAllTemplates()).find(t => t.id === args.templateId)
      if (!template) return text(`找不到模板：${args.templateId}`)
    } else {
      return text('请提供 templateId 或 template。')
    }
    if (!template) return text('未找到可用模板。')

    const { markup, stats, unmatchedSamples } = applyTemplate(raw, template, { title, episode })
    const summary = `转换完成：场次${stats.scene} 转场${stats.transition} 对白${stats.dialogue} 描述${stats.action}（结构化占比 ${(stats.ratio * 100).toFixed(0)}%）。`
    const warn = unmatchedSamples.length
      ? `\n\n仍被判为「描述」的样例（若其中有对白/场次/转场，请补充规则后重试）：\n${unmatchedSamples.map(s => `· ${s}`).join('\n')}`
      : ''
    return text(`${summary}${warn}\n\n———— 格式化结果（.ep）————\n${markup}`)
  }
})

/** 保存一个新的格式模板，供下次直接命中。 */
export const saveFormatTemplate = defineTool({
  name: 'save_format_template',
  label: '保存格式模板',
  description: '把你新造并验证可用的格式规则保存为模板（全局共享），下次遇到同类格式可直接命中套用。dialogue 正则必须含 2 个捕获组（1=人物，2=台词）。',
  parameters: Type.Object({
    name: Type.String({ description: '模板名称，如「竖屏短剧·括号说明体」' }),
    description: Type.Optional(Type.String()),
    scene: Type.Array(Type.String({ description: '场次头正则' })),
    transition: Type.Array(Type.String({ description: '转场正则' })),
    dialogue: Type.Array(Type.String({ description: '对白正则（含 2 个捕获组）' }))
  }),
  execute: async (_id, args) => {
    try {
      const saved = await saveLearnedTemplate({
        name: String(args.name ?? ''),
        description: args.description ? String(args.description) : undefined,
        scene: (args.scene ?? []) as string[],
        transition: (args.transition ?? []) as string[],
        dialogue: (args.dialogue ?? []) as string[]
      })
      return text(`✅ 模板已保存：${saved.id}（${saved.name}）。下次可用 apply_format_template(templateId="${saved.id}") 直接套用。`)
    } catch (err: any) {
      return text(`保存失败：${err?.message ?? String(err)}`)
    }
  }
})

export const FORMAT_TOOLS = [matchScreenplayFormat, applyFormatTemplate, saveFormatTemplate]
