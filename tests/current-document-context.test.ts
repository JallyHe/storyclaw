import { describe, expect, it } from 'vitest'
import {
  appendCurrentDocumentContext,
  buildCurrentDocumentPromptContext,
  preferredReadTool,
  workspaceRelativePath
} from '../src/components/copilot/currentDocumentContext'

describe('current document context', () => {
  it('keeps prompts unchanged when no document is active', () => {
    expect(appendCurrentDocumentContext('续写本场', {
      activeFile: null,
      workspaceRoot: 'D:\\story'
    })).toBe('续写本场')
  })

  it('uses workspace-relative paths across Windows separators', () => {
    expect(workspaceRelativePath('D:\\story\\剧集\\EP01.ep', 'D:\\story')).toBe('剧集/EP01.ep')
  })

  it('builds screenplay context without reading the active file content eagerly', () => {
    const context = buildCurrentDocumentPromptContext({
      activeFile: 'D:\\story\\剧集\\EP01.ep',
      workspaceRoot: 'D:\\story'
    })

    expect(context).toContain('路径：剧集/EP01.ep')
    expect(context).toContain('类型：剧本文档')
    expect(context).toContain('read_screenplay')
    expect(context).toContain('不要假设你已经读过全文')
  })

  it('uses reference reading for non-story document types', () => {
    expect(preferredReadTool('pdf')).toBe('read_reference')
    expect(buildCurrentDocumentPromptContext({
      activeFile: '/story/参考/原著.pdf',
      workspaceRoot: '/story'
    })).toContain('read_reference')
  })
})

