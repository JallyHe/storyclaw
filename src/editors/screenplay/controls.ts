import type { ScreenplayLineType } from './schema'

export const SCREENPLAY_LINE_ORDER: ScreenplayLineType[] = [
  'scene',
  'action',
  'dialogue',
  'transition'
]

const SCREENPLAY_SLASH_ALIASES: Record<string, ScreenplayLineType> = {
  '/scene': 'scene',
  '/场头': 'scene',
  '/场次': 'scene',
  '/action': 'action',
  '/动作': 'action',
  '/dialogue': 'dialogue',
  '/对白': 'dialogue',
  '/character': 'character',
  '/人物': 'character',
  '/对白人物': 'character',
  '/paren': 'paren',
  '/括注': 'paren',
  '/括号': 'paren',
  '/transition': 'transition',
  '/转场': 'transition'
}

export function cycleScreenplayLineType(current: ScreenplayLineType, direction: 1 | -1 = 1): ScreenplayLineType {
  if (current === 'character' || current === 'paren') return direction === 1 ? 'dialogue' : 'action'
  const index = SCREENPLAY_LINE_ORDER.indexOf(current)
  const safeIndex = index >= 0 ? index : 0
  const nextIndex = (safeIndex + direction + SCREENPLAY_LINE_ORDER.length) % SCREENPLAY_LINE_ORDER.length
  return SCREENPLAY_LINE_ORDER[nextIndex]
}

export function parseScreenplaySlashType(input: string): ScreenplayLineType | null {
  const normalized = input.trim().toLowerCase()
  return SCREENPLAY_SLASH_ALIASES[normalized] ?? null
}
