import type { ElementRow } from './rows'
import type { QueueStorage } from './writeQueue'

const DB = 'milanote-sync'
const STORE = 'queue'

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
export function idbQueueStorage(boardId: string): QueueStorage {
  const key = `board:${boardId}`
  if (typeof indexedDB === 'undefined') return { load: async () => [], save: async () => {} }
  return {
    load: async () => (await tx<ElementRow[] | undefined>('readonly', (s) => s.get(key))) ?? [],
    save: async (rows) => {
      if (rows.length) await tx('readwrite', (s) => s.put(rows, key))
      else await tx('readwrite', (s) => s.delete(key))
    },
  }
}
