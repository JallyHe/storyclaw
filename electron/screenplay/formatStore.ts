// ── 剧本格式模板持久化（全局） ───────────────────────────────────────────────
// 内置模板随应用分发；AI 学会的新模板存到 userData/screenplay/format-templates.json，
// 所有项目共享。读取时把内置 + 学会的合并返回。

import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import {
  DEFAULT_TEMPLATES,
  validateTemplate,
  type FormatTemplate
} from '../../src/editors/screenplay/formatTemplates'

function storeDir(): string {
  return path.join(app.getPath('userData'), 'screenplay')
}
function storePath(): string {
  return path.join(storeDir(), 'format-templates.json')
}

async function loadLearned(): Promise<FormatTemplate[]> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(t => t && typeof t.id === 'string' && Array.isArray(t.scene))
      .map(t => ({ ...t, builtin: false }))
  } catch (err: any) {
    if (err?.code !== 'ENOENT') console.error('[格式模板] 读取失败:', err)
    return []
  }
}

/** 内置 + 学会的全部模板。 */
export async function loadAllTemplates(): Promise<FormatTemplate[]> {
  const learned = await loadLearned()
  const learnedIds = new Set(learned.map(t => t.id))
  // 学会的同 id 覆盖内置（允许用户改进内置规则）
  return [...DEFAULT_TEMPLATES.filter(t => !learnedIds.has(t.id)), ...learned]
}

/** 保存/更新一个学会的模板，返回保存后的模板。 */
export async function saveLearnedTemplate(input: {
  id?: string
  name: string
  description?: string
  scene: string[]
  transition: string[]
  dialogue: string[]
}): Promise<FormatTemplate> {
  const bad = validateTemplate(input)
  if (bad.length) throw new Error(`以下正则非法，无法保存：${bad.join(' | ')}`)
  if (!input.name?.trim()) throw new Error('模板名称不能为空')

  const learned = await loadLearned()
  const id = input.id?.trim() || `learned-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const template: FormatTemplate = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    builtin: false,
    scene: input.scene ?? [],
    transition: input.transition ?? [],
    dialogue: input.dialogue ?? []
  }
  const next = [...learned.filter(t => t.id !== id), template]
  await fs.mkdir(storeDir(), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(next, null, 2), 'utf8')
  return template
}
