import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { assertPublicUrl, isPrivateIp, safeFetchText, UnfurlError } from './ssrf.ts'

const pub = () => Promise.resolve(['93.184.216.34'])

Deno.test('private / loopback / link-local IPv4 are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255']) {
    assert(isPrivateIp(ip), ip)
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '1.1.1.1']) assert(!isPrivateIp(ip), ip)
})

Deno.test('private IPv6 and mapped IPv4 are blocked', () => {
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::a00:1', 'ff02::1']) {
    assert(isPrivateIp(ip), ip)
  }
  assert(!isPrivateIp('2606:4700:4700::1111'))
})

Deno.test('assertPublicUrl rejects bad schemes, credentials, local names, IP literals', async () => {
  for (const u of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pw@example.com', 'http://localhost/', 'http://foo.localhost/', 'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'not a url']) {
    await assertRejects(() => assertPublicUrl(u, pub), UnfurlError, undefined, u)
  }
  await assertPublicUrl('https://example.com/a?b=1', pub)
})

Deno.test('a public name that resolves to a private IP is blocked (DNS rebinding style)', async () => {
  await assertRejects(() => assertPublicUrl('http://evil.example/', () => Promise.resolve(['93.184.216.34', '10.0.0.5'])), UnfurlError)
})

Deno.test('redirect to a private address is blocked', async () => {
  let calls = 0
  const fetchImpl = ((u: URL) => {
    calls++
    return Promise.resolve(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }))
  }) as unknown as typeof fetch
  const e = await assertRejects(() => safeFetchText('https://example.com/', { resolve: pub, fetchImpl }), UnfurlError)
  assertEquals(e.code, 'blocked')
  assertEquals(calls, 1)
})

Deno.test('redirect hostname that resolves private is blocked; relative redirect is followed', async () => {
  const resolve = (h: string) => Promise.resolve(h === 'internal.example' ? ['192.168.0.9'] : ['93.184.216.34'])
  const seen: string[] = []
  const fetchImpl = ((u: URL) => {
    seen.push(String(u))
    if (u.pathname === '/a') return Promise.resolve(new Response(null, { status: 301, headers: { location: '/b' } }))
    if (u.pathname === '/b') return Promise.resolve(new Response(null, { status: 301, headers: { location: 'http://internal.example/' } }))
    return Promise.resolve(new Response('ok'))
  }) as unknown as typeof fetch
  await assertRejects(() => safeFetchText('https://example.com/a', { resolve, fetchImpl }), UnfurlError)
  assertEquals(seen, ['https://example.com/a', 'https://example.com/b'])
})

Deno.test('too many redirects fails', async () => {
  const fetchImpl = (() => Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://example.com/' } }))) as unknown as typeof fetch
  await assertRejects(() => safeFetchText('https://example.com/', { resolve: pub, fetchImpl, maxRedirects: 3 }), UnfurlError)
})

Deno.test('body is capped at the byte limit', async () => {
  const big = 'x'.repeat(3_000_000)
  const fetchImpl = (() => Promise.resolve(new Response(big))) as unknown as typeof fetch
  const r = await safeFetchText('https://example.com/', { resolve: pub, fetchImpl, maxBytes: 1_000_000 })
  assertEquals(r.body.length, 1_000_000)
  assert(r.truncated)
})

Deno.test('a slow server times out', async () => {
  const fetchImpl = ((_u: URL, init: RequestInit) =>
    new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch
  const e = await assertRejects(() => safeFetchText('https://example.com/', { resolve: pub, fetchImpl, timeoutMs: 50 }), UnfurlError)
  assertEquals(e.code, 'timeout')
})

Deno.test('non-2xx is an upstream error', async () => {
  const fetchImpl = (() => Promise.resolve(new Response('no', { status: 404 }))) as unknown as typeof fetch
  const e = await assertRejects(() => safeFetchText('https://example.com/', { resolve: pub, fetchImpl }), UnfurlError)
  assertEquals(e.code, 'upstream')
})
