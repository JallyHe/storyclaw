import type { Block, DialogueBlock, EpFile, SceneBlock } from '../../types'

const DIALOGUE_RE = /^([\u4e00-\u9fa5A-Za-z0-9·\s]{1,20})(?:\s*[（(]\s*([^）)]+?)\s*[）)])?\s*[:：]\s*(["“”'‘’]?[\s\S]*)$/

export function parseScreenplayMarkup(raw: string, fallback?: Partial<EpFile>): EpFile {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) {
    return {
      version: 1,
      episode: fallback?.episode ?? 'EP',
      title: fallback?.title ?? '',
      status: fallback?.status ?? 'todo',
      logline: fallback?.logline ?? '',
      blocks: []
    }
  }

  const multi = parseMultiEpisodeMarkup(text, fallback)
  if (multi) return multi

  return parseSingleScreenplayMarkup(text, fallback)
}

function parseSingleScreenplayMarkup(raw: string, fallback?: Partial<EpFile>): EpFile {
  const text = raw.replace(/\r\n/g, '\n').trim()
  const lines = text.split('\n')
  const blocks: Block[] = []
  const metadata: Partial<EpFile> = {}
  let paragraph: string[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const metaLine = lines[lineIndex].trim()
    const metaMatch = metaLine.match(/^@(\w+)\s*:\s*(.*)$/)
    if (!metaMatch) break
    const [, key, value] = metaMatch
    if (key === 'episode') metadata.episode = value
    if (key === 'title') metadata.title = value
    if (key === 'status' && (value === 'todo' || value === 'wip' || value === 'done')) metadata.status = value
    if (key === 'logline') metadata.logline = value
    lineIndex += 1
  }

  const flushParagraph = () => {
    const content = paragraph.join('\n').trim()
    paragraph = []
    if (!content) return
    blocks.push({
      id: blockId('action', content, blocks),
      type: 'action',
      text: content
    })
  }

  for (const rawLine of lines.slice(lineIndex)) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      continue
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph()
      const sceneText = trimmed.slice(2).trim()
      const scene = parseSceneMarkup(sceneText)
      blocks.push({
        ...scene,
        id: blockId('scene', sceneText, blocks)
      })
      continue
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph()
      blocks.push({
        id: blockId('transition', trimmed.slice(2).trim(), blocks),
        type: 'transition',
        text: trimmed.slice(2).trim()
      })
      continue
    }

    const normalizedDialogue = normalizeDialogueCandidate(trimmed)
    const dialogue = splitDialogueLine(normalizedDialogue)
    if (dialogue) {
      flushParagraph()
      blocks.push({
        id: blockId('dialogue', dialogue.text, blocks),
        type: 'dialogue',
        text: dialogue.text
      })
      continue
    }

    paragraph.push(trimmed)
  }

  flushParagraph()

  return {
    version: 1,
    episode: metadata.episode ?? fallback?.episode ?? 'EP',
    title: metadata.title ?? fallback?.title ?? '',
    status: metadata.status ?? fallback?.status ?? 'wip',
    logline: metadata.logline ?? fallback?.logline ?? '',
    blocks
  }
}

function parseMultiEpisodeMarkup(text: string, fallback?: Partial<EpFile>): EpFile | null {
  const lines = text.split('\n')
  const episodeStarts = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(item => /^@episode\s*:/i.test(item.line))
    .map(item => item.index)

  if (episodeStarts.length <= 1) return null

  const series = lines
    .slice(0, episodeStarts[0])
    .map(line => line.trim())
    .find(line => /^@series\s*:/i.test(line))
    ?.replace(/^@series\s*:\s*/i, '')
    .trim()

  const episodes = episodeStarts.map((start, index) => {
    const end = episodeStarts[index + 1] ?? lines.length
    return parseSingleScreenplayMarkup(lines.slice(start, end).join('\n'), fallback)
  })
  const first = episodes[0]
  return {
    ...first,
    series: series || fallback?.series,
    episodes
  }
}

export function serializeScreenplayMarkup(file: EpFile): string {
  if (file.episodes && file.episodes.length > 1) {
    const seriesLines = file.series ? [`@series: ${file.series}`, ''] : []
    return [
      ...seriesLines,
      file.episodes.map(episode => serializeSingleScreenplayMarkup(episode)).join('\n\n')
    ].join('\n').trim()
  }
  return serializeSingleScreenplayMarkup(file)
}

function serializeSingleScreenplayMarkup(file: EpFile): string {
  const metadataLines = [
    metaLine('episode', file.episode || 'EP'),
    metaLine('title', file.title || ''),
    metaLine('status', file.status || 'wip'),
    ...(file.logline ? [metaLine('logline', file.logline)] : [])
  ]
  const body = file.blocks.map(block => {
    if (block.type === 'scene') return `# ${formatSceneMarkup(block)}`
    if (block.type === 'transition') return `> ${block.text.trim()}`
    if (block.type === 'dialogue') return normalizeDialogueCandidate(block.text)
    if (block.type === 'character') return `${block.name}${block.ext ? `（${block.ext}）` : ''}`
    if (block.type === 'paren') return `（${block.text.trim()}）`
    return block.text.trim()
  }).filter(Boolean).join('\n\n')
  return `${metadataLines.join('\n')}\n\n${body}`.trim()
}

function metaLine(key: string, value: string) {
  const trimmed = value.trim()
  return trimmed ? `@${key}: ${trimmed}` : `@${key}:`
}

export function exportScreenplayAsTxt(file: EpFile): string {
  return exportEpisodes(file, episode => {
    const title = formatExportTitle(episode)
    const body = episode.blocks.map(block => {
    if (block.type === 'scene') return formatSceneMarkup(block)
    if (block.type === 'transition') return block.text.trim()
    return 'text' in block ? block.text.trim() : block.name.trim()
    }).filter(Boolean).join('\n\n')
    return [title, body].filter(Boolean).join('\n\n')
  }).join('\n\n')
}

export function exportScreenplayAsFountain(file: EpFile): string {
  const episodes = getExportEpisodes(file)
  if (episodes.length > 1) {
    return episodes.map(episode => {
      const title = formatExportTitle(episode)
      const body = exportFountainBody(episode)
      return [title ? `# ${title}` : '', body].filter(Boolean).join('\n\n')
    }).join('\n\n')
  }
  const title = formatExportTitle(file)
  const body = exportFountainBody(file)
  return [title ? `Title: ${title}` : '', body].filter(Boolean).join('\n\n')
}

function exportFountainBody(file: EpFile): string {
  return file.blocks.flatMap(block => {
    if (block.type === 'scene') return [formatFountainScene(block)]
    if (block.type === 'action') return [block.text.trim()]
    if (block.type === 'transition') return [`> ${block.text.trim()}`]
    if (block.type === 'dialogue') return fountainDialogueLines(block)
    return []
  }).filter(Boolean).join('\n\n')
}

export function screenplayToHtml(file: EpFile): string {
  const body = exportEpisodes(file, episode => screenplayEpisodeToHtml(episode)).join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(file.title || file.series || file.episode || '剧本')}</title>
<style>
body{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;padding:48px 56px;color:#111;font-size:13pt;line-height:1.8}
.scene{font-weight:700;margin:18px 0 8px}
.action,.dialogue,.transition{margin:10px 0}
.transition{text-align:right;font-weight:700}
strong{font-weight:700}
em{font-style:italic}
</style>
</head>
<body>
${body}
</body>
</html>`
}

function screenplayEpisodeToHtml(file: EpFile): string {
  const body = file.blocks.map(block => {
    if (block.type === 'scene') return `<p class="scene">${escapeHtmlWithBreaks(formatSceneMarkup(block))}</p>`
    if (block.type === 'action') return `<p class="action">${escapeHtmlWithBreaks(block.text)}</p>`
    if (block.type === 'transition') return `<p class="transition">${escapeHtmlWithBreaks(block.text)}</p>`
    if (block.type === 'dialogue') {
      const parsed = splitDialogueLine(normalizeDialogueCandidate(block.text))
      if (!parsed) return `<p class="dialogue">${escapeHtmlWithBreaks(block.text)}</p>`
      return `<p class="dialogue"><strong>${escapeHtml(parsed.speaker)}</strong>${parsed.ext ? `<em>（${escapeHtml(parsed.ext)}）</em>` : ''}：${escapeHtmlWithBreaks(parsed.content)}</p>`
    }
    return ''
  }).join('\n')
  return `${formatExportTitle(file) ? `<h1>${escapeHtml(formatExportTitle(file))}</h1>` : ''}
${body}`
}

function formatExportTitle(file: EpFile) {
  return file.title.trim()
}

function getExportEpisodes(file: EpFile) {
  return file.episodes && file.episodes.length > 1 ? file.episodes : [file]
}

function exportEpisodes(file: EpFile, render: (episode: EpFile) => string) {
  return getExportEpisodes(file).map(render).filter(Boolean)
}

function parseSceneMarkup(text: string): SceneBlock {
  const parsed = parseSceneHeadingMarkup(text)
  return {
    id: '',
    type: 'scene',
    number: parsed.number,
    location: parsed.location,
    intext: parsed.intext,
    time: parsed.time,
    synopsis: ''
  }
}

export function parseSceneHeadingMarkup(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const number = normalized.match(/^第\s*(\d+)\s*场/i)?.[1] ?? ''
  const intext = normalized.match(/(?:^|\s)(内景|外景|内外景)(?:\s|$)/)?.[1] ?? ''
  const time = normalized.match(/(?:^|\s)(清晨|早晨|上午|中午|下午|傍晚|黄昏|夜|日)(?:\s|$)/)?.[1] ?? ''
  const location = normalized
    .replace(/^第\s*\d+\s*场/i, '')
    .replace(/(?:^|\s)(内景|外景|内外景)(?=\s|$)/g, ' ')
    .replace(/(?:^|\s)(清晨|早晨|上午|中午|下午|傍晚|黄昏|夜|日)(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { number, intext, location, time }
}

export function formatSceneMarkup(block: Extract<Block, { type: 'scene' }>) {
  return [`第 ${block.number || '1'} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ')
}

export function normalizeDialogueCandidate(line: string): string {
  const match = line.match(/^([\u4e00-\u9fa5A-Za-z0-9·\s]{1,20})(.*)$/)
  if (!match) return line.trim()
  let prefix = match[1].trim().replace(/\s+/g, '')
  let rest = match[2]
    .replace(/\s*（\s*/g, '（')
    .replace(/\s*\)\s*/g, '）')
    .replace(/\s*\(\s*/g, '（')
    .replace(/\s*）\s*/g, '）')
    .replace(/\s*[:：]\s*/g, '：')
  if (rest.startsWith('（') || rest.startsWith('：')) return `${prefix}${rest}`
  return `${prefix}${rest}`.trim()
}

export function splitDialogueLine(line: string): { speaker: string; ext?: string; content: string; text: string } | null {
  const match = line.match(DIALOGUE_RE)
  if (!match) return null
  const speaker = match[1].replace(/\s+/g, '').trim()
  const ext = match[2]?.trim()
  const content = match[3].trim()
  if (!speaker || !content) return null
  return {
    speaker,
    ext,
    content,
    text: `${speaker}${ext ? `（${ext}）` : ''}：${content}`
  }
}

function fountainDialogueLines(block: DialogueBlock): string[] {
  const parsed = splitDialogueLine(normalizeDialogueCandidate(block.text))
  if (!parsed) return [block.text.trim()]
  const lines = [parsed.speaker]
  if (parsed.ext) lines.push(`(${parsed.ext})`)
  lines.push(parsed.content)
  return lines
}

function formatFountainScene(block: Extract<Block, { type: 'scene' }>) {
  const intextMap: Record<string, string> = {
    '内景': 'INT.',
    '外景': 'EXT.',
    '内外景': 'INT./EXT.'
  }
  const head = intextMap[block.intext] ?? '.'
  const location = block.location || '未命名场景'
  const time = block.time || 'DAY'
  if (head === '.') return `. ${formatSceneMarkup(block)}`
  return `${head} ${location} - ${time}`
}

function blockId(type: Block['type'], text: string, blocks: Block[]) {
  const normalized = `${type}:${text}`.trim()
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index)
    hash |= 0
  }
  const sameCount = blocks.filter(block => block.type === type).length + 1
  return `${type}-${Math.abs(hash).toString(36)}-${sameCount}`
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlWithBreaks(text: string) {
  return escapeHtml(text).replace(/\n/g, '<br>')
}
