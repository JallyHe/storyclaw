import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  compareWorkingFile,
  createVersionLine,
  getVersionSnapshot,
  markFinalVersion,
  restoreVersion,
  saveVersion
} from '../electron/versioning/service'

async function makeWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), 'storyclaw-version-'))
  await writeFile(path.join(root, '剧本.ep'), '{"version":1,"blocks":[]}', 'utf-8')
  return root
}

describe('local versioning service', () => {
  it('saves readable local version records without exposing git concepts', async () => {
    const root = await makeWorkspace()

    await saveVersion(root, '第一稿完成')
    await writeFile(path.join(root, '剧本.ep'), '{"version":1,"blocks":[{"type":"action","id":"a1","text":"开场。"}]}', 'utf-8')
    await saveVersion(root, '增加开场动作')

    const snapshot = await getVersionSnapshot(root)

    expect(snapshot.currentLine).toBe('主版本')
    expect(snapshot.lines.map(line => line.name)).toContain('主版本')
    expect(snapshot.records).toHaveLength(2)
    expect(snapshot.records[0]).toMatchObject({
      message: '增加开场动作',
      lineName: '主版本',
      isFinal: false
    })
    expect(snapshot.records[0].changedFiles).toContain('剧本.ep')
    expect(snapshot.currentFiles).toEqual([])
  }, 15000)

  it('reports current working files before they are saved as a version', async () => {
    const root = await makeWorkspace()
    const filePath = path.join(root, '剧本.ep')

    await saveVersion(root, '第一稿')
    await writeFile(filePath, '{"version":1,"blocks":[{"type":"action","id":"a1","text":"未保存修改。"}]}', 'utf-8')

    const snapshot = await getVersionSnapshot(root)

    expect(snapshot.hasChanges).toBe(true)
    expect(snapshot.currentFiles).toContainEqual({ path: '剧本.ep', status: 'modified' })
  }, 15000)

  it('reports untracked current files with spaces without porcelain quotes', async () => {
    const root = await makeWorkspace()
    const folder = path.join(root, '人物')
    const filePath = path.join(folder, '主角 (1).chr')

    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, '.keep'), '', 'utf-8')
    await saveVersion(root, '初始化人物目录')
    await writeFile(filePath, '{"version":1,"name":"主角","role":"","age":30,"color":"#e0a458","tagline":"","traits":[],"arc":"","voice":"","appearsIn":[]}', 'utf-8')

    const snapshot = await getVersionSnapshot(root)

    expect(snapshot.currentFiles).toContainEqual({ path: '人物/主角 (1).chr', status: 'untracked' })
  }, 15000)

  it('creates named creative version lines', async () => {
    const root = await makeWorkspace()

    await saveVersion(root, '初始版本')
    await createVersionLine(root, 'director')

    const snapshot = await getVersionSnapshot(root)

    expect(snapshot.currentLine).toBe('导演版')
    expect(snapshot.lines.map(line => line.name)).toEqual(expect.arrayContaining(['主版本', '导演版']))
  }, 15000)

  it('marks the current record as final', async () => {
    const root = await makeWorkspace()

    const saved = await saveVersion(root, '可送审版本')
    const finalRecord = await markFinalVersion(root)
    const snapshot = await getVersionSnapshot(root)

    expect(finalRecord.id).toBe(saved.id)
    expect(snapshot.records[0].isFinal).toBe(true)
    expect(snapshot.records[0].label).toBe('定稿')
  }, 15000)

  it('creates a safety record before restoring an older version', async () => {
    const root = await makeWorkspace()
    const filePath = path.join(root, '剧本.ep')

    const first = await saveVersion(root, '第一版')
    await writeFile(filePath, '{"version":1,"blocks":[{"type":"action","id":"a1","text":"第二版。"}]}', 'utf-8')
    await saveVersion(root, '第二版')

    await restoreVersion(root, first.id)

    const restored = await readFile(filePath, 'utf-8')
    const snapshot = await getVersionSnapshot(root)

    expect(restored).toContain('"blocks":[]')
    expect(snapshot.records.some(record => record.message.includes('恢复前备份'))).toBe(true)
  }, 15000)

  it('compares two saved versions', async () => {
    const root = await makeWorkspace()
    const filePath = path.join(root, '剧本.ep')

    const first = await saveVersion(root, '第一版')
    await writeFile(filePath, '{"version":1,"blocks":[{"type":"action","id":"a1","text":"第二版。"}]}', 'utf-8')
    const second = await saveVersion(root, '第二版')

    const diff = await compareVersions(root, first.id, second.id)

    expect(diff.files[0]).toMatchObject({ path: '剧本.ep' })
    expect(diff.patch).toContain('第二版')
  }, 15000)

  it('compares a current working file against the saved version', async () => {
    const root = await makeWorkspace()
    const filePath = path.join(root, '剧本.ep')

    await saveVersion(root, '第一版')
    await writeFile(filePath, '{"version":1,"blocks":[{"type":"action","id":"a1","text":"当前改动。"}]}', 'utf-8')

    const diff = await compareWorkingFile(root, '剧本.ep')

    expect(diff.fromId).toBe('HEAD')
    expect(diff.toId).toBe('WORKTREE')
    expect(diff.files[0]).toMatchObject({ path: '剧本.ep' })
    expect(diff.patch).toContain('当前改动')
  }, 15000)
})
