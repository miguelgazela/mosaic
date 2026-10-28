import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ElementRow } from './rows'

type Handler = (p: { eventType: string; new: unknown; old: unknown }) => void
const handlers: Handler[] = []
const upserts: ElementRow[][] = []

vi.mock('../supabase', () => {
  const channel = {
    on: (_t: string, _f: unknown, h: Handler) => { handlers.push(h); return channel },
    subscribe: () => channel,
  }
  return { supabase: { channel: () => channel, removeChannel: vi.fn() } }
})
vi.mock('./boardApi', () => ({
  upsertElements: async (rows: ElementRow[]) => { upserts.push(rows) },
  fetchElements: async () => [],
  saveViewport: async () => {},
}))

const { startBoardSync } = await import('./boardSync')
const { useBoard } = await import('../../canvas/store')
const { CLIENT_ID } = await import('./clientId')

const row = (id: string, over: Partial<ElementRow> = {}): ElementRow => ({
  id, board_id: 'b1', type: 'debug', x: 0, y: 0, width: 100, height: 50, z: 'a0', color: null, content: {},
  client_id: 'other', deleted_at: null, updated_at: '2026-01-01T00:00:00Z', ...over,
})
const data = (elements: ElementRow[]) => ({
  board: { id: 'b1', title: 'T', icon: null, color: null, parent_board_id: null, is_home: false, viewport: { x: 5, y: 6, zoom: 2 } },
  elements, connections: [], path: [],
})
const remote = (r: ElementRow, eventType = 'UPDATE') => handlers[0]({ eventType, new: r, old: { id: r.id } })

let stop: () => void
beforeEach(async () => {
  vi.useFakeTimers()
  handlers.length = 0
  upserts.length = 0
  stop = await startBoardSync(data([row('a')]), { onBoardChange: () => {} })
})
afterEach(() => { stop(); vi.useRealTimers() })

describe('startBoardSync', () => {
  it('seeds the store and viewport', () => {
    expect(Object.keys(useBoard.getState().elements)).toEqual(['a'])
    expect(useBoard.getState().viewport).toEqual({ x: 5, y: 6, zoom: 2 })
  })

  it('upserts local patches, tagged with this tab', async () => {
    useBoard.getState().exec({ label: 'm', do: () => useBoard.getState()._patch([{ id: 'a', patch: { x: 40 } }]), undo: () => {} })
    await vi.advanceTimersByTimeAsync(400)
    expect(upserts).toHaveLength(1)
    expect(upserts[0][0]).toMatchObject({ id: 'a', x: 40, client_id: CLIENT_ID, deleted_at: null })
  })

  it('does not write while dragging, then writes once on drop', async () => {
    const s = useBoard.getState()
    s.setDragging(true)
    s._patch([{ id: 'a', patch: { x: 10 } }])
    s._patch([{ id: 'a', patch: { x: 20 } }])
    await vi.advanceTimersByTimeAsync(400)
    expect(upserts).toHaveLength(0)
    s.setDragging(false)
    await vi.advanceTimersByTimeAsync(400)
    expect(upserts).toHaveLength(1)
    expect(upserts[0][0].x).toBe(20)
  })

  it('soft-deletes removed elements', async () => {
    useBoard.getState().exec({ label: 'd', do: () => useBoard.getState()._remove(['a']), undo: () => {} })
    await vi.advanceTimersByTimeAsync(400)
    expect(upserts[0][0].deleted_at).toBeTruthy()
  })

  it('applies remote rows without echoing them back', async () => {
    remote(row('a', { x: 77, updated_at: '2026-01-02T00:00:00Z' }))
    remote(row('n', { updated_at: '2026-01-02T00:00:00Z' }), 'INSERT')
    expect(useBoard.getState().elements.a.x).toBe(77)
    expect(useBoard.getState().elements.n).toBeTruthy()
    await vi.advanceTimersByTimeAsync(400)
    expect(upserts).toHaveLength(0)
    remote(row('n', { deleted_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' }))
    expect(useBoard.getState().elements.n).toBeUndefined()
  })

  it('ignores own echoes, stale rows, and rows with unsent local edits', async () => {
    remote(row('a', { x: 1, client_id: CLIENT_ID, updated_at: '2026-01-05T00:00:00Z' }))
    expect(useBoard.getState().elements.a.x).toBe(0)
    remote(row('a', { x: 2, updated_at: '2025-01-01T00:00:00Z' }))
    expect(useBoard.getState().elements.a.x).toBe(0)
    useBoard.getState()._patch([{ id: 'a', patch: { x: 9 } }])
    remote(row('a', { x: 3, updated_at: '2026-02-01T00:00:00Z' }))
    expect(useBoard.getState().elements.a.x).toBe(9)
  })
})
