import fs from 'fs/promises'
import path from 'path'
import type { AgentMode, AgentSnapshot, Session } from '../../src/types'
export type { AgentSnapshot } from '../../src/types'

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTimestamp(value: string | undefined, fallback = nowIso()): string {
  if (!value) return fallback
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback
}

function createDefaultSession(): Session {
  const now = nowIso()
  return {
    id: 's_new',
    title: '新会话',
    group: '进行中',
    time: now,
    createdAt: now,
    updatedAt: now,
    messages: []
  }
}

export function createDefaultAgentSnapshot(): AgentSnapshot {
  const session = createDefaultSession()
  return {
    version: 1,
    activeSessionId: session.id,
    modeBySessionId: { [session.id]: 'craft' },
    sessions: [session],
    pendingChanges: []
  }
}

export function getAgentSnapshotPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.storyclaw', 'agent-state.json')
}

export async function loadAgentSnapshot(workspaceRoot: string): Promise<AgentSnapshot> {
  const filePath = getAgentSnapshotPath(workspaceRoot)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return normalizeSnapshot(JSON.parse(raw))
  } catch (err: any) {
    if (err?.code === 'ENOENT') return createDefaultAgentSnapshot()
    throw err
  }
}

export async function saveAgentSnapshot(workspaceRoot: string, snapshot: AgentSnapshot): Promise<void> {
  const filePath = getAgentSnapshotPath(workspaceRoot)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(normalizeSnapshot(snapshot), null, 2), 'utf-8')
}

function normalizeSnapshot(input: Partial<AgentSnapshot>): AgentSnapshot {
  const fallback = createDefaultAgentSnapshot()
  const sessions = Array.isArray(input.sessions) && input.sessions.length > 0
    ? input.sessions.map(normalizeSession)
    : fallback.sessions
  const visibleSessions = sessions.filter(session => !session.archived)
  const activeSessionId = typeof input.activeSessionId === 'string' &&
    sessions.some(session => session.id === input.activeSessionId && !session.archived)
    ? input.activeSessionId
    : (visibleSessions[0] ?? sessions[0]).id

  return {
    version: 1,
    activeSessionId,
    modeBySessionId: normalizeModes(input.modeBySessionId, sessions),
    sessions,
    pendingChanges: Array.isArray(input.pendingChanges) ? input.pendingChanges : []
  }
}

function normalizeSession(session: Session): Session {
  const createdAt = normalizeTimestamp(session.createdAt ?? session.time)
  const updatedAt = normalizeTimestamp(session.updatedAt ?? session.time, createdAt)
  return {
    ...session,
    time: updatedAt,
    createdAt,
    updatedAt,
    archived: Boolean(session.archived),
    titleEdited: Boolean(session.titleEdited),
    messages: session.messages.map(message => {
      if (message.role === 'assistant') return { ...message, typing: false }
      return message
    })
  }
}

function normalizeModes(input: AgentSnapshot['modeBySessionId'] | undefined, sessions: Session[]) {
  const modes: Record<string, AgentMode> = {}
  for (const session of sessions) {
    const mode = input?.[session.id]
    modes[session.id] = mode === 'plan' || mode === 'ask' || mode === 'craft' ? mode : 'craft'
  }
  return modes
}
