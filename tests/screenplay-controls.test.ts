import { describe, expect, it } from 'vitest'
import { cycleScreenplayLineType, parseScreenplaySlashType } from '../src/editors/screenplay/controls'

describe('screenplay controls', () => {
  it('cycles line types in screenplay order with tab and reverse tab', () => {
    expect(cycleScreenplayLineType('scene')).toBe('action')
    expect(cycleScreenplayLineType('action')).toBe('dialogue')
    expect(cycleScreenplayLineType('transition')).toBe('scene')
    expect(cycleScreenplayLineType('scene', -1)).toBe('transition')
    expect(cycleScreenplayLineType('dialogue', -1)).toBe('action')
  })

  it('parses slash aliases for screenplay line types', () => {
    expect(parseScreenplaySlashType('/scene')).toBe('scene')
    expect(parseScreenplaySlashType('/场头')).toBe('scene')
    expect(parseScreenplaySlashType('/动作')).toBe('action')
    expect(parseScreenplaySlashType('/character')).toBe('character')
    expect(parseScreenplaySlashType('/对白')).toBe('dialogue')
    expect(parseScreenplaySlashType('/括注')).toBe('paren')
    expect(parseScreenplaySlashType('/转场')).toBe('transition')
    expect(parseScreenplaySlashType('/unknown')).toBeNull()
  })
})
