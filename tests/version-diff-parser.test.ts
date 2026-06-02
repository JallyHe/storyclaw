import { describe, expect, it } from 'vitest'
import { splitVersionDiffByFile, formatVersionDiffLines } from '../src/components/explorer/versionDiff'

describe('version diff parser', () => {
  it('splits a multi-file patch into ordered file sections', () => {
    const patch = [
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

    const files = splitVersionDiffByFile(patch)

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      path: 'alpha.txt',
      additions: 1,
      deletions: 1
    })
    expect(files[0].hunks).toHaveLength(1)
    expect(files[0].hunks[0].header).toBe('@@ -1,2 +1,2 @@')
    expect(files[0].lines.map(line => line.text)).toContain('+new alpha')
    expect(files[1]).toMatchObject({
      path: 'beta.txt',
      additions: 1,
      deletions: 1
    })
  })

  it('classifies patch lines for presentation', () => {
    const lines = formatVersionDiffLines([
      'diff --git a/file.txt b/file.txt',
      'index 111..222 100644',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      ' context'
    ].join('\n'))

    expect(lines).toEqual([
      { kind: 'meta', text: 'diff --git a/file.txt b/file.txt' },
      { kind: 'meta', text: 'index 111..222 100644' },
      { kind: 'meta', text: '--- a/file.txt' },
      { kind: 'meta', text: '+++ b/file.txt' },
      { kind: 'hunk', text: '@@ -1 +1 @@' },
      { kind: 'del', text: '-old' },
      { kind: 'add', text: '+new' },
      { kind: 'context', text: ' context' }
    ])
  })
})
