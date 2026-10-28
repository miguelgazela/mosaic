export interface LinkContent {
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  embed?: { provider: 'youtube' | 'vimeo'; id: string }
  duration?: number
  failed?: boolean
}

export const linkContent = (c: Record<string, unknown>): LinkContent => {
  const s = (k: string) => (typeof c[k] === 'string' && c[k] ? (c[k] as string) : undefined)
  const e = c.embed as { provider?: string; id?: unknown } | undefined
  return {
    url: s('url') ?? '',
    title: s('title'),
    description: s('description'),
    image: s('image'),
    favicon: s('favicon'),
    embed: e && (e.provider === 'youtube' || e.provider === 'vimeo') && typeof e.id === 'string' ? { provider: e.provider, id: e.id } : undefined,
    duration: typeof c.duration === 'number' ? c.duration : undefined,
    failed: c.failed === true,
  }
}

/** Accepts "example.com/a" or a full URL; returns a normalised http(s) URL or null. */
export function normalizeUrl(input: string): string | null {
  const t = input.trim()
  if (!t || /\s/.test(t)) return null
  if (/^[a-z][a-z0-9+.-]*:(?!\/\/|\d)/i.test(t)) return null // mailto:, javascript:, tel: …
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.href
  } catch { return null }
}

export const domainOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** Plain-looking display of a URL without the scheme, for the failed state. */
export const displayUrl = (url: string): string => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function embedSrc(e: { provider: 'youtube' | 'vimeo'; id: string }): string {
  const id = encodeURIComponent(e.id)
  return e.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${id}?autoplay=1`
}
