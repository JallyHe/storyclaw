import fs from 'fs/promises'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => `${process.cwd()}/.tmp-agent-user-data`
  }
}))
import {
  applyAgentModelConfig,
  getAgentConfigPaths,
  listConfiguredAgentModels,
  loadAgentConfig,
  saveAgentConfig
} from '../electron/agent/config'

const tempRoots: string[] = []
const mockUserData = path.join(process.cwd(), '.tmp-agent-user-data')

async function makeWorkspace() {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-agent-config-'))
  tempRoots.push(root)
  return root
}

beforeEach(async () => {
  await fs.rm(mockUserData, { recursive: true, force: true })
})

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  await fs.rm(mockUserData, { recursive: true, force: true })
})

describe('agent model config', () => {
  it('creates an empty workspace config without injecting built-in models', async () => {
    const root = await makeWorkspace()

    const config = await loadAgentConfig(root)
    const options = await listConfiguredAgentModels(root)

    expect(config.version).toBe(1)
    expect(config.models).toEqual([])
    expect(config.activeModelId).toBe('')
    expect(options).toEqual([])
    expect(JSON.stringify(options)).not.toContain('sk-test')
  })

  it('persists custom model config and writes pi-compatible models.json', async () => {
    const root = await makeWorkspace()
    const saved = await saveAgentConfig(root, {
      version: 1,
      activeModelId: 'local-qwen',
      models: [
        {
          id: 'local-qwen',
          providerId: 'ollama',
          displayName: 'Local Qwen',
          model: 'qwen2.5-coder:7b',
          api: 'openai-completions',
          baseUrl: 'http://localhost:11434/v1',
          apiKey: 'ollama',
          enabled: true,
          reasoning: false,
          defaultMode: 'craft'
        }
      ]
    })

    const paths = getAgentConfigPaths(root)
    const piModels = JSON.parse(await fs.readFile(paths.modelsJson, 'utf8'))

    expect(saved.activeModelId).toBe('local-qwen')
    expect(piModels.providers.ollama).toMatchObject({
      baseUrl: 'http://localhost:11434/v1',
      api: 'openai-completions',
      apiKey: 'ollama',
      models: [{ id: 'qwen2.5-coder:7b', name: 'Local Qwen', reasoning: false }]
    })
  })

  it('applies api key overrides and resolves the active model', async () => {
    const root = await makeWorkspace()
    const config = await saveAgentConfig(root, {
      version: 1,
      activeModelId: 'openai-gpt5',
      models: [
        {
          id: 'openai-gpt5',
          providerId: 'openai',
          displayName: 'GPT-5',
          model: 'gpt-5',
          apiKey: 'sk-test-openai',
          enabled: true,
          reasoning: true,
          defaultMode: 'craft'
        }
      ]
    })

    const applied = await applyAgentModelConfig(root, config.activeModelId)

    expect(applied?.provider).toBe('openai')
    expect(applied?.id).toBe('gpt-5')
  })

  it('lists only user-configured models across providers', async () => {
    const root = await makeWorkspace()

    await saveAgentConfig(root, {
      version: 1,
      activeModelId: 'deepseek-chat',
      models: [
        {
          id: 'deepseek-chat',
          providerId: 'deepseek',
          displayName: 'DeepSeek Chat',
          model: 'deepseek-chat',
          enabled: true,
          reasoning: false,
          defaultMode: 'craft'
        },
        {
          id: 'custom-qwen',
          providerId: 'custom-openai',
          displayName: 'Qwen via Custom Gateway',
          model: 'qwen-max',
          api: 'openai-completions',
          baseUrl: 'https://example.test/v1',
          apiKey: 'sk-custom',
          enabled: true,
          reasoning: true,
          defaultMode: 'plan'
        }
      ]
    })

    const options = await listConfiguredAgentModels(root)

    expect(options).toHaveLength(2)
    expect(options.map(option => option.id)).toEqual(['deepseek-chat', 'custom-qwen'])
    expect(options.find(option => option.id === 'custom-qwen')).toMatchObject({
      provider: 'custom-openai',
      configured: true,
      supportsTools: true
    })
  })

  it('surfaces models that cannot use tools', async () => {
    const root = await makeWorkspace()

    await saveAgentConfig(root, {
      version: 1,
      activeModelId: 'plain-chat',
      models: [
        {
          id: 'plain-chat',
          providerId: 'custom-openai',
          displayName: 'Plain Chat',
          model: 'plain-chat',
          api: 'openai-completions',
          baseUrl: 'https://example.test/v1',
          apiKey: 'sk-custom',
          enabled: true,
          reasoning: false,
          defaultMode: 'craft',
          supportsTools: false
        }
      ]
    })

    const options = await listConfiguredAgentModels(root)

    expect(options[0]).toMatchObject({
      id: 'plain-chat',
      supportsTools: false
    })
  })
})
