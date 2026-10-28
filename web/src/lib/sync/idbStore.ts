import type { ElementRow } from './rows'
import type { QueueStorage } from './writeQueue'

const DB = 'milanote-sync'
const STORE = 'queue'
const PREFIX = 'board:'
/** Pending connection rows live under their own key so `flushAllQueued` (elements only) never mixes them up. */
export const CONN_PREFIX = 'conn:'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Pending rows for one board, kept in IndexedDB. No-op when IndexedDB is unavailable. */
export function idbQueueStorage<R extends { id: string } = ElementRow>(boardId: string, prefix = PREFIX): QueueStorage<R> {
  const key = prefix + boardId
  if (typeof indexedDB === 'undefined') return { load: async () => [], save: async () => {} }
  return {
    load: async () => (await tx<R[] | undefined>('readonly', (s) => s.get(key))) ?? [],
    save: async (rows) => {
      if (rows.length) await tx('readwrite', (s) => s.put(rows, key))
      else await tx('readwrite', (s) => s.delete(key))
    },
  }
}

/** Store used by `flushAllQueued`: every board's pending rows, and a delete that only fires if nothing changed. */
export interface QueuedBoards {
  list(): Promise<{ boardId: string; rows: ElementRow[] }[]>
  /** Delete the board's entry only if it still holds exactly `rows` (an open board may have written newer ones). */
  clearIfUnchanged(boardId: string, rows: ElementRow[]): Promise<void>
}

export const idbQueuedBoards: QueuedBoards = {
  async list() {
    if (typeof indexedDB === 'undefined') return []
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
    const out: { boardId: string; rows: ElementRow[] }[] = []
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith(PREFIX)) continue
      const rows = await tx<ElementRow[] | undefined>('readonly', (s) => s.get(k))
      if (rows?.length) out.push({ boardId: k.slice(PREFIX.length), rows })
    }
    return out
  },
  async clearIfUnchanged(boardId, rows) {
    if (typeof indexedDB === 'undefined') return
    const key = PREFIX + boardId
    const db = await open()
    try {
      await new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite')
        const s = t.objectStore(STORE)
        const get = s.get(key)
        get.onsuccess = () => { if (JSON.stringify(get.result) === JSON.stringify(rows)) s.delete(key) }
        t.oncomplete = () => resolve()
        t.onerror = () => reject(t.error)
      })
    } finally {
      db.close()
    }
  },
}
