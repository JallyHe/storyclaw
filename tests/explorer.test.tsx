import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileIcon } from '../src/components/explorer/FileIcon'

describe('FileIcon', () => {
  it('renders .ep extension', () => {
    render(<FileIcon ext="ep" />)
    expect(screen.getByText('.ep')).toBeInTheDocument()
  })

  it('renders .chr extension', () => {
    render(<FileIcon ext="chr" />)
    expect(screen.getByText('.chr')).toBeInTheDocument()
  })

  it('renders unknown extension with ref color', () => {
    const { container } = render(<FileIcon ext="pdf" />)
    expect(container.firstChild).toHaveStyle('color: var(--c-ref)')
  })
})
