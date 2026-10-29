import { describe, expect, it } from 'vitest'
import { linkMeta, memoryShareRepo, shareUrl, subBoardHint } from './shareApi'

describe('share helpers', () => {
  it('builds the viewer address', () => {
    expect(shareUrl('abc', 'https://x.app')).toBe('https://x.app/s/abc')
  })
  it('names up to three sub-boards', () => {
    expect(subBoardHint([])).toBe('This board has no sub-boards yet.')
    expect(subBoardHint(['A'])).toBe('Viewers can open A')
    expect(subBoardHint(['A', 'B', 'C'])).toBe('Viewers can open A, B and C')
    expect(subBoardHint(['A', 'B', 'C', 'D', 'E'])).toBe('Viewers can open A, B, C and 2 more')
  })
  it('describes a link', () => {
    expect(linkMeta({ createdAt: '2026-03-12T10:00:00', includeSubboards: true })).toBe('Created Mar 12, includes sub-boards')
    expect(linkMeta({ createdAt: '2026-02-20T10:00:00', includeSubboards: false })).toBe('Created Feb 20, this board only')
  })
})

describe('memory share repo', () => {
  it('creates, lists newest first, revokes', async () => {
    const r = memoryShareRepo()
    const a = await r.create('b1', true)
    const b = await r.create('b1', false)
    await r.create('b2', true)
    expect((await r.list('b1')).map((l) => l.id)).toEqual([b.id, a.id])
    await r.revoke(b.id)
    expect((await r.list('b1')).map((l) => l.id)).toEqual([a.id])
  })
})
