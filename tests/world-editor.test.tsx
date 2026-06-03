import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorldEditor } from '../src/components/editors/world/WorldEditor'
import { createEmptyWorldSections, WORLD_SECTION_DEFS } from '../src/editors/world/sections'

describe('WorldEditor', () => {
  it('renders the project setting sheet as six markdown rich-text sections', () => {
    render(
      <WorldEditor
        filePath="/project/设定/项目设定.wld"
        file={{
          version: 1,
          title: '项目设定',
          sections: createEmptyWorldSections({ premise: '# 核心' })
        }}
      />
    )

    for (const section of WORLD_SECTION_DEFS) {
      expect(screen.getByText(section.label)).toBeInTheDocument()
    }
    expect(screen.queryByRole('textbox', { name: /正文/ })).not.toBeInTheDocument()
  })
})
