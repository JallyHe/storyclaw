import { describe, expect, it } from 'vitest'
import { readSelectionTextFromRaw } from '../electron/agent/tools'

describe('agent read_selection helper', () => {
  it('reads markdown text by coordinates', () => {
    expect(readSelectionTextFromRaw('第一段\n第二段\n第三段', 'md', 4, 7)).toBe('第二段')
  })

  it('reads screenplay text by ProseMirror coordinates', () => {
    const raw = [
      '@episode: EP01',
      '@title: 第一集',
      '@status: wip',
      '',
      '# 第 1 场 客厅 内景 日',
      '',
      '门铃响了。'
    ].join('\n')

    const text = readSelectionTextFromRaw(raw, 'ep', 1, 40)
    expect(text).toContain('第 1 场')
    expect(text).toContain('门铃响了')
  })
})
