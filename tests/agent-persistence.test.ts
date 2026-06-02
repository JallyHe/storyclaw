import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createDefaultAgentSnapshot,
  loadAgentSnapshot,
  saveAgentSnapshot
} from '../electron/agent/persistence'
import type { AgentSnapshot } from '../electron/agent/persistence'

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'storyclaw-agent-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('agent persistence', () => {
  it('returns a default snapshot when no state exists yet', async () => {
    const dir = await createTempDir()

    await expect(loadAgentSnapshot(dir)).resolves.toEqual(createDefaultAgentSnapshot())
  })

  it('round trips UI sessions, active session, mode, and pending changes', async () => {
    const dir = await createTempDir()
    const snapshot: AgentSnapshot = {
      version: 1,
      activeSessionId: 's_2',
      modeBySessionId: { s_2: 'plan' },
      sessions: [
        {
          id: 's_2',
          title: 'EP01 rewrite',
          group: '今天',
          time: '刚刚',
          archived: false,
          titleEdited: false,
          messages: [
            { role: 'user', text: '改第二场' },
            {
              role: 'assistant',
              steps: [{ kind: 'write', label: '修改剧本文件', target: '剧集/EP01.ep' }],
              reply: ['已生成改动。'],
              typing: true
            }
          ]
        }
      ],
      pendingChanges: [
        {
          fileId: join(dir, 'EP01.ep'),
          diffBlocks: [
            { blk: { id: 'b1', type: 'action', text: '新的动作。' }, diff: 'add' }
          ],
          newContent: {
            version: 1,
            episode: 'EP01',
            title: '测试',
            status: 'wip',
            logline: '',
            blocks: [{ id: 'b1', type: 'action', text: '新的动作。' }]
          }
        }
      ]
    }

    await saveAgentSnapshot(dir, snapshot)

    await expect(loadAgentSnapshot(dir)).resolves.toEqual({
      ...snapshot,
      sessions: [
        {
          ...snapshot.sessions[0],
          messages: [
            snapshot.sessions[0].messages[0],
            {
              ...snapshot.sessions[0].messages[1],
              typing: false
            }
          ]
        }
      ]
    })
  })

  it('keeps archived sessions but does not restore them as active', async () => {
    const dir = await createTempDir()
    const snapshot: AgentSnapshot = {
      version: 1,
      activeSessionId: 's_archived',
      modeBySessionId: { s_archived: 'craft', s_visible: 'ask' },
      sessions: [
        { id: 's_archived', title: '旧会话', group: '归档', time: '昨天', archived: true, messages: [] },
        { id: 's_visible', title: '当前会话', group: '今天', time: '刚刚', messages: [] }
      ],
      pendingChanges: []
    }

    await saveAgentSnapshot(dir, snapshot)

    const loaded = await loadAgentSnapshot(dir)
    expect(loaded.sessions.find(session => session.id === 's_archived')?.archived).toBe(true)
    expect(loaded.activeSessionId).toBe('s_visible')
  })
})
