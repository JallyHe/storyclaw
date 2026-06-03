// ── IM 配置持久化 ────────────────────────────────────────────────────────────
// 存到 Electron userData/im/im-config.json（全局，跨工作区共享），仿 agent config。

import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { IMConfigSnapshot, IMPlatform, IMPlatformConfig } from '../../src/im/types'

const CONFIG_VERSION = 1 as const

function imDir(): string {
  return path.join(app.getPath('userData'), 'im')
}

function configPath(): string {
  return path.join(imDir(), 'im-config.json')
}

function defaultConfig(): IMConfigSnapshot {
  return { version: CONFIG_VERSION, platforms: {} }
}

function normalize(input: any): IMConfigSnapshot {
  const platforms: IMConfigSnapshot['platforms'] = {}
  const raw = input?.platforms
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const p = raw[key]
      if (!p || typeof p !== 'object') continue
      platforms[key as IMPlatform] = {
        enabled: p.enabled === true,
        mode: p.mode === 'webhook' ? 'webhook' : 'stream',
        credentials: typeof p.credentials === 'object' && p.credentials ? { ...p.credentials } : {}
      }
    }
  }
  return { version: CONFIG_VERSION, platforms }
}

export async function loadIMConfig(): Promise<IMConfigSnapshot> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
    return defaultConfig()
  }
}

export async function saveIMConfig(config: IMConfigSnapshot): Promise<IMConfigSnapshot> {
  const normalized = normalize(config)
  await fs.mkdir(imDir(), { recursive: true })
  await fs.writeFile(configPath(), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

export function getPlatformConfig(
  config: IMConfigSnapshot,
  platform: IMPlatform
): IMPlatformConfig | undefined {
  return config.platforms[platform]
}
