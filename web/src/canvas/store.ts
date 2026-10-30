import { create } from 'zustand'
import type { CanvasElement } from './types'
import type { Guide, Rect, Size, Viewport } from './geometry'
import type { DropHint } from '../cards/types'
import { compareZ } from './order'
import { rootOf } from './columns'
import { UndoStack, type Command } from './undo'
import type { Anchor, ConnEnd, Connection } from './connections'

/** Below this zoom cards drop their text for grey bars (04-board-zoom-25). CSS: `[data-lod='low']` in index.css. */
export const LOW_ZOOM = 0.4

export type Tool = 'select' | 'hand' | 'line'
export interface Patch { id: string; patch: Partial<CanvasElement> }
export interface ConnPatch { id: string; patch: Partial<Connection> }

/** A line being drawn or having an end dragged. `a` is the fixed end (world), `cursor` the moving end. */
export interface Drawing {
  fixed: ConnEnd
  cursor: { x: number; y: number }
  /** Card the moving end would attach to, with the anchor it would use. */
  snap: { id: string; anchor: Anchor; rect: Rect } | null
  /** Only highlight the snap target (an end of an existing line is being dragged; the line itself shows the preview). */
  highlightOnly?: boolean
}

export const DEFAULT_AUTO_HEIGHT = 64

export interface BoardState {
  elements: Record<string, CanvasElement>
  /** Stacking rank per element (index in z order). */
  rank: Record<string, number>
  /** Measured heights for auto-height cards. */
  measured: Record<string, number>
  selected: Record<string, true>
  connections: Record<string, Connection>
  selectedConn: string | null
  /** Line whose label is being typed. */
  editingConn: string | null
  drawing: Drawing | null
  /** World rects of cards inside columns that lines attach to (measured from the DOM). */
  childRects: Record<string, Rect>
  viewport: Viewport
  size: Size
  tool: Tool
  spaceHeld: boolean
  dragging: boolean
  panning: boolean
  marquee: Rect | null
  guides: Guide[]
  /**
   * True while a change to elements/connections must not reach the write queue (cards leaving the board through
   * `move_elements`: the server already has them on the other board). Use `withoutSync`.
   */
  syncMuted: boolean
  /** Board being shown (parent of cards created now); set by the page that owns the canvas. */
  boardId: string | null
  /** FR-54: shared view and phone. Blocks every command, selection and edit; the engine stays otherwise intact. */
  readOnly: boolean
  setReadOnly(v: boolean): void
  setBoardId(id: string | null): void
  /** Card in text/name edit mode (note, column title, board name, swatch). */
  editing: string | null
  /** Drop target under the pointer during a card drag. */
  dropHint: { targetId: string; hint: DropHint } | null
  canUndo: boolean
  canRedo: boolean

  reset(els: CanvasElement[], conns?: Connection[]): void
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
  selectConn(id: string | null): void
  setEditingConn(id: string | null): void
  setDrawing(d: Drawing | null): void
  setChildRects(r: Record<string, Rect>): void
  reportHeight(id: string, h: number): void

  /** Raw mutators — only commands and live-drag code call these. */
  _add(els: CanvasElement[]): void
  _remove(ids: string[]): void
  _patch(patches: Patch[]): void
  _addConns(conns: Connection[]): void
  _removeConns(ids: string[]): void
  _patchConns(patches: ConnPatch[]): void

  exec(c: Command): void
  /** Record an already-applied command. */
  commit(c: Command): void
  undo(): void
  /** Undo `c` if it is the next command to revert; false when later commands sit on top of it. */
  undoIfTop(c: Command): boolean
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
    connections: {},
    selectedConn: null,
    editingConn: null,
    drawing: null,
    childRects: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    size: { w: 1000, h: 700 },
    tool: 'select',
    spaceHeld: false,
    dragging: false,
    panning: false,
    marquee: null,
    guides: [],
    boardId: null,
    readOnly: false,
    syncMuted: false,
    editing: null,
    dropHint: null,
    canUndo: false,
    canRedo: false,

    reset(els, conns = []) {
      history.clear()
      const elements: Record<string, CanvasElement> = {}
      for (const e of els) elements[e.id] = e
      const connections: Record<string, Connection> = {}
      for (const c of conns) connections[c.id] = c
      set({
        elements, rank: computeRank(elements), connections, measured: {}, childRects: {}, selected: {}, selectedConn: null,
        editingConn: null, drawing: null, marquee: null, editing: null, dropHint: null, ...flags(),
      })
    },
    setViewport: (viewport) => set({ viewport }),
    setSize: (size) => set({ size }),
    setTool: (tool) => { if (!get().readOnly) set({ tool }) },
    setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
    setDragging: (dragging) => set({ dragging }),
    setPanning: (panning) => set({ panning }),
    setMarquee: (marquee) => set({ marquee }),
    setGuides: (guides) => set((s) => (guides.length === 0 && s.guides.length === 0 ? s : { guides })),
    setBoardId: (boardId) => set({ boardId }),
    setReadOnly: (readOnly) => set(readOnly ? { readOnly, selected: {}, selectedConn: null, editing: null, editingConn: null, drawing: null, tool: 'select' } : { readOnly }),
    setEditing: (editing) => set((s) => (s.editing === editing || (s.readOnly && editing !== null) ? s : { editing })),
    setDropHint(dropHint) {
      const cur = get().dropHint
      if (cur === dropHint) return
      if (cur && dropHint && cur.targetId === dropHint.targetId && cur.hint.index === dropHint.hint.index) return
      set({ dropHint })
    },
    setSelection(ids) {
      const { elements, readOnly } = get()
      if (readOnly) return
      const selected: Record<string, true> = {}
      for (const id of ids) if (elements[id]) selected[id] = true
      set((s) => ({
        selected,
        selectedConn: null,
        ...(s.editing && !selected[s.editing] ? { editing: null } : {}),
        ...(s.editingConn ? { editingConn: null } : {}),
      }))
    },
    selectConn(id) {
      if (get().readOnly) return
      set((s) => ({ selected: {}, selectedConn: id && s.connections[id] ? id : null, editing: null, editingConn: null }))
    },
    setEditingConn: (editingConn) => set({ editingConn }),
    setDrawing: (drawing) => set({ drawing }),
    setChildRects: (childRects) => set({ childRects }),
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

    _addConns(conns) {
      set((s) => {
        const connections = { ...s.connections }
        for (const c of conns) connections[c.id] = c
        return { connections }
      })
    },
    _removeConns(ids) {
      set((s) => {
        const connections = { ...s.connections }
        for (const id of ids) delete connections[id]
        return {
          connections,
          ...(s.selectedConn && !connections[s.selectedConn] ? { selectedConn: null, editingConn: null } : {}),
        }
      })
    },
    _patchConns(patches) {
      set((s) => {
        const connections = { ...s.connections }
        for (const { id, patch } of patches) if (connections[id]) connections[id] = { ...connections[id], ...patch }
        return { connections }
      })
    },

    exec(c) {
      if (get().readOnly) return
      history.exec(c)
      set(flags())
    },
    commit(c) {
      if (get().readOnly) return
      history.push(c)
      set(flags())
    },
    undo() {
      if (get().readOnly) return
      history.undo()
      set(flags())
    },
    undoIfTop(c) {
      if (history.top !== c) return false
      history.undo()
      set(flags())
      return true
    },
    redo() {
      if (get().readOnly) return
      history.redo()
      set(flags())
    },
  }
})

/** Run store mutations that the sync layer must not write to the server (see `syncMuted`). */
export function withoutSync(fn: () => void): void {
  useBoard.setState({ syncMuted: true })
  try { fn() } finally { useBoard.setState({ syncMuted: false }) }
}

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

// Dev/e2e aid: lets tests and the console read the store (never shipped).
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __board?: typeof useBoard }).__board = useBoard
