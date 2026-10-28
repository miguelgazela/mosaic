import { create } from 'zustand'
import type { CanvasElement } from './types'
import type { Guide, Rect, Size, Viewport } from './geometry'
import type { DropHint } from '../cards/types'
import { compareZ } from './order'
import { rootOf } from './columns'
import { UndoStack, type Command } from './undo'

export type Tool = 'select' | 'hand'
export interface Patch { id: string; patch: Partial<CanvasElement> }

export const DEFAULT_AUTO_HEIGHT = 64

export interface BoardState {
  elements: Record<string, CanvasElement>
  /** Stacking rank per element (index in z order). */
  rank: Record<string, number>
  /** Measured heights for auto-height cards. */
  measured: Record<string, number>
  selected: Record<string, true>
  viewport: Viewport
  size: Size
  tool: Tool
  spaceHeld: boolean
  dragging: boolean
  panning: boolean
  marquee: Rect | null
  guides: Guide[]
  /** Board being shown (parent of cards created now); set by the page that owns the canvas. */
  boardId: string | null
  setBoardId(id: string | null): void
  /** Card in text/name edit mode (note, column title, board name, swatch). */
  editing: string | null
  /** Drop target under the pointer during a card drag. */
  dropHint: { targetId: string; hint: DropHint } | null
  canUndo: boolean
  canRedo: boolean

  reset(els: CanvasElement[]): void
  setViewport(vp: Viewport): void
  setSize(size: Size): void
  setTool(t: Tool): void
  setSpaceHeld(v: boolean): void
  setDragging(v: boolean): void
  setPanning(v: boolean): void
  setMarquee(r: Rect | null): void
  setGuides(g: Guide[]): void
  setEditing(id: string | null): void
  setDropHint(h: { targetId: string; hint: DropHint } | null): void
  setSelection(ids: string[]): void
  reportHeight(id: string, h: number): void

  /** Raw mutators — only commands and live-drag code call these. */
  _add(els: CanvasElement[]): void
  _remove(ids: string[]): void
  _patch(patches: Patch[]): void

  exec(c: Command): void
  /** Record an already-applied command. */
  commit(c: Command): void
  undo(): void
  redo(): void
}

const history = new UndoStack(200)

function computeRank(elements: Record<string, CanvasElement>): Record<string, number> {
  const ids = Object.keys(elements).sort((a, b) => compareZ(elements[a].z, elements[b].z) || compareZ(a, b))
  const rank: Record<string, number> = {}
  ids.forEach((id, i) => { rank[id] = i })
  return rank
}

export const useBoard = create<BoardState>()((set, get) => {
  const flags = () => ({ canUndo: history.canUndo, canRedo: history.canRedo })
  return {
    elements: {},
    rank: {},
    measured: {},
    selected: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    size: { w: 1000, h: 700 },
    tool: 'select',
    spaceHeld: false,
    dragging: false,
    panning: false,
    marquee: null,
    guides: [],
    boardId: null,
    editing: null,
    dropHint: null,
    canUndo: false,
    canRedo: false,

    reset(els) {
      history.clear()
      const elements: Record<string, CanvasElement> = {}
      for (const e of els) elements[e.id] = e
      set({ elements, rank: computeRank(elements), measured: {}, selected: {}, marquee: null, editing: null, dropHint: null, ...flags() })
    },
    setViewport: (viewport) => set({ viewport }),
    setSize: (size) => set({ size }),
    setTool: (tool) => set({ tool }),
    setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
    setDragging: (dragging) => set({ dragging }),
    setPanning: (panning) => set({ panning }),
    setMarquee: (marquee) => set({ marquee }),
    setGuides: (guides) => set((s) => (guides.length === 0 && s.guides.length === 0 ? s : { guides })),
    setBoardId: (boardId) => set({ boardId }),
    setEditing: (editing) => set((s) => (s.editing === editing ? s : { editing })),
    setDropHint(dropHint) {
      const cur = get().dropHint
      if (cur === dropHint) return
      if (cur && dropHint && cur.targetId === dropHint.targetId && cur.hint.index === dropHint.hint.index) return
      set({ dropHint })
    },
    setSelection(ids) {
      const { elements } = get()
      const selected: Record<string, true> = {}
      for (const id of ids) if (elements[id]) selected[id] = true
      set((s) => (s.editing && !selected[s.editing] ? { selected, editing: null } : { selected }))
    },
    reportHeight(id, h) {
      if (get().measured[id] === h) return
      set((s) => ({ measured: { ...s.measured, [id]: h } }))
    },

    _add(els) {
      set((s) => {
        const elements = { ...s.elements }
        for (const e of els) elements[e.id] = e
        return { elements, rank: computeRank(elements) }
      })
    },
    _remove(ids) {
      set((s) => {
        const elements = { ...s.elements }
        const selected = { ...s.selected }
        for (const id of ids) {
          delete elements[id]
          delete selected[id]
        }
        return { elements, selected, rank: computeRank(elements) }
      })
    },
    _patch(patches) {
      set((s) => {
        const elements = { ...s.elements }
        let zChanged = false
        for (const { id, patch } of patches) {
          const cur = elements[id]
          if (!cur) continue
          if ('z' in patch) zChanged = true
          elements[id] = { ...cur, ...patch }
        }
        return zChanged ? { elements, rank: computeRank(elements) } : { elements }
      })
    },

    exec(c) {
      history.exec(c)
      set(flags())
    },
    commit(c) {
      history.push(c)
      set(flags())
    },
    undo() {
      history.undo()
      set(flags())
    },
    redo() {
      history.redo()
      set(flags())
    },
  }
})

export const selectedIds = (s: BoardState): string[] => Object.keys(s.selected)

export const elementHeight = (s: BoardState, id: string): number => {
  const e = s.elements[id]
  return e.height ?? s.measured[id] ?? DEFAULT_AUTO_HEIGHT
}

/** Rect in world space. A card inside a column reports its column's rect (children have no own x/y). */
export const elementRect = (s: BoardState, id: string): Rect => {
  const e = rootOf(s.elements, id) ?? s.elements[id]
  id = e.id
  return { x: e.x, y: e.y, w: e.width, h: elementHeight(s, id) }
}
