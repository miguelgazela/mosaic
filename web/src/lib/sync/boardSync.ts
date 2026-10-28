import { useBoard } from '../../canvas/store'
import type { Viewport } from '../../canvas/geometry'
import { supabase } from '../supabase'
import { fetchConnections, fetchElements, saveViewport, upsertConnections, upsertElements, type BoardData, type BoardMeta } from './boardApi'
import { CLIENT_ID } from './clientId'
import { CONN_PREFIX, idbQueueStorage } from './idbStore'
import { fromConnRow, fromRow, isNewer, toConnRow, toRow, type ConnRow, type ElementRow } from './rows'
import { useSync } from './status'
import { WriteQueue } from './writeQueue'

const VIEWPORT_DEBOUNCE_MS = 800

export interface BoardSyncOptions {
  /** Called when the board row changes remotely (title, icon, colour). */
  onBoardChange(row: Partial<BoardMeta>): void
}

/**
 * Seed the canvas store from `data` (plus edits left in IndexedDB by an earlier session),
 * then keep it in sync: local changes → write queue → Supabase; Realtime → store.
 * Returns a stop function.
 */
export async function startBoardSync(data: BoardData, opts: BoardSyncOptions): Promise<() => void> {
  const boardId = data.board.id
  const store = useBoard
  const versions = new Map<string, string | undefined>()
  let muted = false
  let stopped = false
  const quietly = (fn: () => void) => {
    muted = true
    try { fn() } finally { muted = false }
  }

  const queue = new WriteQueue({
    send: upsertElements,
    storage: idbQueueStorage(boardId),
    // Saved only once the connection queue is empty too.
    onStatus: (s) => useSync.getState().setStatus(s === 'saved' && connQueue.size ? 'saving' : s),
    isOnline: () => navigator.onLine,
  })
  const connQueue: WriteQueue<ConnRow> = new WriteQueue<ConnRow>({
    // A line may reference a card that is still queued: send the cards first (the foreign key needs them).
    send: async (rows) => {
      await queue.flush()
      if (queue.size) throw new Error('cards not saved yet')
      await upsertConnections(rows)
    },
    storage: idbQueueStorage<ConnRow>(boardId, CONN_PREFIX),
    onStatus: (s) => { if (!(s === 'saved' && queue.size)) useSync.getState().setStatus(s) },
    isOnline: () => navigator.onLine,
  })

  // 1. Seed: server rows, overlaid with unsent local edits.
  const byId = new Map<string, ElementRow>()
  for (const r of data.elements) {
    byId.set(r.id, r)
    versions.set(r.id, r.updated_at)
  }
  const restored = await queue.restore().catch(() => [] as ElementRow[])
  for (const r of restored) {
    if (r.deleted_at) byId.delete(r.id)
    else byId.set(r.id, r)
  }
  const connById = new Map<string, ConnRow>()
  const connVersions = new Map<string, string | undefined>()
  for (const r of data.connections) {
    connById.set(r.id, r)
    connVersions.set(r.id, r.updated_at)
  }
  const restoredConns = await connQueue.restore().catch(() => [] as ConnRow[])
  for (const r of restoredConns) {
    if (r.deleted_at) connById.delete(r.id)
    else connById.set(r.id, r)
  }
  quietly(() => {
    store.getState().reset([...byId.values()].map(fromRow), [...connById.values()].map(fromConnRow))
    store.getState().setViewport(data.board.viewport ?? { x: 0, y: 0, zoom: 1 })
  })
  useSync.getState().setStatus(queue.size || connQueue.size ? (navigator.onLine ? 'saving' : 'offline') : 'saved')

  // 2. Local changes → queue. Skipped mid-drag; the diff is taken when the drag ends.
  let prev = store.getState().elements
  const unsubElements = store.subscribe((s) => {
    if (s.elements === prev) return
    if (muted) { prev = s.elements; return }
    if (s.dragging) return
    const next = s.elements
    const rows: ElementRow[] = []
    for (const id in next) if (prev[id] !== next[id]) rows.push(toRow(next[id], boardId, CLIENT_ID, false))
    for (const id in prev) if (!(id in next)) rows.push(toRow(prev[id], boardId, CLIENT_ID, true))
    prev = next
    queue.enqueue(rows)
  })

  let prevConns = store.getState().connections
  const unsubConns = store.subscribe((s) => {
    if (s.connections === prevConns) return
    if (muted) { prevConns = s.connections; return }
    if (s.dragging) return
    const next = s.connections
    const rows: ConnRow[] = []
    for (const id in next) if (prevConns[id] !== next[id]) rows.push(toConnRow(next[id], boardId, CLIENT_ID, false))
    for (const id in prevConns) if (!(id in next)) rows.push(toConnRow(prevConns[id], boardId, CLIENT_ID, true))
    prevConns = next
    connQueue.enqueue(rows)
  })

  // 3. Viewport, debounced.
  let lastVp: Viewport = store.getState().viewport
  let vpTimer: ReturnType<typeof setTimeout> | null = null
  const flushViewport = () => {
    if (vpTimer) { clearTimeout(vpTimer); vpTimer = null }
    if (navigator.onLine) void saveViewport(boardId, lastVp).catch(() => {})
  }
  const unsubViewport = store.subscribe((s, p) => {
    if (s.viewport === p.viewport || muted) return
    lastVp = s.viewport
    if (vpTimer) clearTimeout(vpTimer)
    vpTimer = setTimeout(flushViewport, VIEWPORT_DEBOUNCE_MS)
  })

  // 4. Remote rows → store.
  const applyRow = (row: ElementRow) => {
    if (row.board_id !== boardId) return
    if (row.client_id === CLIENT_ID) { versions.set(row.id, row.updated_at); return }
    if (queue.has(row.id)) return // local edit not yet sent wins
    if (!isNewer(row.updated_at, versions.get(row.id))) return
    versions.set(row.id, row.updated_at)
    quietly(() => {
      const s = store.getState()
      if (row.deleted_at) {
        if (s.elements[row.id]) s._remove([row.id])
      } else if (s.elements[row.id]) {
        s._patch([{ id: row.id, patch: fromRow(row) }])
      } else {
        s._add([fromRow(row)])
      }
    })
  }

  const applyConnRow = (row: ConnRow) => {
    if (row.board_id !== boardId) return
    if (row.client_id === CLIENT_ID) { connVersions.set(row.id, row.updated_at); return }
    if (connQueue.has(row.id)) return
    if (!isNewer(row.updated_at, connVersions.get(row.id))) return
    connVersions.set(row.id, row.updated_at)
    quietly(() => {
      const s = store.getState()
      if (row.deleted_at) {
        if (s.connections[row.id]) s._removeConns([row.id])
      } else if (s.connections[row.id]) {
        s._patchConns([{ id: row.id, patch: fromConnRow(row) }])
      } else {
        s._addConns([fromConnRow(row)])
      }
    })
  }

  const resync = async () => {
    try {
      const [rows, conns] = await Promise.all([fetchElements(boardId), fetchConnections(boardId)])
      if (stopped) return
      const seen = new Set<string>()
      for (const r of rows) { seen.add(r.id); applyRow(r) }
      const gone = Object.keys(store.getState().elements).filter((id) => !seen.has(id) && !queue.has(id))
      if (gone.length) quietly(() => store.getState()._remove(gone))
      const seenConns = new Set<string>()
      for (const r of conns) { seenConns.add(r.id); applyConnRow(r) }
      const goneConns = Object.keys(store.getState().connections).filter((id) => !seenConns.has(id) && !connQueue.has(id))
      if (goneConns.length) quietly(() => store.getState()._removeConns(goneConns))
    } catch { /* next reconnect retries */ }
  }

  let wasDown = false
  const channel = supabase
    .channel(`board:${boardId}:${CLIENT_ID}`)
    .on('postgres_changes', { event: '*', schema: 'milanote', table: 'elements', filter: `board_id=eq.${boardId}` }, (p) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as { id?: string }).id
        if (id && store.getState().elements[id]) quietly(() => store.getState()._remove([id]))
      } else {
        applyRow(p.new as ElementRow)
      }
    })
    .on('postgres_changes', { event: '*', schema: 'milanote', table: 'connections', filter: `board_id=eq.${boardId}` }, (p) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as { id?: string }).id
        if (id && store.getState().connections[id]) quietly(() => store.getState()._removeConns([id]))
      } else {
        applyConnRow(p.new as ConnRow)
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'milanote', table: 'boards', filter: `id=eq.${boardId}` }, (p) => {
      opts.onBoardChange(p.new as Partial<BoardMeta>)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (wasDown) void resync()
        wasDown = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDown = true
      }
    })

  // 5. Lifecycle.
  const flushBoth = async () => { await queue.flush(); await connQueue.flush() }
  const onOnline = () => { queue.retryNow(); connQueue.retryNow(); void resync() }
  const onHidden = () => { if (document.visibilityState === 'hidden') { void flushBoth(); flushViewport() } }
  const onPageHide = () => { void flushBoth(); flushViewport() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onHidden)
  window.addEventListener('pagehide', onPageHide)

  return () => {
    stopped = true
    unsubElements()
    unsubConns()
    unsubViewport()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onHidden)
    window.removeEventListener('pagehide', onPageHide)
    void supabase.removeChannel(channel)
    flushViewport()
    // Best effort; anything unsent stays in IndexedDB and is restored next time this board opens.
    void flushBoth().finally(() => { queue.stop(); connQueue.stop() })
  }
}
