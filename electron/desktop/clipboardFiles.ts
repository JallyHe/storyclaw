import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ClipboardFileOperation = 'copy' | 'cut'

const DROPEFFECT_COPY = 1
const DROPEFFECT_MOVE = 2

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
