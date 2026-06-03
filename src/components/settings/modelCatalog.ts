// ── 模型供应商目录（从 AgentComposer 抽取，供设置页复用） ───────────────────────
import type { AgentModelConfig, AgentProviderApi } from '@/types'

export interface ProviderTemplate {
  id: string
  name: string
  description: string
  api?: AgentProviderApi
  baseUrl?: string
  providerId?: string
  apiKeyPlaceholder?: string
  baseUrlPlaceholder?: string
  builtin?: boolean
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'custom-openai',
    name: '自定义 OpenAI 接口',
    description: '默认入口。兼容百炼、腾讯兼容层、代理网关、LiteLLM、vLLM 等。',
    api: 'openai-completions',
    baseUrl: 'https://api.example.com/v1',
    providerId: 'custom-openai',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.example.com/v1'
  },
  { id: 'openai', name: 'OpenAI', description: '使用 Pi 内置 OpenAI provider，可一次配置多个模型。', api: 'openai-responses', builtin: true, apiKeyPlaceholder: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 官方接口，使用 Pi 内置 provider。', api: 'anthropic-messages', builtin: true, apiKeyPlaceholder: 'sk-ant-...' },
  { id: 'google', name: 'Google', description: 'Gemini / Google Generative AI 接口。', api: 'google-generative-ai', builtin: true, apiKeyPlaceholder: 'AIza...' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek 官方 provider，模型可单独启用或停用。', api: 'openai-completions', builtin: true, apiKeyPlaceholder: 'sk-...' },
  { id: 'openrouter', name: 'OpenRouter', description: '通过 OpenRouter 聚合多家模型。', api: 'openai-completions', builtin: true, apiKeyPlaceholder: 'sk-or-...' },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '本地模型。默认连接本机 Ollama OpenAI 兼容接口。',
    api: 'openai-completions',
    baseUrl: 'http://localhost:11434/v1',
    providerId: 'ollama',
    apiKeyPlaceholder: 'ollama',
    baseUrlPlaceholder: 'http://localhost:11434/v1'
  }
]

export const PROVIDER_TEMPLATE_MAP = Object.fromEntries(
  PROVIDER_TEMPLATES.map(p => [p.id, p])
) as Record<string, ProviderTemplate>

export function createDraftModel(providerId: string, seed = Date.now()): AgentModelConfig {
  const template = PROVIDER_TEMPLATE_MAP[providerId] ?? PROVIDER_TEMPLATE_MAP['custom-openai']
  return {
    id: `${providerId}-${seed}`,
    providerId: template.providerId ?? template.id,
    displayName: '',
    model: '',
    api: template.api,
    baseUrl: template.baseUrl,
    apiKey: template.id === 'ollama' ? 'ollama' : undefined,
    enabled: true,
    reasoning: false,
    defaultMode: 'craft',
    supportsTools: true,
    supportsVision: false,
    customProtocol: false
  }
}

export function getProviderGroupId(providerId: string): string {
  return PROVIDER_TEMPLATE_MAP[providerId] ? providerId : 'custom-openai'
}
