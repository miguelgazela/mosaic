import { describe, expect, it } from 'vitest'
import { childrenOf, insertIndex, keysAppended, rootOf, sortKeyAt, withChildren } from './columns'
import type { CanvasElement } from './types'

const el = (id: string, parentId: string | null, sortKey: string | null): CanvasElement => ({
  id, type: 'note', x: 0, y: 0, width: 100, height: null, z: 'a0', color: null, parentId, sortKey, content: {},
})

describe('columns', () => {
  const all = Object.fromEntries([el('col', null, null), el('b', 'col', 'a1'), el('a', 'col', 'a0'), el('free', null, null)].map((e) => [e.id, e]))

  it('orders children by sortKey', () => {
    expect(childrenOf(all, 'col').map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('creates keys between neighbours', () => {
    const k = sortKeyAt(['a0', 'a1'], 1)
    expect(k > 'a0' && k < 'a1').toBe(true)
    expect(sortKeyAt([], 0)).toBeTruthy()
    expect(sortKeyAt(['a0'], 5) > 'a0').toBe(true)
  })
  it('appends ascending keys', () => {
    const ks = keysAppended(['a0'], 3)
    expect([...ks].sort()).toEqual(ks)
    expect(ks[0] > 'a0').toBe(true)
  })
  it('finds the insert index from midpoints', () => {
    expect(insertIndex([10, 30, 50], 5)).toBe(0)
    expect(insertIndex([10, 30, 50], 35)).toBe(2)
    expect(insertIndex([10, 30, 50], 99)).toBe(3)
    expect(insertIndex([], 4)).toBe(0)
  })
  it('collects descendants and roots', () => {
    expect(withChildren(all, ['col']).map((e) => e.id).sort()).toEqual(['a', 'b', 'col'])
    expect(rootOf(all, 'a')?.id).toBe('col')
    expect(rootOf(all, 'free')?.id).toBe('free')
  })
})
