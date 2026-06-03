import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createClipboardPathsPayload,
  createFileNameW,
  createMacClipboardReadScript,
  createMacClipboardWriteScript,
  createPreferredDropEffect,
  createWindowsClipboardReadScript,
  createWindowsClipboardWriteScript,
  encodeJxaString,
  createWindowsDropFiles,
  encodePowerShellCommand,
  parseMacClipboardPathsOutput,
  normalizeClipboardPaths,
  parseWindowsClipboardPathsOutput,
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

  it('encodes PowerShell commands as UTF-16LE for -EncodedCommand', () => {
    const script = "Write-Output 'ok'"
    const encoded = encodePowerShellCommand(script)

    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(script)
  })

  it('keeps clipboard file paths in an encoded payload instead of the PowerShell command', () => {
    const filePath = path.join(root, '带 空格.txt')
    const payload = createClipboardPathsPayload([filePath])
    const script = createWindowsClipboardWriteScript('copy')

    expect(JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))).toEqual([filePath])
    expect(script).not.toContain(filePath)
    expect(script).toContain('SetFileDropList')
    expect(script).toContain('Preferred DropEffect')
    expect(script).toContain('[UInt32]1')
    expect(script).not.toContain('Add-Type -AssemblyName System.Collections.Specialized')
  })

  it('builds a read script that returns the native Windows file drop list as JSON', () => {
    const script = createWindowsClipboardReadScript()

    expect(script).toContain('GetFileDropList')
    expect(script).toContain('ConvertTo-Json')
  })

  it('parses PowerShell clipboard file list output', () => {
    expect(parseWindowsClipboardPathsOutput('')).toEqual([])
    expect(parseWindowsClipboardPathsOutput('"C:\\\\tmp\\\\one.txt"')).toEqual(['C:\\tmp\\one.txt'])
    expect(parseWindowsClipboardPathsOutput('["C:\\\\tmp\\\\one.txt","C:\\\\tmp\\\\two.txt"]')).toEqual([
      'C:\\tmp\\one.txt',
      'C:\\tmp\\two.txt'
    ])
  })

  it('escapes strings for macOS JXA scripts', () => {
    expect(encodeJxaString('a "quoted" path\\file')).toBe('"a \\"quoted\\" path\\\\file"')
  })

  it('builds a macOS pasteboard write script with file URLs', () => {
    const filePath = '/Users/me/带 空格.txt'
    const script = createMacClipboardWriteScript([filePath])

    expect(script).toContain('NSPasteboard.generalPasteboard')
    expect(script).toContain('NSURL.fileURLWithPath')
    expect(script).toContain('writeObjects')
    expect(script).toContain(encodeJxaString(filePath))
  })

  it('builds a macOS pasteboard read script for file URLs', () => {
    const script = createMacClipboardReadScript()

    expect(script).toContain('NSPasteboardURLReadingFileURLsOnlyKey')
    expect(script).toContain('readObjectsForClasses')
  })

  it('parses macOS pasteboard file URL output', () => {
    expect(parseMacClipboardPathsOutput('')).toEqual([])
    expect(parseMacClipboardPathsOutput('["/Users/me/a.txt","/Users/me/b.txt"]')).toEqual([
      '/Users/me/a.txt',
      '/Users/me/b.txt'
    ])
  })
})
