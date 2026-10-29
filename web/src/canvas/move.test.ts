import { describe, expect, it } from 'vitest'
import { movedLabel, planMove } from './move'
import { defaultStyle, type Connection } from './connections'
import type { CanvasElement } from './types'

const el = (id: string, x: number, y: number, parentId: string | null = null): CanvasElement => ({
  id, type: 'note', x, y, width: 200, height: null, z: 'a0', color: null, parentId, sortKey: null, content: {},
})
const line = (id: string, from: string | null, to: string | null): Connection => ({
  id,
  from: from ? { elementId: from, anchor: { side: 'right', t: 0.5 } } : { elementId: null, point: { x: 1, y: 1 } },
  to: to ? { elementId: to, anchor: { side: 'left', t: 0.5 } } : { elementId: null, point: { x: 9, y: 9 } },
  style: defaultStyle(),
  label: null,
})
const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))

describe('planMove', () => {
  const els = byId([el('a', 100, 80), el('b', 400, 200), el('c', 700, 40), el('col', 50, 300), el('kid', 0, 0, 'col')])
  const lines = byId([line('ab', 'a', 'b'), line('bc', 'b', 'c'), line('free', 'a', null), line('kidc', 'kid', 'c')])

  it('returns null when nothing is selected or the ids are unknown', () => {
    expect(planMove(els, lines, [])).toBeNull()
    expect(planMove(els, lines, ['nope'])).toBeNull()
  })

  it('keeps lines between moved cards and drops lines to cards left behind', () => {
    const p = planMove(els, lines, ['a', 'b'])!
    expect(p.along.map((c) => c.id).sort()).toEqual(['ab', 'free'])
    expect(p.dropped.map((c) => c.id)).toEqual(['bc'])
  })

  it('takes the cards inside a moved column along, without counting them', () => {
    const p = planMove(els, lines, ['col'])!
    expect(p.top.map((e) => e.id)).toEqual(['col'])
    expect(p.all.map((e) => e.id).sort()).toEqual(['col', 'kid'])
    expect(p.dropped.map((c) => c.id)).toEqual(['kidc'])
  })

  it('origin is the top-left of the moved top-level cards', () => {
    expect(planMove(els, lines, ['b', 'a'])!.origin).toEqual({ x: 100, y: 80 })
  })

  it('a selected child alone lands top-level and has no origin of its own', () => {
    const p = planMove(els, lines, ['kid'])!
    expect(p.top.map((e) => e.id)).toEqual(['kid'])
    expect(p.origin).toEqual({ x: 0, y: 0 })
  })
})

describe('movedLabel', () => {
  it('pluralises and names the board', () => {
    expect(movedLabel(1, 'Ideas')).toBe('Moved 1 card to Ideas')
    expect(movedLabel(3, 'Ideas')).toBe('Moved 3 cards to Ideas')
    expect(movedLabel(2, '')).toBe('Moved 2 cards to Untitled board')
  })
})
