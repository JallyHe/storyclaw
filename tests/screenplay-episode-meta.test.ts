import { describe, expect, it } from 'vitest'
import { episodeCodeFromNumber, episodeLabel, episodeNumberFromCode } from '../src/editors/screenplay/episodeMeta'

describe('screenplay episode metadata', () => {
  it('maps editable episode numbers to EP codes', () => {
    expect(episodeCodeFromNumber('1')).toBe('EP01')
    expect(episodeCodeFromNumber('12')).toBe('EP12')
  })

  it('extracts display numbers and labels from EP codes', () => {
    expect(episodeNumberFromCode('EP03')).toBe('3')
    expect(episodeLabel('EP03')).toBe('第3集')
  })
})
