import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VersionCompareView } from '../src/components/explorer/VersionCompareView'
import type { VersionDiff } from '../src/types'

const diff: VersionDiff = {
  fromId: 'from',
  toId: 'to',
  files: [
    { path: 'alpha.txt', additions: 1, deletions: 1 },
    { path: 'beta.txt', additions: 1, deletions: 1 }
  ],
  patch: [
    'diff --git a/alpha.txt b/alpha.txt',
    'index 1111111..2222222 100644',
    '--- a/alpha.txt',
    '+++ b/alpha.txt',
    '@@ -1,2 +1,2 @@',
    '-old alpha',
    '+new alpha',
    ' context alpha',
    'diff --git a/beta.txt b/beta.txt',
    'index 3333333..4444444 100644',
    '--- a/beta.txt',
    '+++ b/beta.txt',
    '@@ -4 +4 @@',
    '-old beta',
    '+new beta'
  ].join('\n')
}

describe('VersionCompareView', () => {
  it('renders a file list, split diff, and file selection', () => {
    render(<VersionCompareView root="/workspace/story" diff={diff} />)

    expect(screen.getByRole('button', { name: 'alpha.txt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'beta.txt' })).toBeInTheDocument()
    expect(screen.getByText('版本对比')).toBeInTheDocument()
    expect(screen.getByText('old alpha')).toBeInTheDocument()
    expect(screen.getByText('new alpha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'beta.txt' }))

    expect(screen.getByText('old beta')).toBeInTheDocument()
    expect(screen.getByText('new beta')).toBeInTheDocument()
  })
})
