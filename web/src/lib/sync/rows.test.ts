import { describe, expect, it } from 'vitest'
import { fromRow, isNewer, toRow } from './rows'

const el = { id: 'a', type: 'note', x: 8, y: 16, width: 240, height: null, z: 'a1', color: '2', parentId: null, sortKey: null, content: { t: 1 } }

describe('rows', () => {
  it('round-trips an element', () => {
    expect(fromRow(toRow(el, 'b', 'c', false))).toEqual(el)
  })
  it('keeps column membership', () => {
    const child = { ...el, parentId: 'col', sortKey: 'a0' }
    const row = toRow(child, 'b', 'c', false)
    expect(row.parent_id).toBe('col')
    expect(row.sort_key).toBe('a0')
    expect(fromRow(row)).toEqual(child)
  })
  it('marks deletion with a timestamp', () => {
    expect(toRow(el, 'b', 'c', false).deleted_at).toBeNull()
    expect(toRow(el, 'b', 'c', true).deleted_at).toMatch(/^\d{4}-/)
  })
  it('isNewer compares timestamps, unknown counts as newer', () => {
    expect(isNewer('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(true)
    expect(isNewer('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false)
    expect(isNewer(undefined, '2026-01-02T00:00:00Z')).toBe(true)
  })
})
