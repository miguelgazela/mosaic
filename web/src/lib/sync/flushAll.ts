import type { ElementRow } from './rows'
import type { QueuedBoards } from './idbStore'

export interface FlushResult { flushed: string[]; failed: string[] }

/**
 * Send the queued edits of every board left in storage by an earlier session (not just the board
 * being opened). Each board's entry is cleared only after its rows were sent and only if unchanged.
 */
export async function flushAllQueued(store: QueuedBoards, send: (rows: ElementRow[]) => Promise<void>, batchSize = 100): Promise<FlushResult> {
  const result: FlushResult = { flushed: [], failed: [] }
  for (const { boardId, rows } of await store.list()) {
    try {
      for (let i = 0; i < rows.length; i += batchSize) await send(rows.slice(i, i + batchSize))
      await store.clearIfUnchanged(boardId, rows)
      result.flushed.push(boardId)
    } catch {
      // Left in storage; the board's own queue retries when it opens, or the next app start does.
      result.failed.push(boardId)
    }
  }
  return result
}
