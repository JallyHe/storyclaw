import { describe, expect, it } from 'vitest'
import { formatVersionDiffLines } from '../src/components/explorer/versionDiff'

describe('version diff lines', () => {
  it('marks added and deleted patch lines for colored rendering', () => {
    const lines = formatVersionDiffLines([
      'diff --git a/foo.txt b/foo.txt',
      'index 1111111..2222222 100644',
      '--- a/foo.txt',
      '+++ b/foo.txt',
      '@@ -1,2 +1,2 @@',
      '-old line',
      '+new line',
      ' context line'
    ].join('\n'))

    expect(lines).toEqual([
      { kind: 'meta', text: 'diff --git a/foo.txt b/foo.txt' },
      { kind: 'meta', text: 'index 1111111..2222222 100644' },
      { kind: 'meta', text: '--- a/foo.txt' },
      { kind: 'meta', text: '+++ b/foo.txt' },
      { kind: 'hunk', text: '@@ -1,2 +1,2 @@' },
      { kind: 'del', text: '-old line' },
      { kind: 'add', text: '+new line' },
      { kind: 'context', text: ' context line' }
    ])
  })
})
