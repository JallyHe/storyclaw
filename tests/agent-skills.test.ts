import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// 内置技能/专家资源完整性测试：守护 agents、skills 与 agent-skills.json 不漂移。
// 直接读磁盘资源，避免引入依赖 electron 的 skills.ts。
const AGENT_DIR = resolve(__dirname, '../electron/agent')
const SKILLS = resolve(AGENT_DIR, 'skills')
const AGENTS = resolve(AGENT_DIR, 'agents')

const DISPATCHABLE = [
  'concept-planner', 'market-analyst', 'ip-developer',
  'research-analyst', 'worldbuilder', 'character-designer',
  'story-architect', 'episode-outliner', 'scene-writer', 'dialogue-polisher',
  'chief-editor', 'logic-checker', 'drama-reviewer', 'compliance-reviewer', 'feasibility-analyst'
]

const CATEGORIES = ['creative', 'setting', 'writing', 'review']

function frontmatterName(md: string): string | undefined {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return undefined
  const line = m[1].split('\n').find(l => l.startsWith('name:'))
  return line?.slice('name:'.length).trim()
}

function frontmatterField(md: string, field: string): string | undefined {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return undefined
  const line = m[1].split('\n').find(l => l.startsWith(`${field}:`))
  return line?.slice(`${field}:`.length).trim().replace(/^"|"$/g, '')
}

function frontmatterDescription(md: string): string | undefined {
  return frontmatterField(md, 'description')
}

describe('agent skills & experts resources', () => {
  it('每个可派发阶段都有对应的 agent 定义文件，且 frontmatter name 一致', () => {
    for (const agent of DISPATCHABLE) {
      const file = resolve(AGENTS, `${agent}.md`)
      expect(existsSync(file), `缺少 agent 文件：${agent}.md`).toBe(true)
      const md = readFileSync(file, 'utf8')
      expect(frontmatterName(md)).toBe(agent)
      expect(frontmatterDescription(md)?.length ?? 0).toBeGreaterThan(0)
      // 正文非空（去掉 frontmatter 后）
      expect(md.split('---').slice(2).join('---').trim().length).toBeGreaterThan(50)
    }
  })

  it('stage-skills.json 中引用的每个 skill 都存在且 frontmatter name 匹配目录名', () => {
    const map = JSON.parse(readFileSync(resolve(AGENT_DIR, 'agent-skills.json'), 'utf8')) as Record<string, string[]>
    const referenced = new Set<string>()
    for (const list of Object.values(map)) list.forEach(s => referenced.add(s))
    expect(referenced.size).toBeGreaterThan(0)

    for (const skill of referenced) {
      const file = resolve(SKILLS, skill, 'SKILL.md')
      expect(existsSync(file), `缺少 skill：${skill}/SKILL.md`).toBe(true)
      const md = readFileSync(file, 'utf8')
      expect(frontmatterName(md), `skill frontmatter name 不匹配：${skill}`).toBe(skill)
      expect(frontmatterDescription(md)?.length ?? 0, `skill 缺少 description：${skill}`).toBeGreaterThan(0)
    }
  })

  it('stage-skills.json 的键集合等于全部阶段 agent', () => {
    const map = JSON.parse(readFileSync(resolve(AGENT_DIR, 'agent-skills.json'), 'utf8')) as Record<string, string[]>
    const keys = Object.keys(map).sort()
    expect(keys).toEqual([...DISPATCHABLE].sort())
  })

  it('不再包含已移除的总调度 orchestrator', () => {
    expect(existsSync(resolve(AGENTS, 'script-pipeline-orchestrator.md'))).toBe(false)
  })

  it('skill 与 agent 的 frontmatter 都带 title（供选择器展示）', () => {
    for (const agent of DISPATCHABLE) {
      const md = readFileSync(resolve(AGENTS, `${agent}.md`), 'utf8')
      expect((frontmatterField(md, 'title') ?? '').length, `agent 缺 title：${agent}`).toBeGreaterThan(0)
    }
    for (const d of readdirSync(SKILLS, { withFileTypes: true }).filter(x => x.isDirectory())) {
      const md = readFileSync(resolve(SKILLS, d.name, 'SKILL.md'), 'utf8')
      expect((frontmatterField(md, 'title') ?? '').length, `skill 缺 title：${d.name}`).toBeGreaterThan(0)
    }
  })

  it('每个专家都有合法 category（供选择器分组）', () => {
    for (const agent of DISPATCHABLE) {
      const md = readFileSync(resolve(AGENTS, `${agent}.md`), 'utf8')
      const cat = frontmatterField(md, 'category')
      expect(CATEGORIES.includes(cat ?? ''), `专家 category 非法：${agent} → ${cat}`).toBe(true)
    }
  })

  it('磁盘上每个 skill 目录都是合法 skill 根（含 SKILL.md）', () => {
    const dirs = readdirSync(SKILLS, { withFileTypes: true }).filter(d => d.isDirectory())
    expect(dirs.length).toBeGreaterThanOrEqual(30)
    for (const d of dirs) {
      expect(existsSync(resolve(SKILLS, d.name, 'SKILL.md')), `${d.name} 缺少 SKILL.md`).toBe(true)
    }
  })
})
