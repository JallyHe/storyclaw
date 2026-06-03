export interface SelectionReference {
  filePath: string
  relPath: string
  from: number
  to: number
  startBlockId?: string
  endBlockId?: string
  startBlockType?: string
  endBlockType?: string
}

const SELECTION_TOKEN_PREFIX = '@selection:'

export function encodeSelectionReference(ref: SelectionReference): string {
  const payload: SelectionReference = {
    filePath: ref.filePath,
    relPath: ref.relPath,
    from: ref.from,
    to: ref.to,
    startBlockId: ref.startBlockId,
    endBlockId: ref.endBlockId,
    startBlockType: ref.startBlockType,
    endBlockType: ref.endBlockType
  }
  return `${SELECTION_TOKEN_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`
}

export function decodeSelectionReference(token: string): SelectionReference | null {
  if (!token.startsWith(SELECTION_TOKEN_PREFIX)) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(token.slice(SELECTION_TOKEN_PREFIX.length))) as Partial<SelectionReference>
    if (
      typeof parsed.filePath !== 'string' ||
      typeof parsed.relPath !== 'string' ||
      typeof parsed.from !== 'number' ||
      typeof parsed.to !== 'number'
    ) return null
    return {
      filePath: parsed.filePath,
      relPath: parsed.relPath,
      from: parsed.from,
      to: parsed.to,
      startBlockId: typeof parsed.startBlockId === 'string' ? parsed.startBlockId : undefined,
      endBlockId: typeof parsed.endBlockId === 'string' ? parsed.endBlockId : undefined,
      startBlockType: typeof parsed.startBlockType === 'string' ? parsed.startBlockType : undefined,
      endBlockType: typeof parsed.endBlockType === 'string' ? parsed.endBlockType : undefined
    }
  } catch {
    return null
  }
}

export function selectionLabel(ref: SelectionReference): string {
  const name = ref.relPath.split('/').pop() ?? ref.relPath
  return `选区 ${name}:${ref.from}-${ref.to}`
}

export function findSelectionReferences(text: string): SelectionReference[] {
  const refs: SelectionReference[] = []
  for (const match of text.matchAll(/@selection:[^\s]+/g)) {
    const ref = decodeSelectionReference(match[0])
    if (ref) refs.push(ref)
  }
  return refs
}

export function buildSelectionPromptContext(text: string): string {
  const refs = findSelectionReferences(text)
  if (refs.length === 0) return ''
  return [
    '## 选区引用',
    ...refs.map((ref, index) => [
      `- 引用 ${index + 1}:`,
      `  - 路径：${ref.relPath}`,
      `  - ProseMirror 位置：${ref.from}-${ref.to}`,
      ref.startBlockId ? `  - 起始块：${ref.startBlockType ?? 'block'}#${ref.startBlockId}` : '',
      ref.endBlockId ? `  - 结束块：${ref.endBlockType ?? 'block'}#${ref.endBlockId}` : '',
      `  - 按需读取：需要正文时先调用 read_screenplay 读取 "${ref.relPath}"，再按块 id 或位置定位。`
    ].filter(Boolean).join('\n')),
    '- 注意：用户消息里的 @selection 只代表位置引用，不包含被选中文本正文；不要假设已读取选区内容。'
  ].join('\n')
}

