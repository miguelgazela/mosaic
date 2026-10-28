import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WriteQueue, type QueueStorage } from './writeQueue'
import type { ElementRow } from './rows'

const row = (id: string, x = 0): ElementRow => ({
  id, board_id: 'b', type: 'note', x, y: 0, width: 1, height: null, z: 'a', color: null, content: {}, client_id: 'c', deleted_at: null,
})

function setup(over: { send?: (r: ElementRow[]) => Promise<void>; online?: () => boolean; stored?: ElementRow[] } = {}) {
  const sent: ElementRow[][] = []
  const statuses: string[] = []
  let stored = over.stored ?? []
  const storage: QueueStorage = { load: async () => stored, save: async (r) => { stored = r } }
  const q = new WriteQueue({
    send: over.send ?? (async (r) => { sent.push(r) }),
    storage,
    onStatus: (s) => statuses.push(s),
    isOnline: over.online ?? (() => true),
  })
  return { q, sent, statuses, getStored: () => stored }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('WriteQueue', () => {
  it('coalesces per id and debounces into one batch', async () => {
    const { q, sent, statuses } = setup()
    q.enqueue([row('a', 1)])
    q.enqueue([row('a', 2), row('b')])
    await vi.advanceTimersByTimeAsync(299)
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2)
    expect(sent).toHaveLength(1)
    expect(sent[0].map((r) => [r.id, r.x])).toEqual([['a', 2], ['b', 0]])
    expect(statuses.at(-1)).toBe('saved')
    expect(q.size).toBe(0)
  })

  it('persists pending rows and clears them after send', async () => {
    const { q, getStored } = setup()
    q.enqueue([row('a')])
    await vi.advanceTimersByTimeAsync(0)
    expect(getStored().map((r) => r.id)).toEqual(['a'])
    await vi.advanceTimersByTimeAsync(400)
    expect(getStored()).toEqual([])
  })

  it('restores persisted rows and flushes them', async () => {
    const { q, sent } = setup({ stored: [row('z')] })
    await q.restore()
    await vi.advanceTimersByTimeAsync(10)
    expect(sent[0].map((r) => r.id)).toEqual(['z'])
  })

  it('retries with backoff after a failure', async () => {
    let fail = 2
    const sent: ElementRow[][] = []
    const { q, statuses } = setup({
      send: async (r) => { if (fail-- > 0) throw new Error('x'); sent.push(r) },
    })
    q.enqueue([row('a')])
    await vi.advanceTimersByTimeAsync(300)
    expect(statuses.at(-1)).toBe('error')
    await vi.advanceTimersByTimeAsync(1000)
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent).toHaveLength(1)
    expect(statuses.at(-1)).toBe('saved')
  })

  it('holds while offline and sends after retryNow', async () => {
    let online = false
    const { q, sent, statuses } = setup({ online: () => online })
    q.enqueue([row('a')])
    await vi.advanceTimersByTimeAsync(400)
    expect(sent).toHaveLength(0)
    expect(statuses.at(-1)).toBe('offline')
    online = true
    q.retryNow()
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toHaveLength(1)
  })

  it('keeps a row re-enqueued while a send is in flight', async () => {
    let release!: () => void
    const { q } = setup({ send: () => new Promise<void>((res) => { release = res }) })
    q.enqueue([row('a', 1)])
    await vi.advanceTimersByTimeAsync(300)
    q.enqueue([row('a', 2)])
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(q.has('a')).toBe(true)
  })
})
