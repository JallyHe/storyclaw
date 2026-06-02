# ProseMirror Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal screenplay block editor with a complete paginated ProseMirror screenplay editor, and add standard Markdown-compatible rich text editors for outline and world files.

**Architecture:** `.ep` files remain StoryClaw `EpFile` JSON on disk and open only in the screenplay editor. The editor converts `EpFile.blocks` to a ProseMirror screenplay document and converts back on save. `.otl` and `.wld` use a shared rich text editor that stores Markdown-compatible plain text in existing JSON fields, so existing files and Agent tools remain compatible.

**Tech Stack:** React 18, TypeScript, ProseMirror core packages, Vitest, Testing Library, existing Zustand workspace store.

---

## File Map

- Create `src/editors/screenplay/schema.ts`: screenplay ProseMirror schema and line type labels.
- Create `src/editors/screenplay/convert.ts`: `EpFile` to/from ProseMirror JSON, paste-line inference helpers.
- Create `src/editors/screenplay/plugins.ts`: Enter flow, keyboard shortcuts, paste parsing, scene collection, pagination plugin export.
- Create `src/editors/richtext/schema.ts`: Markdown-friendly rich text schema.
- Create `src/editors/richtext/markdown.ts`: minimal Markdown parse/serialize helpers for headings, lists, paragraphs, bold/italic/underline.
- Create `src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx`: paginated screenplay editor surface.
- Create `src/components/editors/prosemirror/RichTextEditor.tsx`: reusable rich text editor.
- Create `src/components/editors/prosemirror/prosemirror.css`: page, toolbar, screenplay, and rich text styles matching StoryClaw.
- Modify `src/components/editors/episode/EpisodeEditor.tsx`: replace old block renderer with screenplay ProseMirror editor.
- Modify `src/components/editors/outline/OutlineEditor.tsx`: use rich text editor for logline and beats.
- Modify `src/components/editors/world/WorldEditor.tsx`: use rich text editor for body.
- Modify `src/types/index.ts`: add optional rich text and transition block typing only if required by conversion.
- Add tests `tests/screenplay-convert.test.ts` and `tests/richtext-markdown.test.ts`.

## Task 1: Install ProseMirror Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install editor dependencies**

Run:

```bash
npm install prosemirror-commands prosemirror-history prosemirror-keymap prosemirror-model prosemirror-state prosemirror-view
```

Expected: `package.json` contains the six ProseMirror packages.

## Task 2: Screenplay Conversion Layer

**Files:**
- Create: `src/editors/screenplay/schema.ts`
- Create: `src/editors/screenplay/convert.ts`
- Test: `tests/screenplay-convert.test.ts`

- [ ] **Step 1: Write failing conversion tests**

Test code must cover:

```ts
import { describe, expect, it } from 'vitest'
import { screenplayDocToEpFile, epFileToScreenplayDoc, inferScreenplayLineType } from '../src/editors/screenplay/convert'
import type { EpFile } from '../src/types'

const ep: EpFile = {
  version: 1,
  episode: 'EP01',
  title: '幽灵来电',
  status: 'wip',
  logline: '',
  blocks: [
    { id: 's1', type: 'scene', number: '1', intext: '内景', location: '电台', time: '夜', synopsis: '' },
    { id: 'a1', type: 'action', text: '红灯亮起。' },
    { id: 'c1', type: 'character', name: '苏晚' },
    { id: 'd1', type: 'dialogue', text: '凌晨两点零七分。' },
    { id: 'p1', type: 'paren', text: '停顿' }
  ]
}

describe('screenplay conversion', () => {
  it('round trips EpFile blocks through ProseMirror JSON', () => {
    const doc = epFileToScreenplayDoc(ep)
    expect(screenplayDocToEpFile(ep, doc).blocks).toEqual(ep.blocks)
  })

  it('infers screenplay line types from pasted text', () => {
    expect(inferScreenplayLineType('第 12 场 电台 内景 夜')).toBe('scene')
    expect(inferScreenplayLineType('苏晚：你听见了吗？')).toBe('dialogue')
    expect(inferScreenplayLineType('（压低声音）')).toBe('paren')
    expect(inferScreenplayLineType('红灯亮起。')).toBe('action')
  })
})
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
npm test -- tests/screenplay-convert.test.ts
```

Expected: fails because conversion modules do not exist.

- [ ] **Step 3: Implement schema and conversion**

Implement `scene_heading`, `action`, `character`, `dialogue`, `paren`, and `transition` block nodes. Convert existing StoryClaw blocks losslessly. `transition` can serialize back to `action` text until the disk format grows a first-class transition block.

- [ ] **Step 4: Run test and verify green**

Run:

```bash
npm test -- tests/screenplay-convert.test.ts
```

Expected: all tests pass.

## Task 3: Markdown-Compatible Rich Text Layer

**Files:**
- Create: `src/editors/richtext/schema.ts`
- Create: `src/editors/richtext/markdown.ts`
- Test: `tests/richtext-markdown.test.ts`

- [ ] **Step 1: Write failing Markdown tests**

Test code must cover:

```ts
import { describe, expect, it } from 'vitest'
import { markdownToRichTextDoc, richTextDocToMarkdown } from '../src/editors/richtext/markdown'

describe('rich text markdown conversion', () => {
  it('round trips headings, bullets, and emphasis as markdown-compatible text', () => {
    const markdown = '# 第一幕\n\n- 建立节目日常\n- 第一通来电\n\n**重点**与*情绪*。'
    expect(richTextDocToMarkdown(markdownToRichTextDoc(markdown))).toBe(markdown)
  })
})
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
npm test -- tests/richtext-markdown.test.ts
```

Expected: fails because rich text modules do not exist.

- [ ] **Step 3: Implement rich text schema and Markdown helpers**

Support paragraphs, heading levels 1-3, bullet list items as Markdown lines, bold, italic, underline via marks. Keep serializer deterministic and conservative.

- [ ] **Step 4: Run test and verify green**

Run:

```bash
npm test -- tests/richtext-markdown.test.ts
```

Expected: all tests pass.

## Task 4: Screenplay Editor Component

**Files:**
- Create: `src/editors/screenplay/plugins.ts`
- Create: `src/components/editors/prosemirror/ScreenplayProseMirrorEditor.tsx`
- Create: `src/components/editors/prosemirror/prosemirror.css`
- Modify: `src/components/editors/episode/EpisodeEditor.tsx`

- [ ] **Step 1: Implement editor plugins**

Add Enter flow, shortcut line type switching, paste parsing using `inferScreenplayLineType`, and a pagination decoration plugin adapted to StoryClaw class names.

- [ ] **Step 2: Implement React editor component**

The component accepts `filePath`, `file`, optional `diffBlocks`, `onSave`, `onAccept`, and `onReject`. It renders toolbar, scene navigation, paginated page surface, word/page counters, and readonly diff mode when pending changes are shown.

- [ ] **Step 3: Wire EpisodeEditor**

Only `.ep` files use this editor. Preserve existing `DiffBar`, pending change behavior, and scene navigation concept.

- [ ] **Step 4: Run editor tests**

Run:

```bash
npm test -- tests/editors.test.tsx tests/screenplay-convert.test.ts
```

Expected: all tests pass.

## Task 5: Rich Text Editor Component

**Files:**
- Create: `src/components/editors/prosemirror/RichTextEditor.tsx`
- Modify: `src/components/editors/outline/OutlineEditor.tsx`
- Modify: `src/components/editors/world/WorldEditor.tsx`

- [ ] **Step 1: Implement reusable rich text editor**

The component accepts `value`, `onChange`, `placeholder`, and optional compact mode. It stores Markdown-compatible text and exposes toolbar controls for heading, paragraph, bullet line, bold, italic, underline.

- [ ] **Step 2: Wire OutlineEditor**

Use rich text for `logline` and each beat string. Keep `.otl` JSON shape unchanged.

- [ ] **Step 3: Wire WorldEditor**

Use rich text for `body`. Keep `.wld` JSON shape unchanged.

- [ ] **Step 4: Run rich text tests**

Run:

```bash
npm test -- tests/richtext-markdown.test.ts tests/editors.test.tsx
```

Expected: all tests pass.

## Task 6: Final Verification

**Files:**
- All changed files

- [ ] **Step 1: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 2: Full tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: Electron main, preload, and renderer all build successfully.

