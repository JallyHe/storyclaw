import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createFileNameW,
  createPreferredDropEffect,
  createWindowsDropFiles,
  normalizeClipboardPaths,
  parseWindowsDropFiles,
  splitNullTerminatedPaths
} from '../electron/desktop/clipboardFiles'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'storyclaw-clipboard-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('clipboard file formats', () => {
  it('round-trips multiple Windows CF_HDROP file paths', async () => {
    const first = path.join(root, '第一集.ep')
    const second = path.join(root, '人物.chr')
    await fs.writeFile(first, '')
    await fs.writeFile(second, '')

    const parsed = parseWindowsDropFiles(createWindowsDropFiles([first, second]))

    expect(parsed).toEqual([first, second])
  })

  it('writes FileNameW as a multi-file null-terminated list', async () => {
    const first = path.join(root, 'a.txt')
    const second = path.join(root, 'b.txt')

    expect(splitNullTerminatedPaths(createFileNameW([first, second]).toString('utf16le'))).toEqual([first, second])
  })

  it('normalizes existing file URI clipboard paths', async () => {
    const filePath = path.join(root, '带 空格.txt')
    await fs.writeFile(filePath, '')

    expect(normalizeClipboardPaths([`file:///${filePath.replace(/\\/g, '/')}`])).toEqual([path.normalize(filePath)])
  })

  it('marks copy and cut operations with the Windows preferred drop effect', () => {
    expect(createPreferredDropEffect('copy').readUInt32LE(0)).toBe(1)
    expect(createPreferredDropEffect('cut').readUInt32LE(0)).toBe(2)
  })
})
