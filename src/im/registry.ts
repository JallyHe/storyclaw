// ── IM 平台描述符注册表 ──────────────────────────────────────────────────────
// 单一数据源：集成卡片列表、配置弹窗表单、连接方式都从这里渲染。
//
// 新增一个平台（如飞书/微信）只需：
//   1. 在此追加一条 PlatformDescriptor
//   2. 在 electron/im/adapters/ 写对应 adapter，并在 manager 注册
// UI 与配置存储零改动。

import type { IMConnectionMode, IMPlatform } from './types'

export interface PlatformFieldDef {
  /** 存入 credentials 的键名，例如 clientId */
  key: string
  label: string
  placeholder?: string
  /** 密钥类字段渲染为密码框 */
  secret?: boolean
  required?: boolean
}

export interface PlatformConnectionDef {
  mode: IMConnectionMode
  label: string
  /** 置灰但展示（占位未来能力，如桌面端暂不支持的 URL 回调） */
  disabled?: boolean
  hint?: string
}

export interface PlatformDescriptor {
  id: IMPlatform
  /** 卡片标题，例如「钉钉机器人集成」 */
  name: string
  /** 卡片描述，例如「注册钉钉机器人以接收和回复消息。」 */
  description: string
  /** 弹窗标题，例如「注册钉钉通道」 */
  modalTitle: string
  /** 弹窗副标题 */
  modalDescription: string
  /** 配置指南链接 */
  guideUrl: string
  /** 支持的连接方式（第一项为默认） */
  connections: PlatformConnectionDef[]
  /** 凭据字段 */
  fields: PlatformFieldDef[]
  /** 是否已实现（未实现的平台卡片置灰，显示「敬请期待」） */
  available: boolean
}

export const PLATFORM_REGISTRY: PlatformDescriptor[] = [
  {
    id: 'dingtalk',
    name: '钉钉机器人集成',
    description: '注册钉钉机器人以接收和回复消息。',
    modalTitle: '注册钉钉通道',
    modalDescription: '输入钉钉机器人凭据以将此工作区绑定到钉钉机器人。',
    guideUrl: 'https://open.dingtalk.com/document/orgapp/the-creation-and-installation-of-the-application-robot-in-the',
    connections: [
      { mode: 'stream', label: 'WebSocket 长连接' },
      { mode: 'webhook', label: '使用 URL 回调', disabled: true, hint: '需公网地址，桌面端暂不支持' }
    ],
    fields: [
      { key: 'clientId', label: '钉钉 App Key', placeholder: '钉钉 App Key', required: true },
      { key: 'clientSecret', label: '钉钉 App Secret', placeholder: '钉钉 App Secret', secret: true, required: true },
      { key: 'cardTemplateId', label: 'AI 卡片模板 ID（可选）', placeholder: 'AI 卡片模板 ID，留空则用 Markdown 文本回复' }
    ],
    available: true
  },
  {
    id: 'feishu',
    name: '飞书集成',
    description: '注册飞书应用以通过飞书接收和回复消息。',
    modalTitle: '注册飞书通道',
    modalDescription: '输入飞书应用凭据以将此工作区绑定到飞书机器人。',
    guideUrl: 'https://open.feishu.cn/document/home/introduction-to-custom-app-development/self-built-application-development-process',
    connections: [
      { mode: 'stream', label: '长连接' },
      { mode: 'webhook', label: '使用 URL 回调', disabled: true }
    ],
    fields: [
      { key: 'appId', label: '飞书 App ID', placeholder: '飞书 App ID', required: true },
      { key: 'appSecret', label: '飞书 App Secret', placeholder: '飞书 App Secret', secret: true, required: true }
    ],
    available: false
  },
  {
    id: 'wechat',
    name: '企微助理集成',
    description: '注册企业微信应用以接收和回复消息。',
    modalTitle: '注册企业微信通道',
    modalDescription: '输入企业微信应用凭据以将此工作区绑定到企微机器人。',
    guideUrl: 'https://developer.work.weixin.qq.com/document/path/90664',
    connections: [
      { mode: 'webhook', label: '使用 URL 回调', disabled: true }
    ],
    fields: [
      { key: 'corpId', label: '企业 ID (CorpID)', placeholder: '企业 ID', required: true },
      { key: 'corpSecret', label: '应用 Secret', placeholder: '应用 Secret', secret: true, required: true }
    ],
    available: false
  }
]

export function getPlatformDescriptor(id: IMPlatform): PlatformDescriptor | undefined {
  return PLATFORM_REGISTRY.find(p => p.id === id)
}
