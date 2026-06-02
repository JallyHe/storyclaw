import { describe, expect, it } from 'vitest'
import {
  epFileToScreenplayDoc,
  inferScreenplayLineType,
  screenplayDocToEpFile
} from '../src/editors/screenplay/convert'
import { SCREENPLAY_LINE_ORDER } from '../src/editors/screenplay/controls'
import { SCREENPLAY_LABELS } from '../src/editors/screenplay/schema'
import type { EpFile } from '../src/types'

const ep: EpFile = {
  version: 1,
  episode: 'EP01',
  title: '幽灵来电',
  status: 'wip',
  logline: '',
  blocks: [
    { id: 's1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '' },
    { id: 'a1', type: 'action', text: '红灯亮起。' },
    { id: 'd1', type: 'dialogue', text: '苏晚（压低声音）：凌晨两点零七分。' },
    { id: 'p1', type: 'paren', text: '停顿' },
    { id: 't1', type: 'transition', text: '切至：走廊。' }
  ]
}

describe('screenplay conversion', () => {
  it('round trips EpFile blocks through ProseMirror JSON', () => {
    const doc = epFileToScreenplayDoc(ep)
    expect(screenplayDocToEpFile(ep, doc).blocks).toEqual(ep.blocks)
  })

  it('drops empty generated screenplay blocks when saving from ProseMirror JSON', () => {
    const doc = epFileToScreenplayDoc({
      ...ep,
      blocks: [
        { id: 'a-empty', type: 'action', text: '' },
        { id: 'a-blank', type: 'action', text: '   ' },
        { id: 'a-real', type: 'action', text: '灯亮了。' }
      ]
    })

    expect(screenplayDocToEpFile(ep, doc).blocks).toEqual([
      { id: 'a-real', type: 'action', text: '灯亮了。' }
    ])
  })

  it('preserves hard breaks when saving from ProseMirror JSON', () => {
    const saved = screenplayDocToEpFile(ep, {
      type: 'doc',
      content: [
        {
          type: 'action',
          attrs: { id: 'a-break' },
          content: [
            { type: 'text', text: '第一行' },
            { type: 'hard_break' },
            { type: 'text', text: '第二行' }
          ]
        }
      ]
    })

    expect(saved.blocks).toEqual([
      { id: 'a-break', type: 'action', text: '第一行\n第二行' }
    ])
  })

  it('round trips multiple line breaks through ProseMirror JSON', () => {
    const file: EpFile = {
      ...ep,
      blocks: [
        { id: 'a-multiple-breaks', type: 'action', text: '第一行\n\n\n第四行' }
      ]
    }

    const doc = epFileToScreenplayDoc(file)

    expect(doc.content[0].content).toEqual([
      { type: 'text', text: '第一行' },
      { type: 'hard_break' },
      { type: 'hard_break' },
      { type: 'hard_break' },
      { type: 'text', text: '第四行' }
    ])
    expect(screenplayDocToEpFile(file, doc).blocks).toEqual(file.blocks)
  })

  it('flattens multiple episodes into one editable ProseMirror document', () => {
    const file: EpFile = {
      ...ep,
      episodes: [
        { ...ep, episode: 'EP01', title: '第一集', blocks: [{ id: 'a1', type: 'action', text: '第一集正文' }] },
        { ...ep, episode: 'EP02', title: '第二集', blocks: [{ id: 'a2', type: 'action', text: '第二集正文' }] }
      ]
    }

    const doc = epFileToScreenplayDoc(file, { includeEpisodeHeadings: true })

    expect(doc.content.map((node: any) => node.type)).toEqual([
      'episode_heading',
      'action',
      'episode_heading',
      'action'
    ])
    expect(screenplayDocToEpFile(file, doc).episodes?.map(episode => episode.title)).toEqual(['第一集', '第二集'])
  })

  it('uses an editable episode heading for a single episode document too', () => {
    const doc = epFileToScreenplayDoc(ep, { includeEpisodeHeadings: true })

    expect(doc.content[0]).toMatchObject({
      type: 'episode_heading',
      attrs: { episode: 'EP01' }
    })
    expect(screenplayDocToEpFile(ep, {
      ...doc,
      content: [
        { type: 'episode_heading', attrs: { episode: 'EP01' }, content: [{ type: 'text', text: '新标题' }] },
        ...doc.content.slice(1)
      ]
    }).title).toBe('新标题')
  })

  it('saves edited episode headings back to multi-episode metadata', () => {
    const file: EpFile = {
      ...ep,
      episodes: [
        { ...ep, episode: 'EP01', title: '第一集', blocks: [{ id: 'a1', type: 'action', text: '第一集正文' }] },
        { ...ep, episode: 'EP02', title: '第二集', blocks: [{ id: 'a2', type: 'action', text: '第二集正文' }] }
      ]
    }

    const saved = screenplayDocToEpFile(file, {
      type: 'doc',
      content: [
        { type: 'episode_heading', attrs: { episode: 'EP01' }, content: [{ type: 'text', text: '改名第一集' }] },
        { type: 'action', attrs: { id: 'a1' }, content: [{ type: 'text', text: '第一集正文' }] },
        { type: 'episode_heading', attrs: { episode: 'EP02' }, content: [{ type: 'text', text: '改名第二集' }] },
        { type: 'action', attrs: { id: 'a2' }, content: [{ type: 'text', text: '第二集正文' }] }
      ]
    })

    expect(saved.episodes).toHaveLength(2)
    expect(saved.episodes?.[0]).toMatchObject({ episode: 'EP01', title: '改名第一集' })
    expect(saved.episodes?.[1]).toMatchObject({ episode: 'EP02', title: '改名第二集' })
  })

  it('infers screenplay line types from pasted text', () => {
    expect(inferScreenplayLineType('第 12 场 电台 内景 夜')).toBe('scene')
    expect(inferScreenplayLineType('苏晚：你听见了吗？')).toBe('dialogue')
    expect(inferScreenplayLineType('张山（笑着说）：你还是落到我手上啦')).toBe('dialogue')
    expect(inferScreenplayLineType('（压低声音）')).toBe('paren')
    expect(inferScreenplayLineType('红灯亮起。')).toBe('action')
  })

  it('exposes only the simplified screenplay toolbar line types', () => {
    expect(SCREENPLAY_LINE_ORDER).toEqual(['scene', 'action', 'dialogue', 'transition'])
    expect(SCREENPLAY_LINE_ORDER.map(type => SCREENPLAY_LABELS[type])).toEqual(['场次标题', '动作描述', '对白行', '转场'])
  })
})
