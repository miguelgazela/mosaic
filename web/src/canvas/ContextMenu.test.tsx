import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ContextMenu } from './ContextMenu'
import { useBoard } from './store'
import type { CanvasElement } from './types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const boardEl: CanvasElement = {
  id: 'card1', type: 'board', x: 0, y: 0, width: 136, height: null, z: 'a0', color: null, parentId: null, sortKey: null, content: { boardId: 'b1' },
}

describe('ContextMenu', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    useBoard.getState().reset([boardEl])
    useBoard.getState().setSelection(['card1'])
  })
  afterEach(() => { host.remove() })

  it('survives the selected card disappearing while the menu is open (board card menuItems got undefined)', () => {
    const root = createRoot(host)
    act(() => {
      root.render(<MemoryRouter><ContextMenu menu={{ x: 10, y: 10, world: { x: 0, y: 0 }, onCard: true }} onClose={() => {}} /></MemoryRouter>)
    })
    expect(host.textContent).toContain('Rename')
    // Deleted elsewhere (another tab, undo of a paste) while the menu is still showing.
    expect(() => act(() => { useBoard.getState()._remove(['card1']) })).not.toThrow()
    expect(host.textContent).not.toContain('Rename')
    expect(host.textContent).toContain('Duplicate')
    act(() => root.unmount())
  })
})
