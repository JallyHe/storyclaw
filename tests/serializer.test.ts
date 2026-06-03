import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseFile, serializeFile } from '../electron/fs/serializer'
import { scaffoldProject } from '../electron/fs/workspace'
import { exportScreenplayAsFountain, exportScreenplayAsTxt, parseScreenplayMarkup, screenplayToHtml } from '../src/editors/screenplay/markup'

const EP_JSON = JSON.stringify({
  version: 1, episode: 'EP01', title: '幽灵来电', status: 'wip', logline: '…',
  blocks: [
    { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '开场' },
    { id: 'b2', type: 'action', text: '灯亮了。' }
  ]
})

const EP_MARKUP = `@episode: EP01
@title: 幽灵来电
@status: wip

# 第 1 场 电台 内景 夜

灯亮了。

苏晚（压低声音）: “凌晨两点零七分。”

> 切至：`

describe('parseFile', () => {
  it('parses a legacy json .ep file', () => {
    const result = parseFile('ep', EP_JSON)
    expect(result).toMatchObject({ episode: 'EP01', title: '幽灵来电' })
  })

  it('parses screenplay markup and normalizes dialogue punctuation', () => {
    const result = parseFile('ep', EP_MARKUP)
    expect(result).toMatchObject({
      episode: 'EP01',
      title: '幽灵来电',
      blocks: [
        { type: 'scene', location: '电台', intext: '内景', time: '夜' },
        { type: 'action', text: '灯亮了。' },
        { type: 'dialogue', text: '苏晚（压低声音）：“凌晨两点零七分。”' },
        { type: 'transition', text: '切至：' }
      ]
    })
  })

  it('ignores extra blank lines in generated screenplay markup', () => {
    const result = parseScreenplayMarkup(`@episode: EP01
@title: 空白行测试


# 第 1 场 电台 内景 夜


灯亮了。



苏晚：你听见了吗？

`)

    expect(result.blocks).toEqual([
      expect.objectContaining({ type: 'scene' }),
      expect.objectContaining({ type: 'action', text: '灯亮了。' }),
      expect.objectContaining({ type: 'dialogue', text: '苏晚：你听见了吗？' })
    ])
  })

  it('round-trips .chr file', () => {
    const chr = {
      version: 1 as const,
      name: '苏晚',
      role: '主角',
      age: 32,
      gender: '女',
      alias: '晚姐',
      occupation: '主播',
      relationship: '与反派互为旧识',
      color: '#e0a458',
      tagline: '主播',
      traits: ['失眠'],
      background: '深夜电台出身',
      motivation: '查清来电真相',
      secret: '知道旧案线索',
      appearance: '常穿深色风衣',
      arc: '…',
      voice: '克制',
      appearsIn: ['EP01']
    }
    const parsed = parseFile('chr', JSON.stringify(chr))
    expect(parsed).toMatchObject({ gender: '女', occupation: '主播', motivation: '查清来电真相' })
    expect(serializeFile(parsed)).toContain('苏晚')
  })

  it('parses .wld file as a six-section project setting sheet', () => {
    const wld = {
      version: 1,
      title: '回声节目',
      sections: {
        premise: '深夜节目',
        timeAndPlace: '当代海城',
        rules: '来电不能被挂断',
        socialRelations: '电台与听众互相依赖',
        keySpaces: '直播间',
        backstoryAndMaterials: '三年前旧案'
      }
    }
    const result = parseFile('wld', JSON.stringify(wld))
    expect(result).toMatchObject({
      title: '回声节目',
      sections: {
        premise: '深夜节目',
        timeAndPlace: '当代海城',
        rules: '来电不能被挂断',
        socialRelations: '电台与听众互相依赖',
        keySpaces: '直播间',
        backstoryAndMaterials: '三年前旧案'
      }
    })
    expect(serializeFile(result)).not.toContain('"body"')
  })

  it('parses .cfg project config', () => {
    const cfg = parseFile('cfg', JSON.stringify({
      version: 1,
      kind: 'storyclaw-project',
      name: '追光',
      type: 'short',
      genre: '都市甜宠',
      synopsis: '短剧项目',
      episodes: 24,
      episodeDurationMinutes: 3,
      screenplayLayout: 'single-file-multi-episode'
    }))

    expect(cfg).toMatchObject({
      kind: 'storyclaw-project',
      name: '追光',
      type: 'short',
      screenplayLayout: 'single-file-multi-episode'
    })
    expect(serializeFile(cfg)).toContain('"storyclaw-project"')
  })

  it('scaffolds project config without empty episode files', async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyclaw-scaffold-'))
    const root = await scaffoldProject({
      name: '短剧测试',
      type: 'short',
      episodes: 20,
      episodeTitles: [],
      targetDir
    })

    const config = JSON.parse(await fs.readFile(path.join(root, '项目配置.cfg'), 'utf-8'))
    const episodeFiles = await fs.readdir(path.join(root, '剧集'))
    const settingFiles = await fs.readdir(path.join(root, '设定'))
    expect(config).toMatchObject({ type: 'short', episodes: 20, screenplayLayout: 'single-file-multi-episode' })
    expect(episodeFiles).toEqual([])
    expect(settingFiles).toEqual(['项目设定.wld'])
  })

  it('serializes .ep files as lightweight markup instead of json', () => {
    const screenplay = parseScreenplayMarkup(EP_MARKUP, { episode: 'EP01', title: '幽灵来电', status: 'wip', logline: '' })
    const serialized = serializeFile(screenplay)
    expect(serialized).toContain('@episode: EP01')
    expect(serialized).toContain('# 第 1 场 电台 内景 夜')
    expect(serialized).toContain('苏晚（压低声音）：“凌晨两点零七分。”')
    expect(serialized.trim().startsWith('{')).toBe(false)
  })

  it('parses and serializes multiple episodes in one .ep file', () => {
    const multi = parseScreenplayMarkup(`@series: 追光短剧

@episode: EP01
@title: 第一集
@status: wip

# 第 1 场 小巷 外景 夜

他冲进雨里。

@episode: EP02
@title: 第二集
@status: wip

# 第 1 场 客厅 内景 日

门开了。`)

    expect(multi.series).toBe('追光短剧')
    expect(multi.episodes).toHaveLength(2)
    expect(multi.episodes?.[0]).toMatchObject({ episode: 'EP01', title: '第一集' })
    expect(multi.episodes?.[1]).toMatchObject({ episode: 'EP02', title: '第二集' })

    const serialized = serializeFile(multi)
    expect(serialized).toContain('@series: 追光短剧')
    expect(serialized).toContain('@episode: EP01')
    expect(serialized).toContain('@episode: EP02')
  })

  it('exports all episodes from a multi-episode .ep file', () => {
    const multi = parseScreenplayMarkup(`@series: 追光短剧

@episode: EP01
@title: 第一集
@status: wip

# 第 1 场 小巷 外景 夜

他冲进雨里。

@episode: EP02
@title: 第二集
@status: wip

# 第 1 场 客厅 内景 日

门开了。`)

    expect(exportScreenplayAsTxt(multi)).toContain('第一集')
    expect(exportScreenplayAsTxt(multi)).toContain('第二集')
    expect(exportScreenplayAsFountain(multi)).toContain('# 第一集')
    expect(exportScreenplayAsFountain(multi)).toContain('# 第二集')
    expect(screenplayToHtml(multi)).toContain('<h1>第一集</h1>')
    expect(screenplayToHtml(multi)).toContain('<h1>第二集</h1>')
  })

  it('exports fountain text from screenplay blocks', () => {
    const screenplay = parseScreenplayMarkup(EP_MARKUP, { episode: 'EP01', title: '幽灵来电', status: 'wip', logline: '' })
    const fountain = exportScreenplayAsFountain(screenplay)
    expect(fountain).toContain('Title: 幽灵来电')
    expect(fountain).toContain('INT. 电台 - 夜')
    expect(fountain).toContain('苏晚')
    expect(fountain).toContain('“凌晨两点零七分。”')
  })

  it('preserves block line breaks in exported HTML for PDF', () => {
    const screenplay = parseScreenplayMarkup(`@episode: EP01
@title: 换行测试
@status: wip

# 第 1 场 电台 内景 夜

第一行动作
第二行动作`)

    const html = screenplayToHtml(screenplay)

    expect(html).toContain('<h1>换行测试</h1>')
    expect(html).toContain('第一行动作<br>第二行动作')
  })
})
