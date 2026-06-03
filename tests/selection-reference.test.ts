import { describe, expect, it } from 'vitest'
import {
  buildSelectionPromptContext,
  decodeSelectionReference,
  encodeSelectionReference,
  findSelectionReferences,
  selectionLabel,
  type SelectionReference
} from '../src/components/copilot/selectionReference'

describe('selection references', () => {
  const ref: SelectionReference = {
    filePath: 'D:\\story\\剧集\\EP01.ep',
    relPath: '剧集/EP01.ep',
    from: 42,
    to: 88,
    startBlockId: 'b1',
    endBlockId: 'b2',
    startBlockType: 'action',
    endBlockType: 'dialogue'
  }

  it('encodes location metadata without selected text content', () => {
    const token = encodeSelectionReference(ref)

    expect(token).toMatch(/^@selection:/)
    expect(token).not.toContain('这是一段被选中的正文')
    expect(decodeSelectionReference(token)).toEqual(ref)
  })

  it('creates a compact label for chips', () => {
    expect(selectionLabel(ref)).toBe('选区 EP01.ep:42-88')
  })

  it('finds selection references inside a prompt', () => {
    const token = encodeSelectionReference(ref)

    expect(findSelectionReferences(`请改写 ${token}`)).toEqual([ref])
  })

  it('builds prompt context that tells the agent to read by location', () => {
    const context = buildSelectionPromptContext(`请改写 ${encodeSelectionReference(ref)}`)

    expect(context).toContain('路径：剧集/EP01.ep')
    expect(context).toContain('ProseMirror 位置：42-88')
    expect(context).toContain('action#b1')
    expect(context).toContain('read_screenplay')
    expect(context).toContain('不包含被选中文本正文')
  })
})

