// GET over a connection to an already-validated IP. fetch() would resolve the name again, so a DNS-rebinding
// server could answer a public address to the guard and a private one to fetch. Here we connect to `ip`
// ourselves; TLS still verifies the certificate against the hostname (SNI + name check), and `Host` is the original.
// Minimal HTTP/1.1: GET only, `Connection: close`, no compression, no keep-alive. Redirects are left to the caller.

export interface PinnedInit {
  ip: string
  signal?: AbortSignal
  headers?: HeadersInit
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const MAX_HEAD = 64 * 1024

function indexOfCrlfCrlf(b: Uint8Array): number {
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10 && b[i + 2] === 13 && b[i + 3] === 10) return i
  return -1
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const o = new Uint8Array(a.length + b.length)
  o.set(a); o.set(b, a.length)
  return o
}

/** Decodes a chunked body from `read` (which yields raw bytes after the header, `first` already read). */
function chunkedBody(first: Uint8Array, read: () => Promise<Uint8Array | null>, close: () => void): ReadableStream<Uint8Array> {
  let buf = first
  let remaining = -1 // bytes left in current chunk; -1 = need a size line
  let done = false
  const fill = async () => {
    const n = await read()
    if (!n) throw new Error('truncated chunked body')
    buf = concat(buf, n)
  }
  return new ReadableStream({
    async pull(ctrl) {
      try {
        while (!done) {
          if (remaining === -1) {
            let nl = -1
            while ((nl = buf.indexOf(10)) < 0) { if (buf.length > 1024) throw new Error('bad chunk'); await fill() }
            const line = dec.decode(buf.subarray(0, nl)).trim().split(';')[0]
            if (!/^[0-9a-fA-F]+$/.test(line)) throw new Error('bad chunk size')
            buf = buf.subarray(nl + 1)
            remaining = parseInt(line, 16)
            if (remaining === 0) { done = true; break }
          }
          if (remaining > 0) {
            if (!buf.length) await fill()
            const take = Math.min(remaining, buf.length)
            const piece = buf.slice(0, take)
            buf = buf.subarray(take)
            remaining -= take
            if (remaining === 0) remaining = -2 // expect CRLF
            ctrl.enqueue(piece)
            return
          }
          if (remaining === -2) {
            while (buf.length < 2) await fill()
            buf = buf.subarray(2)
            remaining = -1
          }
        }
        close()
        ctrl.close()
      } catch (e) {
        close()
        ctrl.error(e)
      }
    },
    cancel: close,
  })
}

export async function pinnedFetch(url: URL, { ip, signal, headers }: PinnedInit): Promise<Response> {
  const https = url.protocol === 'https:'
  const port = Number(url.port || (https ? 443 : 80))
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  let conn: Deno.Conn = await Deno.connect({ hostname: ip, port })
  const close = () => { try { conn.close() } catch { /* already closed */ } }
  const onAbort = () => close()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    if (https) conn = await Deno.startTls(conn as Deno.TcpConn, { hostname })
    const h = new Headers(headers)
    h.set('host', url.host)
    h.set('connection', 'close')
    h.set('accept-encoding', 'identity')
    let head = `GET ${url.pathname}${url.search} HTTP/1.1\r\n`
    h.forEach((v, k) => { head += `${k}: ${v.replace(/[\r\n]/g, ' ')}\r\n` })
    await conn.write(enc.encode(head + '\r\n'))

    const chunk = new Uint8Array(16 * 1024)
    const read = async (): Promise<Uint8Array | null> => {
      const n = await conn.read(chunk)
      return n === null ? null : chunk.slice(0, n)
    }
    let buf: Uint8Array = new Uint8Array(0)
    let end = -1
    while ((end = indexOfCrlfCrlf(buf)) < 0) {
      if (buf.length > MAX_HEAD) throw new Error('response head too large')
      const n = await read()
      if (!n) throw new Error('connection closed before response')
      buf = concat(buf, n)
    }
    const lines = dec.decode(buf.subarray(0, end)).split('\r\n')
    const m = /^HTTP\/1\.[01] (\d{3})/.exec(lines[0])
    if (!m) throw new Error('bad status line')
    const status = Number(m[1])
    const resHeaders = new Headers()
    for (const l of lines.slice(1)) {
      const i = l.indexOf(':')
      if (i > 0) { try { resHeaders.append(l.slice(0, i).trim(), l.slice(i + 1).trim()) } catch { /* invalid header: skip */ } }
    }
    const rest = buf.subarray(end + 4)
    const cleanup = () => { signal?.removeEventListener('abort', onAbort); close() }
    if (status < 200 || status === 204 || status === 304) {
      cleanup()
      return new Response(null, { status: status < 200 ? 502 : status, headers: resHeaders })
    }
    let body: ReadableStream<Uint8Array>
    if (/chunked/i.test(resHeaders.get('transfer-encoding') ?? '')) {
      body = chunkedBody(rest, read, cleanup)
    } else {
      let first: Uint8Array | null = rest.length ? rest : null
      body = new ReadableStream({
        async pull(ctrl) {
          try {
            const n = first ?? (await read())
            first = null
            if (n === null) { cleanup(); ctrl.close() } else ctrl.enqueue(n)
          } catch (e) { cleanup(); ctrl.error(e) }
        },
        cancel: cleanup,
      })
    }
    return new Response(body, { status, headers: resHeaders })
  } catch (e) {
    signal?.removeEventListener('abort', onAbort)
    close()
    throw e
  }
}
