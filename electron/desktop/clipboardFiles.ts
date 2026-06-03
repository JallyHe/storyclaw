import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ClipboardFileOperation = 'copy' | 'cut'

const DROPEFFECT_COPY = 1
const DROPEFFECT_MOVE = 2
const CLIPBOARD_PATHS_ENV = 'STORYCLAW_CLIPBOARD_PATHS_B64'

export function normalizeClipboardPaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of paths) {
    const cleaned = raw.trim()
    if (!cleaned) continue
    const decoded = /^file:\/\//i.test(cleaned)
      ? fileURLToPath(cleaned)
      : decodeURIComponent(cleaned)
    const normalized = path.normalize(decoded)
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized
    if (seen.has(key)) continue
    seen.add(key)
    if (fs.existsSync(normalized)) out.push(normalized)
  }
  return out
}

export function splitNullTerminatedPaths(text: string): string[] {
  return text.split('\0').map(item => item.trim()).filter(Boolean)
}

export function parseWindowsDropFiles(buffer: Buffer): string[] {
  if (buffer.length < 20) return []
  const offset = buffer.readUInt32LE(0)
  if (offset <= 0 || offset >= buffer.length) return []
  const wide = buffer.readUInt32LE(16) !== 0
  const raw = wide
    ? buffer.subarray(offset).toString('utf16le')
    : buffer.subarray(offset).toString('latin1')
  return splitNullTerminatedPaths(raw)
}

export function parseClipboardTextPaths(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(item => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

export function createWindowsDropFiles(paths: string[]): Buffer {
  const list = `${paths.join('\0')}\0\0`
  const body = Buffer.from(list, 'utf16le')
  const header = Buffer.alloc(20)
  header.writeUInt32LE(20, 0)
  header.writeUInt32LE(1, 16)
  return Buffer.concat([header, body])
}

export function createFileNameW(paths: string[]): Buffer {
  return Buffer.from(`${paths.join('\0')}\0\0`, 'utf16le')
}

export function createPreferredDropEffect(operation: ClipboardFileOperation): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(operation === 'cut' ? DROPEFFECT_MOVE : DROPEFFECT_COPY, 0)
  return buffer
}

export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

export function createClipboardPathsPayload(paths: string[]): string {
  return Buffer.from(JSON.stringify(paths), 'utf8').toString('base64')
}

export function createWindowsClipboardReadScript(): string {
  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
$out = New-Object System.Collections.Generic.List[string]
foreach ($file in $files) {
  [void]$out.Add([string]$file)
}
Write-Output (($out.ToArray() | ConvertTo-Json -Compress))
`.trim()
}

export function createWindowsClipboardWriteScript(operation: ClipboardFileOperation): string {
  const effect = operation === 'cut' ? DROPEFFECT_MOVE : DROPEFFECT_COPY
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:${CLIPBOARD_PATHS_ENV}))
$paths = @($json | ConvertFrom-Json)
$collection = New-Object System.Collections.Specialized.StringCollection
foreach ($file in $paths) {
  [void]$collection.Add([string]$file)
}
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($collection)
$data.SetText(($paths -join [System.Environment]::NewLine))
$effect = [UInt32]${effect}
$bytes = [System.BitConverter]::GetBytes($effect)
$stream = New-Object System.IO.MemoryStream
$stream.Write($bytes, 0, $bytes.Length)
$stream.Position = 0
$data.SetData('Preferred DropEffect', $stream)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`.trim()
}

export function parseWindowsClipboardPathsOutput(stdout: string): string[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as string | string[] | null
  if (typeof parsed === 'string') return [parsed]
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

export function encodeJxaString(value: string): string {
  return JSON.stringify(value)
}

export function createMacClipboardWriteScript(paths: string[]): string {
  const encodedPaths = paths.map(encodeJxaString).join(', ')
  return `
ObjC.import('AppKit')
const paths = [${encodedPaths}]
const urls = $.NSMutableArray.array
paths.forEach(path => {
  urls.addObject($.NSURL.fileURLWithPath(path))
})
const pasteboard = $.NSPasteboard.generalPasteboard
pasteboard.clearContents
pasteboard.writeObjects(urls)
`.trim()
}

export function createMacClipboardReadScript(): string {
  return `
ObjC.import('AppKit')
const pasteboard = $.NSPasteboard.generalPasteboard
const classes = $.NSArray.arrayWithObject($.NSURL.class)
const options = $.NSDictionary.dictionaryWithObjectForKey(
  true,
  $.NSPasteboardURLReadingFileURLsOnlyKey
)
const urls = pasteboard.readObjectsForClassesOptions(classes, options)
const out = []
if (urls) {
  const count = urls.count
  for (let index = 0; index < count; index += 1) {
    const path = urls.objectAtIndex(index).path
    if (path) out.push(ObjC.unwrap(path))
  }
}
JSON.stringify(out)
`.trim()
}

export function parseMacClipboardPathsOutput(stdout: string): string[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as unknown
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

function runPowerShellClipboardScript(script: string, env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodePowerShellCommand(script)
      ],
      {
        env: { ...process.env, ...env },
        timeout: 5000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message))
          return
        }
        resolve(stdout)
      }
    )
  })
}

function runJxaClipboardScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      {
        timeout: 5000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message))
          return
        }
        resolve(stdout)
      }
    )
  })
}

export async function readWindowsClipboardFilePaths(): Promise<string[]> {
  return parseWindowsClipboardPathsOutput(await runPowerShellClipboardScript(createWindowsClipboardReadScript()))
}

export async function writeWindowsClipboardFilePaths(
  paths: string[],
  operation: ClipboardFileOperation = 'copy'
): Promise<void> {
  if (paths.length === 0) return
  await runPowerShellClipboardScript(createWindowsClipboardWriteScript(operation), {
    [CLIPBOARD_PATHS_ENV]: createClipboardPathsPayload(paths)
  })
}

export async function readMacClipboardFilePaths(): Promise<string[]> {
  return parseMacClipboardPathsOutput(await runJxaClipboardScript(createMacClipboardReadScript()))
}

export async function writeMacClipboardFilePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await runJxaClipboardScript(createMacClipboardWriteScript(paths))
}
