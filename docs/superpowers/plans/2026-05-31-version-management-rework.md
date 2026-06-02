# Version Management Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the SCM panel into a version management workspace focused on current changes, version history, version notes, creating versions, restoring versions, and VSCode-style diff inspection with per-file side-by-side comparison.

**Architecture:** Keep the existing Git-backed versioning service and IPC surface intact. Move all presentation concerns into a reusable diff parsing module plus a dedicated compare viewer component that can render both unified and side-by-side file diffs from the existing `VersionDiff.patch` payload. The SCM panel becomes a controller shell for current changes, history, record details, and actions, while the compare viewer owns all diff layout and file navigation state.

**Tech Stack:** React, TypeScript, Vite/electron-vite, existing Electron IPC, existing Git versioning service, CSS modules via global stylesheet.

---

### Task 1: Remove creative-branch actions from the SCM panel and refocus it on core version management

**Files:**
- Create: `src/components/explorer/VersionActionsBar.tsx`
- Modify: `src/components/explorer/ScmPanel.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/version-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VersionActionsBar } from '../src/components/explorer/VersionActionsBar'

describe('VersionActionsBar', () => {
  it('does not show creative branch actions', () => {
    const view = render(<VersionActionsBar onCreateVersion={() => {}} onRestoreVersion={() => {}} />)
    expect(view.queryByText('创建导演版')).toBeNull()
    expect(view.queryByText('创建平台修改版')).toBeNull()
    expect(view.queryByText('标记为定稿')).toBeNull()
    expect(view.getByText('创建新版本')).toBeTruthy()
    expect(view.getByText('恢复指定版本')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec vitest run tests/version-actions.test.ts`
Expected: FAIL because the current UI still renders the creative-branch buttons and the new component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
interface Props {
  onCreateVersion: () => void
  onRestoreVersion: () => void
}

export function VersionActionsBar({ onCreateVersion, onRestoreVersion }: Props) {
  return (
    <section className="version-card">
      <div className="version-section-title">版本操作</div>
      <div className="version-actions-grid">
        <button className="version-primary" onClick={onCreateVersion}>创建新版本</button>
        <button className="mini-btn" onClick={onRestoreVersion}>恢复指定版本</button>
      </div>
    </section>
  )
}
```

Remove the `createLine('director')`, `createLine('platform')`, and `markFinal`-only "定稿" copy from the UI. Keep the underlying `versionIpc.save()` and `versionIpc.restore()` actions available.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec vitest run tests/version-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/VersionActionsBar.tsx src/components/explorer/ScmPanel.tsx src/styles/globals.css tests/version-actions.test.ts
git commit -m "feat: refocus scm panel on version management"
```

### Task 2: Add a reusable diff parser for unified and side-by-side file inspection

**Files:**
- Create: `src/components/explorer/versionDiff.ts`
- Modify: `src/components/explorer/ScmPanel.tsx`
- Test: `tests/version-diff.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { splitVersionDiffByFile, formatVersionDiffLines } from '../src/components/explorer/versionDiff'

describe('version diff parser', () => {
  it('splits a patch into file sections and classifies lines', () => {
    const patch = [
      'diff --git a/a.txt b/a.txt',
      'index 111..222 100644',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      ' context',
      'diff --git a/b.txt b/b.txt',
      'index 333..444 100644',
      '--- a/b.txt',
      '+++ b/b.txt',
      '@@ -1 +1 @@',
      '-gone',
      '+stay'
    ].join('\n')

    const files = splitVersionDiffByFile(patch)
    expect(files).toHaveLength(2)
    expect(files[0].path).toBe('a.txt')
    expect(files[0].lines.some(line => line.kind === 'add' && line.text === '+new')).toBe(true)
    expect(formatVersionDiffLines(patch)[0].kind).toBe('meta')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec vitest run tests/version-diff.test.ts`
Expected: FAIL because the parser helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function splitVersionDiffByFile(patch: string) {
  // Parse `diff --git` boundaries, collect per-file lines, preserve hunk/meta/context kinds.
}

export function formatVersionDiffLines(patch: string) {
  // Return all lines with `meta | hunk | add | del | context`.
}
```

Use the existing `VersionDiff.patch` string, do not change IPC or backend payloads in this task.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec vitest run tests/version-diff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/versionDiff.ts tests/version-diff.test.ts src/components/explorer/ScmPanel.tsx
git commit -m "feat: add version diff parsing helpers"
```

### Task 3: Build the VSCode-style diff viewer with unified and side-by-side modes

**Files:**
- Create: `src/components/explorer/VersionDiffViewer.tsx`
- Modify: `src/components/explorer/ScmPanel.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/version-diff-viewer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VersionDiffViewer } from '../src/components/explorer/VersionDiffViewer'

describe('VersionDiffViewer', () => {
  it('renders a file list and supports unified / side-by-side modes', () => {
    const diff = {
      fromId: 'a',
      toId: 'b',
      files: [{ path: 'foo.txt', additions: 1, deletions: 1 }],
      patch: [
        'diff --git a/foo.txt b/foo.txt',
        'index 111..222 100644',
        '--- a/foo.txt',
        '+++ b/foo.txt',
        '@@ -1 +1 @@',
        '-old',
        '+new'
      ].join('\n')
    }

    const view = render(<VersionDiffViewer diff={diff} />)
    expect(view.getByText('foo.txt')).toBeTruthy()
    expect(view.getByText('统一视图')).toBeTruthy()
    expect(view.getByText('左右对比')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec vitest run tests/version-diff-viewer.test.ts`
Expected: FAIL because the new viewer component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function VersionDiffViewer({ diff }: { diff: VersionDiff }) {
  // Show file pills, a toggle for unified vs side-by-side, and the selected file diff.
  // Use the parser from `versionDiff.ts` so add/delete/context lines are colorized.
}
```

Implement:
- file navigation list derived from `diff.files`
- unified view using colored line rows
- side-by-side view with left/right columns derived from the same patch
- per-file selection so one file can be inspected at a time

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec vitest run tests/version-diff-viewer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/VersionDiffViewer.tsx src/components/explorer/ScmPanel.tsx src/styles/globals.css tests/version-diff-viewer.test.ts
git commit -m "feat: add version diff viewer"
```

### Task 4: Expand version history rows into readable modification records

**Files:**
- Create: `src/components/explorer/VersionRecordRow.tsx`
- Modify: `src/components/explorer/ScmPanel.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/version-history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VersionRecordRow } from '../src/components/explorer/VersionRecordRow'

describe('VersionRecordRow', () => {
  it('shows a summary of changed files and record actions', () => {
    const view = render(
      <VersionRecordRow
        record={{
          id: '1',
          shortId: 'abc1234',
          message: '第二稿完成',
          createdAt: '2026-05-31T10:00:00Z',
          changedFiles: ['a.ep', 'b.otl'],
          lineName: '主版本',
          isFinal: false
        }}
        previous={undefined}
        onCompare={() => {}}
        onRestore={() => {}}
      />
    )

    expect(view.getByText('第二稿完成')).toBeTruthy()
    expect(view.getByText('a.ep、b.otl')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec vitest run tests/version-history.test.ts`
Expected: FAIL because the row is still only a compact timeline card.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="version-row-files">
  {record.changedFiles.slice(0, 5).join('、')}
  {record.changedFiles.length > 5 ? ` 等 ${record.changedFiles.length} 个` : ''}
</div>
```

Also add the record-level actions:
- `查看对比`
- `恢复到此版`
- optional expand/collapse for the modification record details

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec vitest run tests/version-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/ScmPanel.tsx src/styles/globals.css tests/version-history.test.ts
git commit -m "feat: expand version history records"
```

### Task 5: Verify the full version management flow

**Files:**
- Modify: `src/components/explorer/ScmPanel.tsx`
- Modify: `src/components/explorer/VersionDiffViewer.tsx`
- Modify: `src/components/explorer/versionDiff.ts`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Run targeted tests**

Run:
`npm exec vitest run tests/version-diff.test.ts tests/version-diff-viewer.test.ts tests/version-history.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the full build**

Run: `npm run build`
Expected: PASS with no new TypeScript or Vite errors.

- [ ] **Step 3: Manual smoke test**

Open the app and verify:
- current change files are visible at the top of SCM
- version history lists records with readable modification summaries
- creating a new version still works
- restoring a selected version still works
- version compare opens the new viewer
- unified and side-by-side views both render
- per-file navigation switches the diff being displayed

- [ ] **Step 4: Commit**

```bash
git add src/components/explorer/ScmPanel.tsx src/components/explorer/VersionDiffViewer.tsx src/components/explorer/versionDiff.ts src/styles/globals.css tests/version-diff.test.ts tests/version-diff-viewer.test.ts tests/version-history.test.ts
git commit -m "feat: rework version management workflow"
```
