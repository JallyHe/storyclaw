import { nanoid } from './ids'
import { screenplaySchema, type ScreenplayLineType } from './schema'
import type { Block, EpFile } from '@/types'
import { episodeLabel } from './episodeMeta'

export type ScreenplayDocJSON = ReturnType<typeof screenplaySchema.nodeFromJSON>['type'] extends never
  ? never
  : any

export function epFileToScreenplayDoc(file: EpFile, options?: { includeEpisodeHeadings?: boolean }): ScreenplayDocJSON {
  if (options?.includeEpisodeHeadings) {
    const episodes = file.episodes && file.episodes.length > 1 ? file.episodes : [file]
    return {
      type: 'doc',
      content: episodes.flatMap((episode, index) => [
        episodeToNode(episode, index),
        ...episode.blocks.map(blockToNode)
      ])
    }
  }
  return {
    type: 'doc',
    content: file.blocks.map(blockToNode)
  }
}

export function screenplayDocToEpFile(base: EpFile, doc: ScreenplayDocJSON): EpFile {
  const content = Array.isArray(doc?.content) ? doc.content : []
  if (content.some((node: any) => node?.type === 'episode_heading')) {
    return docToEpisodeCollection(base, content)
  }
  const blocks = content
    .map(nodeToBlock)
    .filter((block): block is Block => !!block && !isEmptyTextBlock(block))
  return { ...base, blocks: blocks.length ? blocks : base.blocks }
}

export function inferScreenplayLineType(line: string): ScreenplayLineType {
  const text = line.trim()
  if (!text) return 'action'
  if (/^第\s*\d+\s*场/.test(text) || /(内景|外景|内外景|日|夜).*(第?\s*\d*\s*场)?/.test(text) && text.includes('场')) {
    return 'scene'
  }
  if (/^(切至|淡出|叠化|转至|CUT TO|FADE OUT)/i.test(text)) return 'transition'
  if (/^[（(].+[）)]$/.test(text)) return 'paren'
  if (/^[\u4e00-\u9fa5A-Za-z·\s]{1,16}(?:[（(][^）)]{1,24}[）)])?[：:]/.test(text)) return 'dialogue'
  return 'action'
}

export function parseSceneHeading(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const number = normalized.match(/第\s*(\d+)\s*场/)?.[1] ?? ''
  const intext = normalized.match(/(内景|外景|内外景)/)?.[1] ?? ''
  const time = normalized.match(/(清晨|早晨|上午|中午|下午|傍晚|黄昏|夜|日)/)?.[1] ?? ''
  const location = normalized
    .replace(/第\s*\d+\s*场/g, '')
    .replace(/内外景|内景|外景/g, '')
    .replace(/清晨|早晨|上午|中午|下午|傍晚|黄昏|夜|日/g, '')
    .trim()
  return { number, intext, location, time }
}

function blockToNode(block: Block) {
  if (block.type === 'scene') {
    return {
      type: 'scene_heading',
      attrs: {
        id: block.id,
        number: block.number,
        intext: block.intext,
        location: block.location,
        time: block.time,
        synopsis: block.synopsis
      },
      content: textContent(formatScene(block))
    }
  }
  if (block.type === 'character') {
    return {
      type: 'character',
      attrs: { id: block.id, name: block.name, ext: block.ext ?? '' },
      content: textContent(block.ext ? `${block.name}（${block.ext}）` : block.name)
    }
  }
  return {
    type: block.type,
    attrs: { id: block.id },
    content: textContent(block.text)
  }
}

function episodeToNode(episode: EpFile, index: number) {
  return {
    type: 'episode_heading',
    attrs: {
      id: `episode-${episode.episode || index + 1}`,
      episode: episode.episode,
      episodeLabel: episodeLabel(episode.episode, index + 1)
    },
    content: textContent(episode.title || episodeLabel(episode.episode, index + 1))
  }
}

function nodeToBlock(node: any): Block | null {
  const type = node?.type
  const text = nodeText(node)
  const id = node?.attrs?.id || nanoid()
  if (type === 'scene_heading') {
    const parsed = parseSceneHeading(text)
    return {
      id,
      type: 'scene',
      number: node.attrs?.number || parsed.number,
      intext: node.attrs?.intext || parsed.intext,
      location: node.attrs?.location || parsed.location,
      time: node.attrs?.time || parsed.time,
      synopsis: node.attrs?.synopsis || ''
    }
  }
  if (type === 'character') {
    return { id, type: 'character', name: node.attrs?.name || text, ext: node.attrs?.ext || undefined }
  }
  if (type === 'dialogue' || type === 'action' || type === 'paren' || type === 'transition') {
    return { id, type, text } as Block
  }
  return null
}

function docToEpisodeCollection(base: EpFile, content: any[]): EpFile {
  const sourceEpisodes = base.episodes && base.episodes.length > 0 ? base.episodes : [base]
  const episodes: EpFile[] = []
  let current: EpFile | null = null
  let currentBlocks: Block[] = []

  const flush = () => {
    if (!current) return
    episodes.push({ ...current, blocks: currentBlocks })
    current = null
    currentBlocks = []
  }

  for (const node of content) {
    if (node?.type === 'episode_heading') {
      flush()
      const fallback = sourceEpisodes[episodes.length] ?? sourceEpisodes[sourceEpisodes.length - 1] ?? base
      current = {
        ...fallback,
        episode: node.attrs?.episode || fallback.episode,
        title: nodeText(node).trim() || fallback.title,
        blocks: []
      }
      continue
    }

    const block = nodeToBlock(node)
    if (!block || isEmptyTextBlock(block)) continue
    if (!current) {
      const fallback = sourceEpisodes[0] ?? base
      current = { ...fallback, blocks: [] }
    }
    currentBlocks.push(block)
  }

  flush()

  if (episodes.length > 1) {
    return {
      ...episodes[0],
      series: base.series,
      episodes
    }
  }
  return episodes[0] ?? base
}

function formatScene(block: Extract<Block, { type: 'scene' }>) {
  return [`第 ${block.number} 场`, block.location, block.intext, block.time].filter(Boolean).join(' ')
}

function textContent(text: string) {
  if (!text) return undefined
  const content: Array<{ type: 'text'; text: string } | { type: 'hard_break' }> = []
  text.split('\n').forEach((part, index) => {
    if (index > 0) content.push({ type: 'hard_break' })
    if (part) content.push({ type: 'text', text: part })
  })
  return content.length ? content : undefined
}

function nodeText(node: any): string {
  return (node?.content ?? []).map((child: any) => child.type === 'hard_break' ? '\n' : child.text ?? '').join('')
}

function isEmptyTextBlock(block: Block) {
  if (block.type === 'scene') return false
  if (block.type === 'character') return block.name.trim().length === 0
  return block.text.trim().length === 0
}
