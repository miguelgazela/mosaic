export type SignFn = (paths: string[]) => Promise<Record<string, string | null>>

export interface SignedUrlCache {
  get(path: string): Promise<string | null>
  /** Warm the cache for many paths in one request. */
  prefetch(paths: string[]): void
  clear(): void
  /** Fill the cache with URLs obtained elsewhere (the share function signs a board's files itself). */
  seed(urls: Record<string, string>): void
}

/**
 * Signed-URL cache. `get` calls made close together are coalesced into one batch request.
 * URLs are reused until shortly before they expire; failures are not cached.
 */
export function createSignedUrlCache(sign: SignFn, opts: { ttlMs?: number; batchMs?: number; now?: () => number } = {}): SignedUrlCache {
  const ttl = opts.ttlMs ?? 60 * 60 * 1000
  const batchMs = opts.batchMs ?? 16
  const now = opts.now ?? Date.now
  const ready = new Map<string, { url: string; at: number }>()
  const waiting = new Map<string, Array<(u: string | null) => void>>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const fresh = (path: string): string | null => {
    const hit = ready.get(path)
    return hit && now() - hit.at < ttl * 0.9 ? hit.url : null
  }

  const flush = async () => {
    timer = undefined
    const batch = [...waiting.entries()]
    waiting.clear()
    let result: Record<string, string | null> = {}
    try {
      result = await sign(batch.map(([p]) => p))
    } catch {
      result = {}
    }
    for (const [path, resolvers] of batch) {
      const url = result[path] ?? null
      if (url) ready.set(path, { url, at: now() })
      for (const r of resolvers) r(url)
    }
  }

  const get = (path: string): Promise<string | null> => {
    const hit = fresh(path)
    if (hit) return Promise.resolve(hit)
    return new Promise((resolve) => {
      const list = waiting.get(path)
      if (list) list.push(resolve)
      else waiting.set(path, [resolve])
      timer ??= setTimeout(() => { void flush() }, batchMs)
    })
  }

  return {
    get,
    prefetch: (paths) => { for (const p of paths) void get(p) },
    clear: () => ready.clear(),
    seed: (urls) => { for (const [p, url] of Object.entries(urls)) ready.set(p, { url, at: now() }) },
  }
}
