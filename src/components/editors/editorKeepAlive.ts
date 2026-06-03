export const MAX_MOUNTED_EDITORS = 10

export function updateEditorKeepAliveList(
  current: string[],
  activeFile: string | null,
  openTabs: string[],
  limit = MAX_MOUNTED_EDITORS
): string[] {
  const openSet = new Set(openTabs)
  const kept = current.filter(path => openSet.has(path) && path !== activeFile)
  const next = activeFile && openSet.has(activeFile) ? [activeFile, ...kept] : kept
  return next.slice(0, Math.max(1, limit))
}
