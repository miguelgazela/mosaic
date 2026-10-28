import { describe, expect, it } from 'vitest'
import { flushAllQueued } from './flushAll'
import type { QueuedBoards } from './idbStore'
import type { ElementRow } from './rows'

const row = (id: string, board: string): ElementRow => ({
  id, board_id: board, type: 'note', x: 0, y: 0, width: 1, height: null, z: 'a', color: null, content: {}, client_id: 'c', deleted_at: null,
})

function memStore(init: Record<string, ElementRow[]>) {
  const data = new Map(Object.entries(init))
  const store: QueuedBoards = {
    list: async () => [...data].map(([boardId, rows]) => ({ boardId, rows })),
    clearIfUnchanged: async (id, rows) => { if (data.get(id) === rows) data.delete(id) },
  }
  return { store, data }
}

describe('flushAllQueued', () => {
  it('sends every board and clears each entry', async () => {
    const { store, data } = memStore({ a: [row('1', 'a')], b: [row('2', 'b'), row('3', 'b')] })
    const sent: string[] = []
    const r = await flushAllQueued(store, async (rows) => { sent.push(...rows.map((x) => x.id)) })
    expect(sent.sort()).toEqual(['1', '2', '3'])
    expect(r.flushed.sort()).toEqual(['a', 'b'])
    expect(data.size).toBe(0)
  })

  it('keeps a board whose send failed and carries on with the rest', async () => {
    const { store, data } = memStore({ a: [row('1', 'a')], b: [row('2', 'b')] })
    const r = await flushAllQueued(store, async (rows) => { if (rows[0].board_id === 'a') throw new Error('x') })
    expect(r).toEqual({ flushed: ['b'], failed: ['a'] })
    expect([...data.keys()]).toEqual(['a'])
  })

  it('splits large queues into batches', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(String(i), 'a'))
    const { store } = memStore({ a: rows })
    const sizes: number[] = []
    await flushAllQueued(store, async (b) => { sizes.push(b.length) }, 2)
    expect(sizes).toEqual([2, 2, 1])
  })
})
