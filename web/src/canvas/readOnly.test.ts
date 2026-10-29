import { beforeEach, describe, expect, it } from 'vitest'
import { addCmd, patchCmd, removeCmd } from './commands'
import { useBoard } from './store'
import type { CanvasElement } from './types'

const el = (id: string): CanvasElement => ({ id, type: 'note', x: 0, y: 0, width: 100, height: 50, z: 'a', color: null, parentId: null, sortKey: null, content: {} })

describe('read-only store (FR-54)', () => {
  beforeEach(() => {
    const s = useBoard.getState()
    s.setReadOnly(false)
    s.reset([el('a')])
  })

  it('blocks commands, undo/redo, selection, editing and tools', () => {
    const s = useBoard.getState()
    s.setReadOnly(true)
    s.exec(addCmd([el('b')]))
    s.commit(removeCmd([el('a')]))
    s.exec(patchCmd('Move', [{ id: 'a', before: { x: 0 }, after: { x: 50 } }]))
    s.setSelection(['a'])
    s.setEditing('a')
    s.setTool('hand')
    const now = useBoard.getState()
    expect(Object.keys(now.elements)).toEqual(['a'])
    expect(now.elements.a.x).toBe(0)
    expect(now.selected).toEqual({})
    expect(now.editing).toBeNull()
    expect(now.tool).toBe('select')
    expect(now.canUndo).toBe(false)
  })

  it('turning it on clears selection and edit state; turning it off restores editing', () => {
    const s = useBoard.getState()
    s.setSelection(['a'])
    s.setEditing('a')
    s.setReadOnly(true)
    expect(useBoard.getState().selected).toEqual({})
    expect(useBoard.getState().editing).toBeNull()
    s.setReadOnly(false)
    s.exec(addCmd([el('b')]))
    expect(Object.keys(useBoard.getState().elements).sort()).toEqual(['a', 'b'])
  })

  it('viewport still moves', () => {
    const s = useBoard.getState()
    s.setReadOnly(true)
    s.setViewport({ x: 10, y: 20, zoom: 2 })
    expect(useBoard.getState().viewport).toEqual({ x: 10, y: 20, zoom: 2 })
  })
})
