import { describe, expect, it } from 'vitest'
import { cloneElements, parseClipboard, serializeClipboard } from './clipboard'
import type { CanvasElement } from './types'

const el = (id: string, z: string, over: Partial<CanvasElement> = {}): CanvasElement => ({
  id, type: 'debug', x: 8, y: 16, width: 160, height: 96, z, color: null, parentId: null, sortKey: null, content: { a: { b: 1 } }, ...over,
})

describe('clipboard', () => {
  it('round-trips', () => {
    const items = [el('1', 'a0'), el('2', 'a1', { height: null, color: '3' })]
    expect(parseClipboard(serializeClipboard(items))).toEqual(items)
  })
  it('rejects foreign text', () => {
    expect(parseClipboard('hello')).toBeNull()
    expect(parseClipboard('{"kind":"other"}')).toBeNull()
    expect(parseClipboard('{bad json')).toBeNull()
    expect(parseClipboard(null)).toBeNull()
  })
  it('rejects malformed items', () => {
    expect(parseClipboard(JSON.stringify({ kind: 'mosaic/elements', items: [{ type: 'x' }] }))).toBeNull()
  })
  it('cloneElements: new ids, offset, z order kept, deep content copy', () => {
    const items = [el('b', 'a1'), el('a', 'a0')]
    let n = 0
    const out = cloneElements(items, { dx: 16, dy: 24 }, () => `new${n++}`, ['z1', 'z2'])
    expect(out.map((e) => e.id)).toEqual(['new0', 'new1'])
    expect(out[0]).toMatchObject({ x: 24, y: 40, z: 'z1' }) // original 'a' (lowest z) first
    expect(out[1].z).toBe('z2')
    ;(out[0].content.a as { b: number }).b = 99
    expect((items[1].content.a as { b: number }).b).toBe(1)
  })
  it('cloneElements: children follow a copied column, stray children become top-level', () => {
    const items = [el('col', 'a0'), el('kid', 'a1', { parentId: 'col', sortKey: 'a0' }), el('lost', 'a2', { parentId: 'gone', sortKey: 'a0' })]
    let n = 0
    const out = cloneElements(items, { dx: 16, dy: 16 }, () => `n${n++}`, ['z1', 'z2', 'z3'])
    expect(out[1]).toMatchObject({ parentId: 'n0', sortKey: 'a0', x: 8 })
    expect(out[2]).toMatchObject({ parentId: null, sortKey: null, x: 24 })
  })
})
