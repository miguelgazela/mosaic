import { describe, expect, it } from 'vitest'
import { defaultStyle, type Connection } from '../../canvas/connections'
import { fromConnRow, toConnRow, type ConnRow } from './rows'

const attached: Connection = {
  id: 'c1',
  from: { elementId: 'a', anchor: { side: 'bottom', t: 0.5 } },
  to: { elementId: null, point: { x: 12, y: 34 } },
  style: { ...defaultStyle(), curve: 'curved', bend: { x: 5, y: -9 }, dash: true, head: 'both', color: '#7C3AED' },
  label: 'then',
}

describe('connection rows', () => {
  it('round-trips attached + free ends and style', () => {
    const row = toConnRow(attached, 'b1', 'me', false)
    expect(row.from_element_id).toBe('a')
    expect(row.from_point).toEqual({ side: 'bottom', t: 0.5 })
    expect(row.to_element_id).toBeNull()
    expect(row.to_point).toEqual({ x: 12, y: 34 })
    expect(row.client_id).toBe('me')
    expect(fromConnRow(row)).toEqual(attached)
  })
  it('marks deletes with deleted_at', () => {
    expect(toConnRow(attached, 'b1', 'me', true).deleted_at).toBeTruthy()
  })
  it('fills defaults for rows written by the schema default (no head/bend, null points)', () => {
    const row: ConnRow = {
      id: 'c2', board_id: 'b1', from_element_id: 'a', to_element_id: 'b', from_point: null, to_point: null,
      style: { curve: 'curved', dash: false, head: 'end', color: '#2b2a28' }, label: null, client_id: null, deleted_at: null,
    }
    const c = fromConnRow(row)
    expect(c.from.anchor).toEqual({ side: 'right', t: 0.5 })
    expect(c.style.bend).toBeUndefined()
    expect(c.style.color).toBe('#2b2a28')
  })
})
