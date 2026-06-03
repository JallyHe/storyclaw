import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent'
import type {
  AgentConfigSnapshot,
  AgentConnectionTestResult,
  AgentModelConfig,
  AgentModelOption,
  AgentProviderApi
} from '../../src/types'

const CONFIG_VERSION = 1 as const
const PI_MODELS_FILE = 'models.json'

const BUILT_IN_PROVIDERS = new Set(['anthropic', 'openai', 'google', 'openrouter'])

/**
 * Global agent config directory — shared across all projects.
 * Stored in Electron's userData (e.g. %APPDATA%/StoryClaw/agent on Windows).
 * Model list, API keys and the Pi model registry live here.
 */
function globalAgentDir(): string {
  return path.join(app.getPath('userData'), 'agent')
}

/**
 * Returns paths for:
 *  - global config  (model list, API keys, Pi model registry)
 *  - project-level  (Pi Agent session data — stays per-workspace)
 */
export function getAgentConfigPaths(workspaceRoot = '') {
  const globalDir = globalAgentDir()
  const projectAgentDir = workspaceRoot ? path.join(workspaceRoot, '.storyclaw', 'pi-agent') : globalDir
  return {
    // ── Global (shared across all projects) ──────────────────
    globalDir,
    configJson: path.join(globalDir, 'agent-models.json'),
    authJson:   path.join(globalDir, 'auth.json'),
    modelsJson: path.join(globalDir, PI_MODELS_FILE),
    // ── Project-specific (session history, settings) ─────────
    agentDir:   projectAgentDir,
  }
}

export async function loadAgentConfig(_workspaceRoot?: string): Promise<AgentConfigSnapshot> {
  const paths = getAgentConfigPaths()
  try {
    const raw = await fs.readFile(paths.configJson, 'utf8')
    return normalizeConfig(JSON.parse(raw))
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err
    // First run — return empty config; don't write yet (no workspace dependency)
    return defaultConfig()
  }
}

export async function saveAgentConfig(
  configOrWorkspaceRoot: AgentConfigSnapshot | string,
  maybeConfig?: AgentConfigSnapshot
): Promise<AgentConfigSnapshot> {
  const config = typeof configOrWorkspaceRoot === 'string' ? maybeConfig : configOrWorkspaceRoot
  if (!config) return defaultConfig()
  const normalized = normalizeConfig(config)
  const paths = getAgentConfigPaths()
  // Global dirs for model config
  await fs.mkdir(paths.globalDir, { recursive: true })
  await fs.writeFile(paths.configJson, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  await writePiModelsJson(paths.modelsJson, normalized.models)
  return normalized
}

export async function listConfiguredAgentModels(_workspaceRoot?: string): Promise<AgentModelOption[]> {
  const config = await loadAgentConfig()
  return config.models.map(model => ({
    id: model.id,
    label: model.displayName,
    sub: `${model.providerId}/${model.model}${model.api ? ` · ${model.api}` : ''}`,
    provider: model.providerId,
    model: model.model,
    configured: Boolean(model.apiKey || model.providerId === 'ollama'),
    enabled: model.enabled,
    isDefault: model.id === config.activeModelId
  }))
}

export async function applyAgentModelConfig(
  workspaceRoot: string,
  modelId?: string
): Promise<ReturnType<ModelRegistry['find']>> {
  const config = await loadAgentConfig()
  const selected = pickModel(config, modelId)
  if (!selected) return undefined

  const paths = getAgentConfigPaths(workspaceRoot)
  await writePiModelsJson(paths.modelsJson, config.models)
  const authStorage = AuthStorage.create(paths.authJson)
  installRuntimeApiKeys(authStorage, config.models)
  const modelRegistry = ModelRegistry.create(authStorage, paths.modelsJson)
  modelRegistry.refresh()
  return modelRegistry.find(selected.providerId, selected.model)
}

export async function testAgentModel(
  modelId?: string
): Promise<AgentConnectionTestResult> {
  const config = await loadAgentConfig()
  const selected = pickModel(config, modelId)
  if (!selected) return { ok: false, message: '没有可用模型，请先启用一个模型配置。' }

  const paths = getAgentConfigPaths()
  await writePiModelsJson(paths.modelsJson, config.models)
  const authStorage = AuthStorage.create(paths.authJson)
  installRuntimeApiKeys(authStorage, config.models)
  const registry = ModelRegistry.create(authStorage, paths.modelsJson)
  registry.refresh()

  const model = registry.find(selected.providerId, selected.model)
  if (!model) return { ok: false, message: `Pi 未识别模型：${selected.providerId}/${selected.model}` }
  if (registry.getError()) return { ok: false, message: registry.getError() ?? 'models.json 加载失败。' }
  if (!registry.hasConfiguredAuth(model)) return { ok: false, message: '模型已识别，但还没有配置 API Key。' }

  return { ok: true, message: `模型可用：${selected.displayName}` }
}

export function installRuntimeApiKeys(authStorage: AuthStorage, models: AgentModelConfig[]): void {
  for (const model of models) {
    if (!model.enabled || !model.apiKey || !BUILT_IN_PROVIDERS.has(model.providerId)) continue
    authStorage.setRuntimeApiKey(model.providerId, model.apiKey)
  }
}

export interface PreparedAgentModelRuntime {
  config: AgentConfigSnapshot
  selected: AgentModelConfig | undefined
  authStorage: AuthStorage
  modelRegistry: ModelRegistry
  model: NonNullable<ReturnType<ModelRegistry['find']>> | undefined
}

export async function prepareAgentModelRuntime(
  workspaceRoot: string,
  modelId?: string
): Promise<PreparedAgentModelRuntime> {
  const config = await loadAgentConfig()
  const selected = pickModel(config, modelId)
  const paths = getAgentConfigPaths(workspaceRoot)
  await writePiModelsJson(paths.modelsJson, config.models)
  const authStorage = AuthStorage.create(paths.authJson)
  installRuntimeApiKeys(authStorage, config.models)
  const modelRegistry = ModelRegistry.create(authStorage, paths.modelsJson)
  modelRegistry.refresh()
  return {
    config,
    selected,
    authStorage,
    modelRegistry,
    model: selected ? modelRegistry.find(selected.providerId, selected.model) : undefined
  }
}

function defaultConfig(): AgentConfigSnapshot {
  return {
    version: CONFIG_VERSION,
    activeModelId: '',
    models: []
  }
}

function normalizeConfig(input: any): AgentConfigSnapshot {
  const models = Array.isArray(input?.models) ? input.models.map(normalizeModel).filter(Boolean) : []
  const safeModels = models.length > 0 ? models : []
  const firstEnabledModel = safeModels.find(model => model.enabled) ?? safeModels[0]
  const activeModelId =
    typeof input?.activeModelId === 'string' && safeModels.some(model => model.id === input.activeModelId)
      ? input.activeModelId
      : firstEnabledModel?.id ?? ''

  return { version: CONFIG_VERSION, activeModelId, models: safeModels }
}

function normalizeModel(input: any): AgentModelConfig | null {
  if (!input || typeof input !== 'object') return null
  const id = stringOr(input.id, slug(`${input.providerId ?? 'provider'}-${input.model ?? 'model'}`))
  const providerId = stringOr(input.providerId, 'openai')
  const model = stringOr(input.model, 'gpt-5')
  return {
    id,
    providerId,
    displayName: stringOr(input.displayName, model),
    model,
    api: normalizeApi(input.api),
    baseUrl: optionalString(input.baseUrl),
    apiKey: optionalString(input.apiKey),
    enabled: input.enabled !== false,
    reasoning: input.reasoning === true,
    defaultMode: input.defaultMode === 'ask' || input.defaultMode === 'plan' ? input.defaultMode : 'craft',
    supportsTools: input.supportsTools !== false,
    supportsVision: input.supportsVision === true,
    customProtocol: input.customProtocol === true,
    inputWindow: optionalString(input.inputWindow),
    outputWindow: optionalString(input.outputWindow)
  }
}

function pickModel(config: AgentConfigSnapshot, modelId?: string): AgentModelConfig | undefined {
  return (
    config.models.find(model => model.enabled && model.id === (modelId ?? config.activeModelId)) ??
    config.models.find(model => model.enabled)
  )
}

async function writePiModelsJson(modelsJson: string, models: AgentModelConfig[]): Promise<void> {
  const providers: Record<string, any> = {}
  for (const model of models.filter(item => item.enabled)) {
    if (!model.baseUrl && BUILT_IN_PROVIDERS.has(model.providerId)) continue
    const provider = providers[model.providerId] ?? {
      ...(model.baseUrl ? { baseUrl: model.baseUrl } : {}),
      ...(model.api ? { api: model.api } : {}),
      ...(model.apiKey ? { apiKey: model.apiKey } : {}),
      models: []
    }
    // For custom (non-official-OpenAI) endpoints, disable the `developer` role.
    // The `developer` role is an OpenAI-only extension; all other OpenAI-compatible
    // providers (Qwen, DeepSeek, Ollama, LiteLLM, etc.) only accept `system`.
    const isOfficialOpenAI = (model.baseUrl ?? '').includes('api.openai.com')
    const needsSystemRole = !isOfficialOpenAI
    provider.models.push({
      id: model.model,
      name: model.displayName,
      reasoning: model.reasoning,
      ...(needsSystemRole ? { compat: { supportsDeveloperRole: false } } : {})
    })
    providers[model.providerId] = provider
  }

  await fs.mkdir(path.dirname(modelsJson), { recursive: true })
  await fs.writeFile(modelsJson, `${JSON.stringify({ providers }, null, 2)}\n`, 'utf8')
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeApi(value: unknown): AgentProviderApi | undefined {
  if (
    value === 'openai-completions' ||
    value === 'openai-responses' ||
    value === 'anthropic-messages' ||
    value === 'google-generative-ai'
  ) {
    return value
  }
  return undefined
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'model'
}
