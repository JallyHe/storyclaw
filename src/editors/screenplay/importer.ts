import { normalizeDialogueCandidate, serializeScreenplayMarkup, splitDialogueLine } from './markup'

export interface ImportedScreenplayTextOptions {
  text: string
  title: string
  episode?: string
}

const SCENE_RE = /^(?:#\s*)?(?:第\s*)?\d+\s*[场場](?:\s|$)/
const FOUNTAIN_SCENE_RE = /^(?:INT|EXT|INT\/EXT|I\/E)\.?\s+/i
const TRANSITION_RE = /^(?:>\s*)?(切至|转场|淡入|淡出|闪回|闪回至|叠化|黑场|字幕|画外音)[：:\s]?.{0,30}$/

export function formatImportedScreenplayText(options: ImportedScreenplayTextOptions): string {
  const title = sanitizeMetadata(options.title) || '导入剧本'
  const episode = sanitizeMetadata(options.episode ?? 'EP') || 'EP'
  const lines = normalizeExtractedText(options.text)
  const bodyLines: string[] = []
  let lastWasBlank = false

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line || isPageNoise(line)) {
      pushBlank(bodyLines, lastWasBlank)
      lastWasBlank = true
      continue
    }

    const formatted = formatImportedLine(line)
    if (!formatted) continue
    if (bodyLines.length > 0 && !lastWasBlank) bodyLines.push('')
    bodyLines.push(formatted)
    lastWasBlank = false
  }

  const header = serializeScreenplayMarkup({
    version: 1,
    episode,
    title,
    status: 'wip',
    logline: '',
    blocks: []
  }).split('\n\n')[0]

  return `${header}\n\n${bodyLines.join('\n').trim()}`.trimEnd()
}

function normalizeExtractedText(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\f/g, '\n')
    .split('\n')
}

function normalizeLine(line: string): string {
  return line.replace(/[ \t]+/g, ' ').replace(/^\s+|\s+$/g, '')
}

function formatImportedLine(line: string): string {
  if (line.startsWith('# ')) return line
  if (isSceneLine(line)) return `# ${normalizeSceneLine(line)}`
  if (line.startsWith('> ')) return line
  if (TRANSITION_RE.test(line)) return `> ${line.replace(/^>\s*/, '')}`
  const dialogue = splitDialogueLine(normalizeDialogueCandidate(line))
  if (dialogue) return dialogue.text
  return line
}

function isSceneLine(line: string): boolean {
  return SCENE_RE.test(line) || FOUNTAIN_SCENE_RE.test(line)
}

function normalizeSceneLine(line: string): string {
  const clean = line.replace(/^#\s*/, '').trim()
  const fountain = clean.match(FOUNTAIN_SCENE_RE)
  if (!fountain) return clean
  const intext = /^EXT/i.test(fountain[0])
    ? '外景'
    : /^INT\/EXT|^I\/E/i.test(fountain[0])
      ? '内外景'
      : '内景'
  return clean.replace(FOUNTAIN_SCENE_RE, '').replace(/\s+-\s+/, ` ${intext} `).trim()
}

function isPageNoise(line: string): boolean {
  return /^\d{1,4}$/.test(line) || /^第\s*\d+\s*页$/.test(line)
}

function pushBlank(lines: string[], lastWasBlank: boolean): void {
  if (lines.length === 0 || lastWasBlank) return
  lines.push('')
}

function sanitizeMetadata(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}
