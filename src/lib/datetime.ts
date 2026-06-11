/** 把各种形态的时间值解析为 epoch 毫秒；无法解析返回 undefined。
 * 接受：number(ms 或秒)、数字字符串、ISO/可被 Date 解析的日期字符串。
 * 不接受：'刚刚'、'5分钟前' 这类人类文案（返回 undefined，由调用方原样回退）。
 */
export function resolveEpochMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 10 位左右视为秒级时间戳，补成毫秒
    return value > 0 && value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return undefined
    if (/^\d+$/.test(s)) return resolveEpochMs(Number(s))
    const parsed = Date.parse(s) // ISO、RFC 等
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

/** 会话时间的智能相对格式化。
 * 规则：<1分钟→刚刚；<60分钟→N分钟前；今天→今天 HH:mm；昨天→昨天 HH:mm；
 * 本年→M月D日；更早→YYYY/M/D。
 * 优先用 ts；ts 无效时尝试把 fallback 当日期解析（兼容旧数据里存成 ISO 串的 time）；
 * 都不行才把 fallback 原样返回（如 '刚刚'）。
 */
export function formatSessionTime(ts: number | undefined, fallback = ''): string {
  const ms = resolveEpochMs(ts) ?? resolveEpochMs(fallback)
  if (ms === undefined) return fallback

  const now = new Date()
  const then = new Date(ms)
  const diffMs = now.getTime() - ms
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMs < 0) {
    // 时钟漂移/未来时间：直接给绝对日期，避免「-3分钟前」
    return `${then.getFullYear()}/${then.getMonth() + 1}/${then.getDate()}`
  }
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`

  const hh = String(then.getHours()).padStart(2, '0')
  const mm = String(then.getMinutes()).padStart(2, '0')
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400000

  if (ms >= startOfToday) return `今天 ${hh}:${mm}`
  if (ms >= startOfYesterday) return `昨天 ${hh}:${mm}`
  if (then.getFullYear() === now.getFullYear()) return `${then.getMonth() + 1}月${then.getDate()}日`
  return `${then.getFullYear()}/${then.getMonth() + 1}/${then.getDate()}`
}
