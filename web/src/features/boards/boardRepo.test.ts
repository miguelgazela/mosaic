import { describe, expect, it, vi } from 'vitest'

const log: string[] = []
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: async () => { log.push('create:start'); await new Promise((r) => setTimeout(r, 20)); log.push('create:done'); return { error: null } },
      update: () => ({ eq: async () => { log.push('update'); return { error: null } } }),
    }),
  },
}))

const { getBoardRepo } = await import('./boardRepo')

describe('board repo', () => {
  it('a rename right after create waits for the insert (name typed straight after "Add board")', async () => {
    log.length = 0
    const repo = getBoardRepo()
    const created = repo.create({ id: 'b1', parentId: 'home', title: 'Untitled board' })
    const renamed = repo.update('b1', { title: 'Shot list' })
    await Promise.all([created, renamed])
    expect(log).toEqual(['create:start', 'create:done', 'update'])
  })
  it('an update of a board that is not being created runs at once', async () => {
    log.length = 0
    await getBoardRepo().update('other', { title: 'x' })
    expect(log).toEqual(['update'])
  })
  it('updates after the create has finished', async () => {
    log.length = 0
    const repo = getBoardRepo()
    const c = repo.create({ id: 'b2', parentId: null, title: 't' })
    await c
    await repo.update('b2', { title: 'ok' })
    expect(log.at(-1)).toBe('update')
  })
})
