import { describe, expect, it } from 'vitest'
import { assertToolAllowed, getModeConfig } from '../electron/agent/policy'

describe('agent mode policy', () => {
  it('allows craft mode to use every StoryClaw tool', () => {
    const config = getModeConfig('craft')

    expect(config.allowedTools).toEqual([
      'list_workspace',
      'read_screenplay',
      'read_reference',
      'write_screenplay',
      'spawn_subagent'
    ])
    expect(() => assertToolAllowed('craft', 'write_screenplay')).not.toThrow()
    expect(() => assertToolAllowed('craft', 'spawn_subagent')).not.toThrow()
  })

  it('forbids sub-agent dispatch outside craft mode', () => {
    expect(() => assertToolAllowed('plan', 'spawn_subagent')).toThrow(/Plan mode/)
    expect(() => assertToolAllowed('ask', 'spawn_subagent')).toThrow(/Ask mode/)
  })

  it('keeps plan mode read-only', () => {
    expect(getModeConfig('plan').allowedTools).toEqual([
      'list_workspace',
      'read_screenplay',
      'read_reference'
    ])
    expect(() => assertToolAllowed('plan', 'write_screenplay')).toThrow(/Plan mode/)
  })

  it('keeps ask mode read-only and concise', () => {
    expect(getModeConfig('ask').allowedTools).toEqual([
      'list_workspace',
      'read_screenplay',
      'read_reference'
    ])
    expect(getModeConfig('ask').systemSuffix).toContain('只回答问题')
    expect(() => assertToolAllowed('ask', 'write_screenplay')).toThrow(/Ask mode/)
  })
})
