const SCREENPLAY_TOOL_EXTS = new Set(['ep', 'md', 'chr', 'wld', 'cfg'])

const EXT_LABELS: Record<string, string> = {
  ep: '剧本文档',
  md: '大纲/Markdown 文档',
  chr: '人物文档',
  wld: '世界观/设定文档',
  cfg: '项目配置',
  txt: '文本资料',
  pdf: 'PDF 资料',
  docx: 'Word 资料'
}

export interface CurrentDocumentContext {
  activeFile: string | null
  workspaceRoot: string | null
}

export function workspaceRelativePath(absPath: string, root: string | null): string {
  if (!root) return absPath.replace(/\\/g, '/')
  const normalizedRoot = root.replace(/[\\/]+$/, '')
  const lowerPath = absPath.toLowerCase()
  const lowerRoot = normalizedRoot.toLowerCase()
  const rel = lowerPath.startsWith(lowerRoot.toLowerCase())
    ? absPath.slice(normalizedRoot.length)
    : absPath
  return rel.replace(/^[\\/]+/, '').replace(/\\/g, '/')
}

export function documentExtension(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? filePath
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

export function documentKindLabel(ext: string): string {
  return EXT_LABELS[ext] ?? '当前文档'
}

export function preferredReadTool(ext: string): string {
  return SCREENPLAY_TOOL_EXTS.has(ext) ? 'read_screenplay' : 'read_reference'
}

export function buildCurrentDocumentPromptContext({ activeFile, workspaceRoot }: CurrentDocumentContext): string {
  if (!activeFile) return ''
  const relPath = workspaceRelativePath(activeFile, workspaceRoot)
  const ext = documentExtension(activeFile)
  const kind = documentKindLabel(ext)
  const tool = preferredReadTool(ext)
  return [
    '## 当前打开文档',
    `- 路径：${relPath}`,
    `- 类型：${kind}`,
    `- 说明：用户当前正在查看这个文档。回答与创作任务默认优先围绕它理解。`,
    `- 按需读取：如果需要正文、结构、人物对白、设定细节或准备改写，请先调用 ${tool} 读取路径 "${relPath}"。`,
    '- 不要假设你已经读过全文；只在问题不需要正文细节时直接回答。'
  ].join('\n')
}

export function appendCurrentDocumentContext(userText: string, context: CurrentDocumentContext): string {
  const docContext = buildCurrentDocumentPromptContext(context)
  const selectionContext = buildSelectionPromptContext(userText)
  const contexts = [docContext, selectionContext].filter(Boolean)
  if (contexts.length === 0) return userText
  return `${contexts.join('\n\n')}\n\n## 用户请求\n${userText}`
}
import { buildSelectionPromptContext } from './selectionReference'

