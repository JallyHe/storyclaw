import type { FileExt } from '@/types'

const EXT_COLOR: Record<string, string> = {
  ep: 'var(--c-ep)', chr: 'var(--c-chr)', wld: 'var(--c-wld)'
}

export function FileIcon({ ext }: { ext: FileExt }) {
  const color = EXT_COLOR[ext] ?? 'var(--c-ref)'
  return <span style={{ color, fontSize: 12, fontWeight: 700, minWidth: 28, display: 'inline-block' }}>.{ext}</span>
}
