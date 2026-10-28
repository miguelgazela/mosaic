import type { ElementRow } from './rows'
import type { SaveStatus } from './status'

export interface QueueStorage<R extends { id: string } = ElementRow> {
  load(): Promise<R[]>
  save(rows: R[]): Promise<void>
}

export interface WriteQueueOptions<R extends { id: string } = ElementRow> {
  send(rows: R[]): Promise<void>
  storage: QueueStorage<R>
  onStatus(s: SaveStatus): void
  isOnline(): boolean
  debounceMs?: number
  batchSize?: number
  maxBackoffMs?: number
}

/**
 * Coalesces element writes (latest row per id wins), debounces, sends in batches,
 * persists pending rows so a reload/offline does not lose edits, retries with backoff.
 */
export class WriteQueue<R extends { id: string } = ElementRow> {
  private pending = new Map<string, R>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private failures = 0
  private stopped = false
  private persistQueued = false

  constructor(private o: WriteQueueOptions<R>) {}

  get size(): number { return this.pending.size }
  has(id: string): boolean { return this.pending.has(id) }

  /** Pull rows persisted by an earlier session into the queue (newer in-memory rows win). */
  async restore(): Promise<R[]> {
    const rows = await this.o.storage.load()
    for (const r of rows) if (!this.pending.has(r.id)) this.pending.set(r.id, r)
    if (rows.length) this.schedule(0)
    return rows
  }

  enqueue(rows: R[]): void {
    if (!rows.length || this.stopped) return
    for (const r of rows) this.pending.set(r.id, r)
    this.o.onStatus(this.busyStatus())
    this.persist()
    this.schedule(this.o.debounceMs ?? 300)
  }

  private persist(): void {
    if (this.persistQueued) return
    this.persistQueued = true
    queueMicrotask(() => {
      this.persistQueued = false
      void this.o.storage.save([...this.pending.values()]).catch(() => {})
    })
  }

  private schedule(ms: number): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.flush() }, ms)
  }

  /** Send everything pending now. Resolves when the queue is empty or a send failed. */
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.inflight ??= this.run().finally(() => { this.inflight = null })
    return this.inflight
  }

  /** Retry soon (e.g. the browser came back online). */
  retryNow(): void {
    this.failures = 0
    if (this.pending.size) this.schedule(0)
  }

  private async run(): Promise<void> {
    const size = this.o.batchSize ?? 100
    while (this.pending.size && !this.stopped) {
      if (!this.o.isOnline()) { this.o.onStatus('offline'); return }
      this.o.onStatus(this.busyStatus())
      const batch = [...this.pending.values()].slice(0, size)
      try {
        await this.o.send(batch)
      } catch {
        this.failures++
        this.o.onStatus(this.o.isOnline() ? 'error' : 'offline')
        this.schedule(Math.min(this.o.maxBackoffMs ?? 30_000, 1000 * 2 ** (this.failures - 1)))
        return
      }
      this.failures = 0
      // A row re-enqueued while in flight is a different object: keep it.
      for (const r of batch) if (this.pending.get(r.id) === r) this.pending.delete(r.id)
      this.persist()
    }
    if (!this.pending.size) this.o.onStatus('saved')
  }

  /** While a failed send is being retried the status stays 'error' until a send succeeds. */
  private busyStatus(): SaveStatus {
    if (!this.o.isOnline()) return 'offline'
    return this.failures > 0 ? 'error' : 'saving'
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
  }
}
