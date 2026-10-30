// OpenGraph / Twitter / <title> extraction and oEmbed helpers. Pure functions.

export interface Unfurl {
  title?: string
  description?: string
  image?: string
  favicon?: string
  embed?: { provider: 'youtube' | 'vimeo'; id: string }
  duration?: number
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

const clean = (s: string | undefined, max: number): string | undefined => {
  const t = s?.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : undefined
}

const resolveUrl = (v: string | undefined, base: URL): string | undefined => {
  if (!v) return undefined
  try {
    const u = new URL(v, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch { return undefined }
}

/** First `image` in the page's JSON-LD (schema.org), e.g. shops that put the product photo there instead of og:image. */
export function jsonLdImage(html: string): string | undefined {
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v
    if (Array.isArray(v)) { for (const x of v) { const r = pick(x); if (r) return r } return undefined }
    if (v && typeof v === 'object') { const o = v as Record<string, unknown>; return pick(o.url ?? o.contentUrl) }
    return undefined
  }
  const walk = (o: unknown, depth: number): string | undefined => {
    if (depth > 6 || !o || typeof o !== 'object') return undefined
    if (Array.isArray(o)) { for (const x of o) { const r = walk(x, depth + 1); if (r) return r } return undefined }
    const rec = o as Record<string, unknown>
    if ('image' in rec) { const r = pick(rec.image); if (r) return r }
    for (const v of Object.values(rec)) { const r = walk(v, depth + 1); if (r) return r }
    return undefined
  }
  for (const m of html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const r = walk(JSON.parse(m[1]), 0); if (r) return r } catch { /* bad JSON-LD: skip */ }
  }
  return undefined
}

export function parseHtml(html: string, base: URL): Unfurl {
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : undefined)
  const meta: Record<string, string> = {}
  const icons: { href: string; rel: string }[] = []
  for (const m of head.matchAll(/<(meta|link)\b[^>]*>/gi)) {
    const a = attrs(m[0])
    if (m[1].toLowerCase() === 'meta') {
      const key = (a.property ?? a.name ?? '').toLowerCase()
      if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content
    } else if (a.href && /\bicon\b/i.test(a.rel ?? '')) icons.push({ href: a.href, rel: a.rel })
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const icon = icons.find((i) => /^icon$|shortcut icon/i.test(i.rel.trim())) ?? icons[0]
  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? (titleTag ? decodeEntities(titleTag) : undefined), 300),
    description: clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'], 600),
    image: resolveUrl(meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'] ?? meta['twitter:image:src'] ?? jsonLdImage(html), base),
    favicon: resolveUrl(icon?.href ?? '/favicon.ico', base),
  }
}

/** YouTube / Vimeo recognition. Returns null for anything else. */
export function detectVideo(u: URL): { provider: 'youtube' | 'vimeo'; id: string } | null {
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '')
  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1]
    return id && /^[\w-]{6,20}$/.test(id) ? { provider: 'youtube', id } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id = u.searchParams.get('v')
    const seg = u.pathname.split('/')
    if (!id && ['embed', 'shorts', 'live', 'v'].includes(seg[1])) id = seg[2]
    return id && /^[\w-]{6,20}$/.test(id) ? { provider: 'youtube', id } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).find((s) => /^\d+$/.test(s))
    return id ? { provider: 'vimeo', id } : null
  }
  return null
}

export function oembedUrl(v: { provider: 'youtube' | 'vimeo'; id: string }): string {
  return v.provider === 'youtube'
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${v.id}`)}`
}

export function parseOembed(json: unknown, v: { provider: 'youtube' | 'vimeo'; id: string }, base: URL): Unfurl {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined)
  return {
    title: clean(str('title'), 300),
    description: clean(str('description'), 600),
    image: resolveUrl(str('thumbnail_url'), base),
    favicon: v.provider === 'youtube' ? 'https://www.youtube.com/favicon.ico' : 'https://vimeo.com/favicon.ico',
    embed: v,
    ...(typeof o.duration === 'number' ? { duration: o.duration } : {}),
  }
}

/** Fill gaps in `a` from `b`. */
export const merge = (a: Unfurl, b: Unfurl): Unfurl => ({
  ...b,
  ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)),
})
