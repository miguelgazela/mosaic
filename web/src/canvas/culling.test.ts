import { beforeEach, describe, expect, it } from 'vitest'
import { visibleIds } from './layers'
import { useBoard } from './store'
import type { CanvasElement } from './types'

const el = (id: string, x: number, y: number, extra: Partial<CanvasElement> = {}): CanvasElement => ({
  id, type: 'debug', x, y, width: 160, height: 96, z: id, color: null, parentId: null, sortKey: null, content: {}, ...extra,
})

describe('visibleIds (viewport culling)', () => {
  beforeEach(() => {
    useBoard.getState().reset([el('in', 100, 100), el('far', 5000, 5000), el('child', 100, 100, { parentId: 'in' })])
    useBoard.getState().setSize({ w: 1000, h: 700 })
    useBoard.getState().setViewport({ x: 0, y: 0, zoom: 1 })
  })

  it('keeps cards in view, drops far ones and column children', () => {
    expect(visibleIds(useBoard.getState(), false)).toEqual(['in'])
  })

  it('follows pan and zoom', () => {
    useBoard.getState().setViewport({ x: -4900, y: -4900, zoom: 1 })
    expect(visibleIds(useBoard.getState(), false)).toEqual(['far'])
    useBoard.getState().setViewport({ x: 0, y: 0, zoom: 0.1 })
    expect(visibleIds(useBoard.getState(), false).sort()).toEqual(['far', 'in'])
  })

  it('always keeps selected and editing cards', () => {
    useBoard.getState().setSelection(['far'])
    expect(visibleIds(useBoard.getState(), false).sort()).toEqual(['far', 'in'])
  })

  it('shows everything while exporting', () => {
    expect(visibleIds(useBoard.getState(), true).sort()).toEqual(['far', 'in'])
  })
})
