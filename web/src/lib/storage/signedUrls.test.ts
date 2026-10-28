import { describe, expect, it, vi } from 'vitest'
import { createSignedUrlCache } from './signedUrls'

const signer = () => vi.fn(async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `https://x/${p}`])))

describe('signed URL cache', () => {
  it('batches calls made together into one request', async () => {
    const sign = signer()
    const c = createSignedUrlCache(sign, { batchMs: 0 })
    const urls = await Promise.all(['a', 'b', 'c', 'a'].map((p) => c.get(p)))
    expect(urls).toEqual(['https://x/a', 'https://x/b', 'https://x/c', 'https://x/a'])
    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign.mock.calls[0][0].sort()).toEqual(['a', 'b', 'c'])
  })

  it('reuses a fresh URL and refetches an expiring one', async () => {
    const sign = signer()
    let t = 0
    const c = createSignedUrlCache(sign, { batchMs: 0, ttlMs: 1000, now: () => t })
    await c.get('a')
    t = 500
    await c.get('a')
    expect(sign).toHaveBeenCalledTimes(1)
    t = 950
    await c.get('a')
    expect(sign).toHaveBeenCalledTimes(2)
  })

  it('returns null for failures and does not cache them', async () => {
    const sign = vi.fn(async () => ({}))
    const c = createSignedUrlCache(sign, { batchMs: 0 })
    expect(await c.get('a')).toBeNull()
    expect(await c.get('a')).toBeNull()
    expect(sign).toHaveBeenCalledTimes(2)
  })
})
