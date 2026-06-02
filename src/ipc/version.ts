import type { VersionDiff, VersionRecord, VersionSnapshot } from '@/types'
import { getApi } from './api'

export const versionIpc = {
  getSnapshot: (root: string): Promise<VersionSnapshot> =>
    getApi().version.getSnapshot(root),
  save: (root: string, message: string): Promise<VersionRecord> =>
    getApi().version.save(root, message),
  createLine: (root: string, kind: 'director' | 'platform'): Promise<VersionSnapshot> =>
    getApi().version.createLine(root, kind),
  markFinal: (root: string): Promise<VersionRecord> =>
    getApi().version.markFinal(root),
  restore: (root: string, versionId: string): Promise<VersionSnapshot> =>
    getApi().version.restore(root, versionId),
  compare: (root: string, fromId: string, toId: string): Promise<VersionDiff> =>
    getApi().version.compare(root, fromId, toId),
  compareWorkingFile: (root: string, filePath: string): Promise<VersionDiff> =>
    getApi().version.compareWorkingFile(root, filePath)
}
