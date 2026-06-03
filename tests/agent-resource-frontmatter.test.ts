import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd()
  }
}))

describe('agent resource frontmatter parsing', async () => {
  const { parseFrontmatterField } = await import('../electron/agent/skills')

  it('parses Chinese title and description with Windows CRLF line endings', () => {
    const md = [
      '---',
      'name: voice-differentiation',
      'title: "人物语态区分"',
      'description: "当让不同角色的台词彼此可辨时使用。"',
      '---',
      '',
      '# 人物语态区分'
    ].join('\r\n')

    expect(parseFrontmatterField(md, 'title')).toBe('人物语态区分')
    expect(parseFrontmatterField(md, 'description')).toBe('当让不同角色的台词彼此可辨时使用。')
  })
})
