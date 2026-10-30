// SSRF guard: only public http(s) hosts, checked on every redirect hop. The request then goes to the IP that was
// checked (see pinned.ts), so DNS cannot answer differently the second time.
import { pinnedFetch } from './pinned.ts'

export class UnfurlError extends Error {
  constructor(public code: 'blocked' | 'timeout' | 'too_large' | 'bad_url' | 'upstream', msg?: string) {
    super(msg ?? code)
  }
}

/** Parse "a.b.c.d" into 4 bytes, or null. */
function parseV4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const b = m.slice(1).map(Number)
  return b.every((n) => n <= 255) ? b : null
}

export function isPrivateV4(ip: string): boolean {
  const b = parseV4(ip)
  if (!b) return true // unparseable: refuse
  const [a, c] = b
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && c >= 64 && c <= 127) || // CGNAT
    (a === 169 && c === 254) || // link-local, cloud metadata
    (a === 172 && c >= 16 && c <= 31) ||
    (a === 192 && c === 0) || // 192.0.0.0/24, 192.0.2.0/24
    (a === 192 && c === 168) ||
    (a === 198 && (c === 18 || c === 19)) ||
    (a === 198 && c === 51) || (a === 203 && c === 0) ||
    a >= 224 // multicast, reserved, broadcast
  )
}

/** Expand an IPv6 literal to 8 hextets, or null. */
function parseV6(ip: string): number[] | null {
  let s = ip.toLowerCase()
  const zone = s.indexOf('%')
  if (zone >= 0) s = s.slice(0, zone)
  // trailing dotted v4
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)
  if (v4) {
    const b = parseV4(v4[1])
    if (!b) return null
    s = s.slice(0, -v4[1].length) + ((b[0] << 8) | b[1]).toString(16) + ':' + ((b[2] << 8) | b[3]).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null
  const parts = [...head, ...Array(fill).fill('0'), ...tail]
  if (parts.length !== 8) return null
  const out = parts.map((p) => (/^[0-9a-f]{1,4}$/.test(p) ? parseInt(p, 16) : NaN))
  return out.some(Number.isNaN) ? null : out
}

export function isPrivateV6(ip: string): boolean {
  const h = parseV6(ip)
  if (!h) return true
  if (h.every((x) => x === 0)) return true // ::
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d)
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) {
    return isPrivateV4(`${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`)
  }
  // NAT64 64:ff9b::/96 embeds a v4 address
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isPrivateV4(`${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`)
  }
  if ((h[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true // site-local
  if ((h[0] & 0xff00) === 0xff00) return true // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true // documentation
  return false
}

export const isPrivateIp = (ip: string): boolean => (ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip))

const BLOCKED_HOSTS = /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i

export type Resolver = (host: string) => Promise<string[]>

export const denoResolver: Resolver = async (host) => {
  const out: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    try { out.push(...(await Deno.resolveDns(host, type))) } catch { /* no records of this type */ }
  }
  return out
}

/**
 * Throws UnfurlError('blocked' | 'bad_url') unless `url` is a public http(s) URL. Returns the URL and one
 * validated address to connect to: every address the name resolves to is checked, then the first is used.
 */
export async function resolvePublicUrl(raw: string | URL, resolve: Resolver = denoResolver): Promise<{ url: URL; ip: string }> {
  let u: URL
  try { u = new URL(raw) } catch { throw new UnfurlError('bad_url') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnfurlError('bad_url', 'protocol')
  if (u.username || u.password) throw new UnfurlError('blocked', 'credentials in url')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.test(host)) throw new UnfurlError('blocked', 'host')
  // URL() normalises 0x7f.1, 2130706433, etc. to dotted decimal, so literals land here as plain IPs.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new UnfurlError('blocked', 'ip')
    return { url: u, ip: host }
  }
  const ips = await resolve(host)
  if (!ips.length) throw new UnfurlError('upstream', 'dns')
  if (ips.some(isPrivateIp)) throw new UnfurlError('blocked', 'resolves to private ip')
  return { url: u, ip: ips[0] }
}

export const assertPublicUrl = async (raw: string | URL, resolve: Resolver = denoResolver): Promise<URL> =>
  (await resolvePublicUrl(raw, resolve)).url

export interface FetchOpts {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  resolve?: Resolver
  /** Gets `url` from the validated address `ip` (default: pinnedFetch). Tests inject a fake. */
  fetchImpl?: (url: URL, init: { ip: string; signal: AbortSignal; headers?: HeadersInit }) => Promise<Response>
  headers?: HeadersInit
}

/**
 * GET with the guard applied to the first URL and to every redirect target.
 * Timeout covers the whole call incl. body. Body is cut at `maxBytes` (a larger page is fine: we only
 * need <head>, so we return what fits and flag `truncated`).
 */
export async function safeFetchText(
  url: string,
  { timeoutMs = 5000, maxBytes = 1_000_000, maxRedirects = 5, resolve = denoResolver, fetchImpl = pinnedFetch, headers }: FetchOpts = {},
): Promise<{ finalUrl: URL; body: string; contentType: string; truncated: boolean }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let { url: current, ip } = await resolvePublicUrl(url, resolve)
    for (let hop = 0; ; hop++) {
      let res: Response
      try {
        res = await fetchImpl(current, { ip, signal: ctrl.signal, headers })
      } catch (e) {
        if (ctrl.signal.aborted) throw new UnfurlError('timeout')
        throw new UnfurlError('upstream', String(e))
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        await res.body?.cancel()
        if (hop >= maxRedirects) throw new UnfurlError('upstream', 'too many redirects')
        ;({ url: current, ip } = await resolvePublicUrl(new URL(res.headers.get('location')!, current), resolve))
        continue
      }
      if (!res.ok) { await res.body?.cancel(); throw new UnfurlError('upstream', `status ${res.status}`) }
      const declared = Number(res.headers.get('content-length') ?? 0)
      const chunks: Uint8Array[] = []
      let size = 0
      let truncated = declared > maxBytes
      const reader = res.body?.getReader()
      try {
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.length
          if (size > maxBytes) {
            chunks.push(value.slice(0, value.length - (size - maxBytes)))
            truncated = true
            await reader.cancel()
            break
          }
          chunks.push(value)
        }
      } catch (e) {
        if (ctrl.signal.aborted) throw new UnfurlError('timeout')
        throw new UnfurlError('upstream', String(e))
      }
      const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
      let o = 0
      for (const c of chunks) { all.set(c, o); o += c.length }
      return { finalUrl: current, body: new TextDecoder().decode(all), contentType: res.headers.get('content-type') ?? '', truncated }
    }
  } finally {
    clearTimeout(timer)
  }
}
