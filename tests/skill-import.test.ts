import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { installSkillPackage } from '../electron/agent/skillImport'

describe('skill import', () => {
  it('installs a skill folder into the workspace .storyclaw skills directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'storyclaw-workspace-'))
    const source = join(root, 'source-skill')
    await mkdir(source, { recursive: true })
    await writeFile(join(source, 'SKILL.md'), [
      '---',
      'name: imported-skill',
      'title: "导入技能"',
      'description: "用于测试导入的技能"',
      '---',
      '',
      '# 导入技能'
    ].join('\n'))

    const result = await installSkillPackage(root, source)

    expect(result.name).toBe('imported-skill')
    expect(result.targetDir).toBe(join(root, '.storyclaw', 'skills', 'imported-skill'))
    expect(existsSync(join(result.targetDir, 'SKILL.md'))).toBe(true)
    expect(readFileSync(join(result.targetDir, 'SKILL.md'), 'utf8')).toContain('用于测试导入的技能')
  })

  it('rejects folders without SKILL.md', async () => {
    const root = mkdtempSync(join(tmpdir(), 'storyclaw-workspace-'))
    const source = join(root, 'bad-skill')
    await mkdir(source, { recursive: true })

    await expect(installSkillPackage(root, source)).rejects.toThrow('SKILL.md')
  })
})
