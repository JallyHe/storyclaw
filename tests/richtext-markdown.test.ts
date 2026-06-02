import { describe, expect, it } from 'vitest'
import { markdownToRichTextDoc, richTextDocToMarkdown } from '../src/editors/richtext/markdown'

describe('rich text markdown conversion', () => {
  it('round trips headings, bullets, and emphasis as markdown-compatible text', () => {
    const markdown = '# 第一幕\n\n- 建立节目日常\n- 第一通来电\n\n**重点**与*情绪*。'
    expect(richTextDocToMarkdown(markdownToRichTextDoc(markdown))).toBe(markdown)
  })

  it('parses markdown tables even when blank lines appear between rows', () => {
    const markdown = [
      '| 阶段 | 集数 | 暗线进展 | 情绪曲线 |',
      '',
      '|:---:|:---:|:---|:---:|',
      '',
      '| 铺局 | E1-3 | 房牙账本影印/资金流向初显 | 荒诞→悬疑 |',
      '',
      '| 线索浮现 | E4-8 | 科举捐官/假药资金/田产暗码/茶引垄断 | 喜剧→紧张 |',
      '',
      '| 暗线交汇 | E9-13 | 书画洗钱/潮神抵押/李压狗前世/广亮动机 | 悲喜交织 |',
      '',
      '| 危机总爆 | E14-17 | 账本大火/公堂对簿/西泠金库/填湖强拆 | 高压→抗争 |',
      '',
      '| 终局破阵 | E18-20 | 断粮共济/总账现世/皇亲密信/扫塔定局 | 释然→升华 |'
    ].join('\n')

    const doc = markdownToRichTextDoc(markdown)

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('table')
    expect(doc.content[0].content).toHaveLength(6)
  })

  it('parses a table immediately after a heading', () => {
    const markdown = [
      '### 信息释放节奏',
      '| 阶段 | 集数 | 暗线进展 | 情绪曲线 |',
      '|:---:|:---:|:---|:---:|',
      '| 铺局 | E1-3 | 房牙账本影印/资金流向初显 | 荒诞→悬疑 |',
      '| 线索浮现 | E4-8 | 科举捐官/假药资金/田产暗码/茶引垄断 | 喜剧→紧张 |',
      '| 暗线交汇 | E9-13 | 书画洗钱/潮神抵押/李压狗前世/广亮动机 | 悲喜交织 |',
      '| 危机总爆 | E14-17 | 账本大火/公堂对簿/西泠金库/填湖强拆 | 高压→抗争 |',
      '| 终局破阵 | E18-20 | 断粮共济/总账现世/皇亲密信/扫塔定局 | 释然→升华 |'
    ].join('\n')

    const doc = markdownToRichTextDoc(markdown)

    expect(doc.content).toHaveLength(2)
    expect(doc.content[0]).toMatchObject({ type: 'heading', attrs: { level: 3 } })
    expect(doc.content[1].type).toBe('table')
    expect(doc.content[1].content).toHaveLength(6)
  })
})
