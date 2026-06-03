import type { EpFile, ChrFile, WldFile, StoryFile, FileExt, ProjectConfigFile } from '../../src/types'
import { parseScreenplayMarkup, serializeScreenplayMarkup } from '../../src/editors/screenplay/markup'
import { createEmptyWorldSections } from '../../src/editors/world/sections'

export function parseFile(ext: FileExt, raw: string): StoryFile {
  switch (ext) {
    case 'ep':  return parseEp(raw)
    case 'chr': return validateChr(JSON.parse(raw))
    case 'wld': return validateWld(JSON.parse(raw))
    case 'cfg': return validateProjectConfig(JSON.parse(raw))
    default:    throw new Error(`Unknown ext: ${ext}`)
  }
}

export function serializeFile(data: StoryFile): string {
  if ('blocks' in data) return serializeScreenplayMarkup(data as EpFile)
  return JSON.stringify(data, null, 2)
}

function parseEp(raw: string): EpFile {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return validateEp(JSON.parse(raw))
  return parseScreenplayMarkup(raw)
}

function validateEp(d: unknown): EpFile {
  const o = d as EpFile
  if (!Array.isArray(o.blocks)) throw new Error('ep: missing blocks')
  return { version: 1, episode: o.episode ?? '', title: o.title ?? '', status: o.status ?? 'wip', logline: o.logline ?? '', blocks: o.blocks }
}

function validateChr(d: unknown): ChrFile {
  const o = d as ChrFile
  return {
    version: 1,
    name: o.name ?? '',
    role: o.role ?? '',
    age: Number(o.age ?? 0),
    gender: o.gender ?? '',
    alias: o.alias ?? '',
    occupation: o.occupation ?? '',
    relationship: o.relationship ?? '',
    color: o.color ?? '#888',
    tagline: o.tagline ?? '',
    traits: Array.isArray(o.traits) ? o.traits : [],
    arc: o.arc ?? '',
    voice: o.voice ?? '',
    appearsIn: Array.isArray(o.appearsIn) ? o.appearsIn : [],
    background: o.background ?? '',
    motivation: o.motivation ?? '',
    secret: o.secret ?? '',
    appearance: o.appearance ?? ''
  }
}

function validateWld(d: unknown): WldFile {
  const o = d as WldFile
  return {
    version: 1,
    title: o.title ?? '',
    sections: createEmptyWorldSections(o.sections)
  }
}

function validateProjectConfig(d: unknown): ProjectConfigFile {
  const o = d as ProjectConfigFile
  const type = o.type === 'film' || o.type === 'series' || o.type === 'short' ? o.type : 'series'
  const defaultLayout = type === 'short'
    ? 'single-file-multi-episode'
    : type === 'film'
      ? 'single-film-file'
      : 'one-file-per-episode'
  const layout = (
    o.screenplayLayout === 'single-file-multi-episode' ||
    o.screenplayLayout === 'one-file-per-episode' ||
    o.screenplayLayout === 'single-film-file'
  ) ? o.screenplayLayout : defaultLayout
  return {
    version: 1,
    kind: 'storyclaw-project',
    name: o.name ?? '',
    type,
    genre: o.genre ?? '',
    synopsis: o.synopsis ?? '',
    episodes: Math.max(1, Number(o.episodes ?? 1) || 1),
    episodeDurationMinutes: Math.max(1, Number(o.episodeDurationMinutes ?? 10) || 10),
    screenplayLayout: layout
  }
}
