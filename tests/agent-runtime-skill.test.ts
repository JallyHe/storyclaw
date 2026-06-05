import { describe, expect, it } from 'vitest'
import { buildPromptBody, extractExplicitSkillRequest } from '../electron/agent/runtime'

describe('agent runtime skill prompt handling', () => {
  it('extracts selected skill chips from the user request', () => {
    expect(extractExplicitSkillRequest('@skill:imported-skill 请处理当前剧本')).toEqual({
      skillName: 'imported-skill',
      requestText: '请处理当前剧本'
    })
  })

  it('keeps explicit slash skill commands at the beginning after context wrapping', () => {
    const body = buildPromptBody('/skill:imported-skill 请处理当前剧本', '模式：Craft', '附件内容')

    expect(body.startsWith('/skill:imported-skill ')).toBe(true)
    expect(body).toContain('模式：Craft')
    expect(body).toContain('用户请求：请处理当前剧本')
    expect(body).toContain('附件内容')
  })

  it('converts selected skill chips into pi skill commands before sending', () => {
    const body = buildPromptBody('@skill:imported-skill 请处理当前剧本', '模式：Craft', '')

    expect(body.startsWith('/skill:imported-skill ')).toBe(true)
    expect(body).toContain('用户请求：请处理当前剧本')
  })
})
