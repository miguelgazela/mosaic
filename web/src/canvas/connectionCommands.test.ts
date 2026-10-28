import { beforeEach, describe, expect, it } from 'vitest'
import { copySelection, deleteSelection, duplicateSelection, pasteClipboard, updateConnection } from './actions'
import { defaultStyle, type Connection } from './connections'
import { useBoard } from './store'
import type { CanvasElement } from './types'

const el = (id: string, x: number): CanvasElement => ({
  id, type: 'note', x, y: 0, width: 200, height: 80, z: x === 0 ? 'a0' : x === 400 ? 'a1' : 'a2', color: null, parentId: null, sortKey: null, content: {},
})
const line = (id: string, from: string, to: string): Connection => ({
  id,
  from: { elementId: from, anchor: { side: 'right', t: 0.5 } },
  to: { elementId: to, anchor: { side: 'left', t: 0.5 } },
  style: defaultStyle(),
  label: null,
})
const st = () => useBoard.getState()

beforeEach(() => {
  st().reset([el('a', 0), el('b', 400), el('c', 800)], [line('ab', 'a', 'b'), line('bc', 'b', 'c')])
})

describe('lines and undo', () => {
  it('deleting a card removes its lines, undo brings both back', () => {
    st().setSelection(['b'])
    deleteSelection()
    expect(Object.keys(st().elements)).toEqual(['a', 'c'])
    expect(Object.keys(st().connections)).toEqual([])
    st().undo()
    expect(Object.keys(st().connections).sort()).toEqual(['ab', 'bc'])
    expect(st().elements.b).toBeTruthy()
  })
  it('deleting a selected line removes only that line; undo restores it', () => {
    st().selectConn('ab')
    deleteSelection()
    expect(Object.keys(st().connections)).toEqual(['bc'])
    expect(st().selectedConn).toBeNull()
    st().undo()
    expect(st().connections.ab).toBeTruthy()
  })
  it('style edits are one undo step each', () => {
    updateConnection('ab', { label: 'then' })
    updateConnection('ab', { style: { ...st().connections.ab.style, dash: true } })
    expect(st().connections.ab.label).toBe('then')
    st().undo()
    expect(st().connections.ab.style.dash).toBe(false)
    st().undo()
    expect(st().connections.ab.label).toBeNull()
  })
  it('selecting a card clears the line selection and vice versa', () => {
    st().selectConn('ab')
    st().setSelection(['a'])
    expect(st().selectedConn).toBeNull()
    st().selectConn('bc')
    expect(Object.keys(st().selected)).toEqual([])
  })
})

describe('copy, paste, duplicate carry lines between the copied cards', () => {
  it('duplicate copies the line between two selected cards, not the one to an unselected card', () => {
    st().setSelection(['a', 'b'])
    duplicateSelection()
    const lines = Object.values(st().connections)
    expect(lines).toHaveLength(3)
    const copy = lines.find((l) => l.id !== 'ab' && l.id !== 'bc')!
    expect(copy.from.elementId).not.toBe('a')
    expect(copy.to.elementId).not.toBe('b')
    expect(st().elements[copy.from.elementId!]).toBeTruthy()
    expect(st().elements[copy.to.elementId!]).toBeTruthy()
    st().undo()
    expect(Object.keys(st().connections).sort()).toEqual(['ab', 'bc'])
  })
  it('copy + paste carries them too', () => {
    st().setSelection(['b', 'c'])
    const text = copySelection()
    expect(pasteClipboard(text)).toBe(true)
    expect(Object.keys(st().connections)).toHaveLength(3)
  })
})
