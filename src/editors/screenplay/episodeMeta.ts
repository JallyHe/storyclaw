export function episodeNumberFromCode(code: string, fallback = 1): string {
  const match = code.match(/(\d+)/)
  return match ? String(Number(match[1]) || fallback) : String(fallback)
}

export function episodeCodeFromNumber(value: string): string {
  const number = Math.max(1, Number.parseInt(value, 10) || 1)
  return `EP${String(number).padStart(2, '0')}`
}

export function episodeLabel(code: string, fallback = 1): string {
  return `第${episodeNumberFromCode(code, fallback)}集`
}
