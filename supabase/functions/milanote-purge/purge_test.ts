import { assertEquals } from 'jsr:@std/assert@1'
import { contentPaths, cutoff, GRACE_MS, orphanObjects, type PurgeStore, referencedPaths, runPurge, type StoredObject } from './purge.ts'
import { safeEqual } from './index.ts'

const NOW = new Date('2026-04-10T12:00:00Z')
const old = '2026-04-01T00:00:00Z'
const fresh = new Date(NOW.getTime() - GRACE_MS / 2).toISOString()

Deno.test('cutoff is 30 days back', () => {
  assertEquals(cutoff(NOW), '2026-03-11T12:00:00.000Z')
  assertEquals(cutoff(NOW, 1), '2026-04-09T12:00:00.000Z')
})

Deno.test('contentPaths reads image and file paths, ignores junk', () => {
  assertEquals(contentPaths({ path: 'u/e/original.jpg', thumbPath: 'u/e/thumb.jpg', w: 1 }), ['u/e/original.jpg', 'u/e/thumb.jpg'])
  assertEquals(contentPaths({ path: 'u/e/a.pdf', previewPath: 'u/e/p.png' }), ['u/e/a.pdf', 'u/e/p.png'])
  assertEquals(contentPaths({ path: '', thumbPath: 5 }), [])
  assertEquals(contentPaths(null), [])
  assertEquals(contentPaths('x'), [])
})

Deno.test('orphans: referenced and young objects stay, shared objects stay while anything points at them', () => {
  const objects: StoredObject[] = [
    { name: 'u/a/original.jpg', createdAt: old },
    { name: 'u/a/thumb.jpg', createdAt: old },
    { name: 'u/b/original.jpg', createdAt: old },
    { name: 'u/c/original.jpg', createdAt: fresh },
    { name: 'u/d/original.jpg', createdAt: null },
  ]
  // Card A and a duplicate of it share the same paths; B is gone.
  const refs = referencedPaths([{ path: 'u/a/original.jpg', thumbPath: 'u/a/thumb.jpg' }, { path: 'u/a/original.jpg', thumbPath: 'u/a/thumb.jpg' }])
  assertEquals(orphanObjects(objects, refs, NOW), ['u/b/original.jpg'])
})

function fakeStore(): PurgeStore & { log: string[]; removed: string[] } {
  const log: string[] = []
  const removed: string[] = []
  let rows = [{ path: 'u/a/original.jpg' }, { path: 'u/b/original.jpg' }]
  return {
    log, removed,
    deleteTrashedBefore(c) {
      log.push(`delete<${c}`)
      rows = rows.filter((r) => r.path !== 'u/b/original.jpg') // card B was in the purged trash
      return Promise.resolve({ elements: 1, connections: 2, boards: 3 })
    },
    fileContents: () => { log.push('contents'); return Promise.resolve(rows) },
    listObjects: () => Promise.resolve([{ name: 'u/a/original.jpg', createdAt: old }, { name: 'u/b/original.jpg', createdAt: old }]),
    removeObjects(names) { removed.push(...names); return Promise.resolve() },
  }
}

Deno.test('runPurge deletes rows first, then objects the remaining cards no longer use', async () => {
  const s = fakeStore()
  const r = await runPurge(s, NOW)
  assertEquals(r, { elements: 1, connections: 2, boards: 3, removedObjects: 1, dryRun: false })
  assertEquals(s.log, ['delete<2026-03-11T12:00:00.000Z', 'contents'])
  assertEquals(s.removed, ['u/b/original.jpg'])
})

Deno.test('dry run reports but changes nothing', async () => {
  const s = fakeStore()
  const r = await runPurge(s, NOW, { dryRun: true })
  assertEquals(r.dryRun, true)
  assertEquals(s.log, ['contents'])
  assertEquals(s.removed, [])
  // Nothing was deleted, so card B still protects its file: no object is an orphan yet.
  assertEquals(r.removedObjects, 0)
})

Deno.test('a failing read removes no object', async () => {
  const s = fakeStore()
  s.listObjects = () => Promise.reject(new Error('storage down'))
  let threw = false
  try { await runPurge(s, NOW) } catch { threw = true }
  assertEquals(threw, true)
  assertEquals(s.removed, [])
})

Deno.test('removals go in batches of 100', async () => {
  const s = fakeStore()
  s.fileContents = () => Promise.resolve([])
  s.listObjects = () => Promise.resolve(Array.from({ length: 250 }, (_, i) => ({ name: `u/${i}/o`, createdAt: old })))
  const batches: number[] = []
  s.removeObjects = (n) => { batches.push(n.length); return Promise.resolve() }
  await runPurge(s, NOW)
  assertEquals(batches, [100, 100, 50])
})

Deno.test('safeEqual', () => {
  assertEquals(safeEqual('abc', 'abc'), true)
  assertEquals(safeEqual('abc', 'abd'), false)
  assertEquals(safeEqual('abc', 'abcd'), false)
  assertEquals(safeEqual('', ''), true)
})
