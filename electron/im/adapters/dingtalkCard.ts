// ── 钉钉 AI 流式卡片 REST 客户端 ─────────────────────────────────────────────
// 文档：开放平台「互动卡片 / AI 卡片流式更新」。
// 需要在钉钉卡片平台创建一个含「流式 Markdown」组件（key=content）的卡片模板，
// 把模板 ID 填入配置。未配置模板时机器人回退为纯文本回复。

const BASE = 'https://api.dingtalk.com/v1.0'

interface TokenCache { token: string; expireAt: number }
const tokenCache = new Map<string, TokenCache>()

/** 获取并缓存 access token（提前 2 分钟过期）。 */
export async function getAccessToken(appKey: string, appSecret: string): Promise<string> {
  const cacheKey = appKey
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) return cached.token

  const res = await fetch(`${BASE}/oauth2/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, appSecret })
  })
  if (!res.ok) throw new Error(`获取钉钉 access token 失败：HTTP ${res.status}`)
  const data: any = await res.json()
  const token: string = data.accessToken
  const expireIn: number = data.expireIn ?? 7200
  if (!token) throw new Error('钉钉返回的 access token 为空')
  tokenCache.set(cacheKey, { token, expireAt: Date.now() + (expireIn - 120) * 1000 })
  return token
}

export interface CardDeliverContext {
  /** 1:1 会话为 '1'，群会话为 '2' */
  conversationType: string
  conversationId: string
  /** 发送者 staffId（= userId，1:1 投放需要） */
  senderStaffId: string
  /** 机器人 code（一般等于 appKey/clientId） */
  robotCode: string
}

/** 钉钉要求 cardParamMap 的值全部为 string，非字符串需 JSON 序列化。 */
function stringifyParams(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') result[key] = value
    else {
      try { result[key] = JSON.stringify(value) } catch { result[key] = '' }
    }
  }
  return result
}

function buildDeliverModel(outTrackId: string, cardTemplateId: string, ctx: CardDeliverContext) {
  const isGroup = ctx.conversationType === '2'
  const base: Record<string, any> = {
    cardTemplateId,
    outTrackId,
    callbackType: 'STREAM',
    userId: ctx.senderStaffId,
    userIdType: 1,
    cardData: {
      cardParamMap: stringifyParams({ content: '', lastMessage: '正在思考中…' })
    }
  }
  if (isGroup) {
    // 群会话：openSpaceId 用小写 im_group + 群会话 id
    base.openSpaceId = `dtv1.card//im_group.${ctx.conversationId}`
    base.imGroupOpenSpaceModel = { supportForward: true }
    base.imGroupOpenDeliverModel = { robotCode: ctx.robotCode }
  } else {
    // 1:1：openSpaceId 用小写 im_robot + userId（对齐官方样例）
    base.openSpaceId = `dtv1.card//im_robot.${ctx.senderStaffId}`
    base.imRobotOpenSpaceModel = { supportForward: true }
    base.imRobotOpenDeliverModel = { spaceType: 'IM_ROBOT', robotCode: ctx.robotCode }
  }
  return base
}

/** 创建并投放卡片实例。 */
export async function createAndDeliverCard(
  token: string,
  outTrackId: string,
  cardTemplateId: string,
  ctx: CardDeliverContext
): Promise<void> {
  const res = await fetch(`${BASE}/card/instances/createAndDeliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-acs-dingtalk-access-token': token },
    body: JSON.stringify(buildDeliverModel(outTrackId, cardTemplateId, ctx))
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`创建钉钉卡片失败：HTTP ${res.status} ${body.slice(0, 200)}`)
  }
}

/** 流式更新卡片内容（key 固定为 content，与模板组件绑定一致）。 */
export async function streamingUpdate(
  token: string,
  outTrackId: string,
  guid: string,
  content: string,
  isFinalize: boolean
): Promise<void> {
  const res = await fetch(`${BASE}/card/streaming`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-acs-dingtalk-access-token': token },
    body: JSON.stringify({
      outTrackId,
      guid,
      key: 'content',
      content,
      isFull: true,
      isError: false,
      isFinalize
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`更新钉钉卡片失败：HTTP ${res.status} ${body.slice(0, 200)}`)
  }
}
