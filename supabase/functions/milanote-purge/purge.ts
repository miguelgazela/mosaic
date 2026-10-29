// Pure parts of milanote-purge, so they can be tested without a database.

export const RETENTION_DAYS = 30
/** A storage object younger than this is never removed: its card row may still be in a client's write queue. */
export const GRACE_MS = 24 * 60 * 60 * 1000

const DAY = 86_400_000

/** Rows soft-deleted before this instant are removed for good. */
export const cutoff = (now: Date, days = RETENTION_DAYS): string => new Date(now.getTime() - days * DAY).toISOString()

/** Storage paths a card's `content` points at (image: path, thumbPath; file: path, previewPath). */
export function contentPaths(content: unknown): string[] {
  if (!content || typeof content !== 'object') return []
  const c = content as Record<string, unknown>
  return ['path', 'thumbPath', 'previewPath'].flatMap((k) => (typeof c[k] === 'string' && c[k] ? [c[k] as string] : []))
}

export const referencedPaths = (contents: unknown[]): Set<string> => new Set(contents.flatMap(contentPaths))

export interface StoredObject { name: string; createdAt: string | null }

/**
 * Objects nothing refers to any more. Duplicated boards share objects, so an object stays while any card (live
 * or still in the trash) points at it. Objects younger than `GRACE_MS` and objects without a known age stay.
 */
export function orphanObjects(objects: StoredObject[], referenced: ReadonlySet<string>, now: Date): string[] {
  return objects
    .filter((o) => {
      if (referenced.has(o.name)) return false
      const t = o.createdAt ? Date.parse(o.createdAt) : NaN
      return Number.isFinite(t) && now.getTime() - t >= GRACE_MS
    })
    .map((o) => o.name)
}

export interface PurgeCounts { elements: number; connections: number; boards: number }

/** What the purge needs from the outside world. */
export interface PurgeStore {
  /** Hard-delete rows soft-deleted before `cutoffIso`; children go with their boards/cards (foreign keys cascade). */
  deleteTrashedBefore(cutoffIso: string): Promise<PurgeCounts>
  /** `content` of every image/file card still in the table (trashed ones included). */
  fileContents(): Promise<unknown[]>
  listObjects(): Promise<StoredObject[]>
  removeObjects(names: string[]): Promise<void>
}

export interface PurgeResult extends PurgeCounts {
  removedObjects: number
  dryRun: boolean
}

export async function runPurge(store: PurgeStore, now: Date, opts: { dryRun?: boolean } = {}): Promise<PurgeResult> {
  const dryRun = opts.dryRun === true
  // Rows first: cards that go now no longer protect their files in the same run.
  const counts = dryRun ? { elements: 0, connections: 0, boards: 0 } : await store.deleteTrashedBefore(cutoff(now))
  // If any read fails the whole run throws before a single object is removed.
  const [contents, objects] = await Promise.all([store.fileContents(), store.listObjects()])
  const orphans = orphanObjects(objects, referencedPaths(contents), now)
  if (!dryRun) for (let i = 0; i < orphans.length; i += 100) await store.removeObjects(orphans.slice(i, i + 100))
  return { ...counts, removedObjects: orphans.length, dryRun }
}
