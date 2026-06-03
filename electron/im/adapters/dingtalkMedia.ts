// ── 钉钉媒体发送 ─────────────────────────────────────────────────────────────
// 文档：https://open.dingtalk.com/document/development/robot-message-type
// sessionWebhook 仅支持 text/markdown/link/actionCard/feedCard，
// 文件/视频/音频需先上传媒体拿 mediaId，再用机器人 OTO 消息接口 sampleFile 下发。

import fs from 'fs/promises'
import path from 'path'

const OAPI = 'https://oapi.dingtalk.com'
const API = 'https://api.dingtalk.com/v1.0'

interface TokenCache { token: string; expireAt: number }
const tokenCache = new Map<string, TokenCache>()

/** 获取并缓存企业 access token（提前 2 分钟过期）。 */
export async function getAccessToken(appKey: string, appSecret: string): Promise<string> {
  const cached = tokenCache.get(appKey)
  if (cached && cached.expireAt > Date.now()) return cached.token

  const res = await fetch(`${API}/oauth2/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, appSecret })
  })
  if (!res.ok) throw new Error(`获取钉钉 access token 失败：HTTP ${res.status}`)
  const data: any = await res.json()
  const token: string = data.accessToken
  if (!token) throw new Error('钉钉返回的 access token 为空')
  tokenCache.set(appKey, { token, expireAt: Date.now() + ((data.expireIn ?? 7200) - 120) * 1000 })
  return token
}

/** 上传媒体文件，返回 mediaId。type: image/voice/video/file。 */
export async function uploadMedia(
  token: string,
  type: 'image' | 'voice' | 'video' | 'file',
  absPath: string
): Promise<string> {
  const buffer = await fs.readFile(absPath)
  const fileName = path.basename(absPath)
  const form = new FormData()
  // undici 的 FormData/Blob：用文件二进制构造
  form.append('media', new Blob([new Uint8Array(buffer)]), fileName)

  const res = await fetch(`${OAPI}/media/upload?access_token=${encodeURIComponent(token)}&type=${type}`, {
    method: 'POST',
    body: form
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || data.errcode) {
    throw new Error(`上传钉钉媒体失败：${data.errmsg ?? `HTTP ${res.status}`}`)
  }
  if (!data.media_id) throw new Error('钉钉未返回 media_id')
  return data.media_id
}

/** 通过机器人 OTO 接口给指定用户发送一条文件消息（sampleFile）。 */
export async function sendSampleFile(
  token: string,
  robotCode: string,
  userIds: string[],
  mediaId: string,
  fileName: string
): Promise<void> {
  const fileType = path.extname(fileName).replace('.', '') || 'file'
  const res = await fetch(`${API}/robot/oToMessages/batchSend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-acs-dingtalk-access-token': token },
    body: JSON.stringify({
      robotCode,
      userIds,
      msgKey: 'sampleFile',
      msgParam: JSON.stringify({ mediaId, fileName, fileType })
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`发送钉钉文件消息失败：HTTP ${res.status} ${body.slice(0, 200)}`)
  }
}

/** 上传并发送一个本地文件（文件/视频/音频统一作为文件附件下发）。 */
export async function sendFileToUser(
  appKey: string,
  appSecret: string,
  robotCode: string,
  userId: string,
  absPath: string
): Promise<void> {
  const token = await getAccessToken(appKey, appSecret)
  const mediaId = await uploadMedia(token, 'file', absPath)
  await sendSampleFile(token, robotCode, [userId], mediaId, path.basename(absPath))
}
