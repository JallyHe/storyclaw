import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { importScreenplayFile } from '../electron/fs/workspace'
import { formatImportedScreenplayText } from '../src/editors/screenplay/importer'

describe('screenplay importer', () => {
  it('formats imported script text as screenplay markup', () => {
    const text = [
      '1场 客厅 日',
      '张三：我们开始吧。',
      '切至：',
      '普通动作描述。'
    ].join('\n')

    const markup = formatImportedScreenplayText({ text, title: '样例剧本' })

    expect(markup).toContain('@title: 样例剧本')
    expect(markup).toContain('@status: wip')
    expect(markup).toContain('# 1场 客厅 日')
    expect(markup).toContain('张三：我们开始吧。')
    expect(markup).toContain('> 切至：')
  })

  it('imports txt as ep and deduplicates target names', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'storyclaw-import-'))
    const targetDir = path.join(root, '剧集')
    const source = path.join(root, '导入.txt')
    await writeFile(source, '1场 街边 夜\n李四：走。', 'utf-8')

    const first = await importScreenplayFile(root, source, targetDir)
    const second = await importScreenplayFile(root, source, targetDir)

    expect(first.name).toBe('导入.ep')
    expect(second.name).toBe('导入 (1).ep')
    await expect(readFile(first.absPath, 'utf-8')).resolves.toContain('@title: 导入')
  })
})
