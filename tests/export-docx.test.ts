import { describe, expect, it } from 'vitest'
import { docxRunsForText } from '../electron/fs/export'

describe('docx export helpers', () => {
  it('turns embedded newlines into Word line breaks', () => {
    const runs = docxRunsForText('第一行\n第二行')

    expect(runs).toHaveLength(2)
    expect((runs[0] as any).root).toBeDefined()
    expect((runs[1] as any).root).toBeDefined()
  })
})
