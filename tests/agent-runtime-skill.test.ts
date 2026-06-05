import { describe, expect, it } from 'vitest'
import { buildPermissionInstruction, buildPromptBody, extractExplicitSkillRequest } from '../electron/agent/runtime'

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

  it('tells craft default permission to trigger authorization through tools', () => {
    const instruction = buildPermissionInstruction('craft', 'default')

    expect(instruction).toContain('自动弹出用户授权框')
    expect(instruction).toContain('必须先调用对应工具触发授权')
    expect(instruction).toContain('不要在未调用工具前回复')
    expect(instruction).toContain('无法访问互联网')
    expect(instruction).toContain('无法执行 npx')
  })
})
