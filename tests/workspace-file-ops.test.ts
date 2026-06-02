import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceItem,
  readStoryFile,
  renameWorkspaceItem
} from '../electron/fs/workspace'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'storyclaw-workspace-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('workspace file operations', () => {
  it('creates story folders and Chinese-format screenplay files', async () => {
    const folder = await createWorkspaceFolder(root, root, '剧集')
    const file = await createWorkspaceFile(root, folder, '第一集.ep')
    const data = await readStoryFile(file)

    expect(path.basename(folder)).toBe('剧集')
    expect(data).toMatchObject({ title: '第一集' })
    expect(JSON.stringify(data)).toContain('张山（笑着说）：你还是落到我手上啦')
  })

  it('renames and deletes items inside the workspace', async () => {
    const file = await createWorkspaceFile(root, root, '未命名.md')
    const renamed = await renameWorkspaceItem(root, file, '资料.md')

    await expect(fs.access(renamed)).resolves.toBeUndefined()
    await deleteWorkspaceItem(root, renamed)
    await expect(fs.access(renamed)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects path traversal for create targets', async () => {
    await expect(createWorkspaceFile(root, root, '../逃逸.ep')).rejects.toThrow('名称不能包含路径分隔符')
  })
})
