import { describe, expect, it } from 'vitest'
import {
  anchorPoint, arrowPoints, cloneConnections, connectionsAmong, connectionsTouching, defaultBend, defaultStyle, facingSide,
  lineGeometry, resolveEnd, type Connection,
} from './connections'
import { nearestSide } from './connectInteractions'

const R = { x: 100, y: 100, w: 200, h: 80 }
const conn = (id: string, from: string | null, to: string | null): Connection => ({
  id,
  from: from ? { elementId: from, anchor: { side: 'right', t: 0.5 } } : { elementId: null, point: { x: 10, y: 20 } },
  to: to ? { elementId: to, anchor: { side: 'left', t: 0.5 } } : { elementId: null, point: { x: 50, y: 60 } },
  style: defaultStyle(),
  label: null,
})

describe('anchors', () => {
  it('maps side + t to a point on the card edge', () => {
    expect(anchorPoint(R, { side: 'right', t: 0.5 })).toEqual({ x: 300, y: 140 })
    expect(anchorPoint(R, { side: 'top', t: 0.25 })).toEqual({ x: 150, y: 100 })
    expect(anchorPoint(R, { side: 'left', t: 2 })).toEqual({ x: 100, y: 180 }) // t is clamped
  })
  it('picks the side facing a point, wide cards favour left/right', () => {
    expect(facingSide(R, { x: 500, y: 140 })).toBe('right')
    expect(facingSide(R, { x: 0, y: 140 })).toBe('left')
    expect(facingSide(R, { x: 200, y: 400 })).toBe('bottom')
    expect(facingSide(R, { x: 200, y: -200 })).toBe('top')
  })
  it('finds the nearest side of a card to the pointer', () => {
    expect(nearestSide(R, { x: 108, y: 140 })).toBe('left')
    expect(nearestSide(R, { x: 200, y: 104 })).toBe('top')
  })
  it('resolves attached ends through the rect lookup and free ends directly', () => {
    expect(resolveEnd(conn('c', 'a', null).from, () => R)).toEqual({ x: 300, y: 140 })
    expect(resolveEnd(conn('c', 'a', null).from, () => null)).toBeNull()
    expect(resolveEnd(conn('c', null, null).to, () => null)).toEqual({ x: 50, y: 60 })
  })
})

describe('lineGeometry', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 100, y: 0 }
  it('straight: path between the ends, mid on the chord', () => {
    const g = lineGeometry(a, b, { curve: 'straight' })
    expect(g.d).toBe('M0 0L100 0')
    expect(g.mid).toEqual({ x: 50, y: 0 })
    expect(g.dirEnd).toEqual({ x: 1, y: 0 })
  })
  it('curved: the bend handle lies on the curve', () => {
    const g = lineGeometry(a, b, { curve: 'curved', bend: { x: 0, y: -30 } })
    expect(g.mid).toEqual({ x: 50, y: -30 })
    // Quadratic at t = ½ is (a + 2c + b) / 4; the control point is at twice the offset.
    expect(g.c).toEqual({ x: 50, y: -60 })
    expect((a.y + 2 * g.c!.y + b.y) / 4).toBe(-30)
  })
  it('curved without a bend bows by default; trim shortens the drawn path only', () => {
    const off = defaultBend(a, b)
    expect(Math.abs(off.y)).toBeGreaterThan(0)
    const g = lineGeometry(a, b, { curve: 'straight' }, { start: 0, end: 6 })
    expect(g.d).toBe('M0 0L94 0')
    expect(g.b).toEqual(b)
  })
  it('arrowhead has its tip at the end point', () => {
    expect(arrowPoints({ x: 10, y: 10 }, { x: 1, y: 0 }).startsWith('10,10 ')).toBe(true)
  })
})

describe('copy and delete helpers', () => {
  const all = [conn('both', 'a', 'b'), conn('one', 'a', 'z'), conn('freeEnd', 'a', null), conn('free', null, null)]
  it('carries lines whose attached ends are all copied (free ends allowed)', () => {
    expect(connectionsAmong(all, new Set(['a', 'b'])).map((c) => c.id)).toEqual(['both', 'freeEnd'])
  })
  it('finds lines that touch deleted cards', () => {
    expect(connectionsTouching(all, new Set(['b'])).map((c) => c.id)).toEqual(['both'])
    expect(connectionsTouching(all, new Set(['a'])).map((c) => c.id)).toEqual(['both', 'one', 'freeEnd'])
  })
  it('clones with new ids, re-pointed ends and shifted free points', () => {
    let n = 0
    const out = cloneConnections([all[0], all[2]], new Map([['a', 'a2'], ['b', 'b2']]), () => `n${++n}`, { x: 16, y: 16 })
    expect(out.map((c) => c.id)).toEqual(['n1', 'n2'])
    expect(out[0].from.elementId).toBe('a2')
    expect(out[0].to.elementId).toBe('b2')
    expect(out[1].to).toEqual({ elementId: null, point: { x: 66, y: 76 } })
    out[0].style.color = '#000'
    expect(all[0].style.color).not.toBe('#000')
  })
})
