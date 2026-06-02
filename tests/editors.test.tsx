import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Block } from '../src/components/editors/episode/Block'
import type { SceneBlock, ActionBlock } from '../src/types'

describe('Block', () => {
  it('renders scene block with location', () => {
    const blk: SceneBlock = { id: 'b1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '' }
    render(<Block blk={blk} diff={null} />)
    expect(screen.getByText('电台')).toBeInTheDocument()
    expect(screen.getByText('场头')).toBeInTheDocument()
  })

  it('renders action block with text', () => {
    const blk: ActionBlock = { id: 'b2', type: 'action', text: '灯亮了。' }
    render(<Block blk={blk} diff={null} />)
    expect(screen.getByText('灯亮了。')).toBeInTheDocument()
  })

  it('applies diff-add class', () => {
    const blk: ActionBlock = { id: 'b3', type: 'action', text: '新内容' }
    const { container } = render(<Block blk={blk} diff="add" />)
    expect(container.firstChild).toHaveClass('diff-add')
  })

  it('applies diff-del class', () => {
    const blk: ActionBlock = { id: 'b4', type: 'action', text: '旧内容' }
    const { container } = render(<Block blk={blk} diff="del" />)
    expect(container.firstChild).toHaveClass('diff-del')
  })
})
