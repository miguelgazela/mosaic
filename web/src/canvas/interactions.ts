import type { PointerEvent as ReactPointerEvent } from 'react'
import { newId } from '../lib/ids'
import { getCard } from '../cards/registry'
import type { DropHint } from '../cards/types'
import { addCmd, addConnsCmd, patchCmd } from './commands'
import { cloneConnections, connectionsAmong } from './connections'
import { startLineFromCard } from './connectInteractions'
import { batch } from './undo'
import { clientToScreen, clientToWorld } from './canvasDom'
import { alignGuides, boundsOf, rectFromPoints, rectsIntersect, resizeBox, snap, zoomAt, type Rect } from './geometry'
import { keysAfter } from './order'
import { elementHeight, elementRect, selectedIds, useBoard } from './store'
import type { CanvasElement } from './types'

const st = () => useBoard.getState()
const DRAG_THRESHOLD = 3
/** Screen px within which edges/centres snap to other cards. */
const GUIDE_THRESHOLD = 6

type Ev = Pick<PointerEvent, 'clientX' | 'clientY' | 'altKey' | 'shiftKey'>

/** Window-level pointer tracking with rAF-coalesced moves. The final move is flushed on release. */
export function track(onMove: (e: Ev) => void, onEnd: () => void): void {
  let last: PointerEvent | null = null
  let raf = 0
  const frame = () => {
    raf = 0
    if (last) { const e = last; last = null; onMove(e) }
  }
  const move = (e: PointerEvent) => {
    last = e
    if (!raf) raf = requestAnimationFrame(frame)
  }
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    if (raf) cancelAnimationFrame(raf)
    last = null
    onMove(e)
    onEnd()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

export function startPan(e: { clientX: number; clientY: number }): void {
  const origin = st().viewport
  const sx = e.clientX
  const sy = e.clientY
  st().setPanning(true)
  track(
    (ev) => st().setViewport({ ...origin, x: origin.x + ev.clientX - sx, y: origin.y + ev.clientY - sy }),
    () => st().setPanning(false),
  )
}

export function startMarquee(e: ReactPointerEvent): void {
  const s = st()
  const startWorld = clientToWorld(e.clientX, e.clientY)
  const sx = e.clientX
  const sy = e.clientY
  const base = e.shiftKey ? selectedIds(s) : []
  let moved = false
  let key = base.join()
  if (!e.shiftKey) s.setSelection([])
  track(
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      moved = true
      const rect: Rect = rectFromPoints(startWorld, clientToWorld(ev.clientX, ev.clientY))
      const cur = st()
      const hits = Object.keys(cur.elements).filter((id) => !cur.elements[id].parentId && rectsIntersect(rect, elementRect(cur, id)))
      const ids = [...new Set([...base, ...hits])]
      const k = ids.join()
      if (k !== key) { key = k; cur.setSelection(ids) }
      cur.setMarquee(rect)
    },
    () => st().setMarquee(null),
  )
}

type Box = { x: number; y: number; w: number }
/** World-space box of a rendered card (cards inside columns have no stored position). */
function domBox(id: string): Box | null {
  const node = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
  if (!node) return null
  const r = node.getBoundingClientRect()
  const p = clientToWorld(r.left, r.top)
  return { x: p.x, y: p.y, w: r.width / st().viewport.zoom }
}

const MOVE_KEYS = ['x', 'y', 'z', 'width', 'parentId', 'sortKey'] as const
const pickMove = (e: CanvasElement): Partial<CanvasElement> => {
  const o: Record<string, unknown> = {}
  for (const k of MOVE_KEYS) o[k] = e[k]
  return o as Partial<CanvasElement>
}

/** Drop target under the pointer (topmost first), or null. Never a card being dragged. */
function dropTargetAt(ev: Ev, draggedIds: string[]): { id: string; hint: DropHint } | null {
  const s = st()
  const p = clientToWorld(ev.clientX, ev.clientY)
  const dragged = draggedIds.map((i) => s.elements[i]).filter(Boolean)
  let best: { id: string; rank: number } | null = null
  for (const id in s.elements) {
    const t = s.elements[id]
    if (t.parentId || draggedIds.includes(id)) continue
    const dt = getCard(t.type)?.dropTarget
    if (!dt || !dt.accepts(t, dragged)) continue
    const r = elementRect(s, id)
    if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) continue
    if (!best || s.rank[id] > best.rank) best = { id, rank: s.rank[id] }
  }
  if (!best) return null
  const t = s.elements[best.id]
  return { id: best.id, hint: getCard(t.type)!.dropTarget!.hover?.(t, ev) ?? {} }
}

/** Pointer-down on a card. Returns true when the engine handled it (caller stops propagation). */
export function startCardDrag(e: ReactPointerEvent, id: string): boolean {
  const s = st()
  if (e.button !== 0 || s.spaceHeld || s.tool === 'hand') return false
  if (s.tool === 'line') return startLineFromCard(e, id)
  const wasSelected = !!s.selected[id]
  if (e.shiftKey) {
    const ids = selectedIds(s)
    s.setSelection(wasSelected ? ids.filter((i) => i !== id) : [...ids, id])
    if (wasSelected) return true
  } else if (!wasSelected) {
    s.setSelection([id])
  }

  const cloneMode = e.altKey
  const sx = e.clientX
  const sy = e.clientY
  let ids = selectedIds(st())
  let primary = id
  let origins: Record<string, { x: number; y: number; z: string }> = {}
  const capture = () => {
    origins = {}
    for (const i of ids) { const el = st().elements[i]; origins[i] = { x: el.x, y: el.y, z: el.z } }
  }
  const startIds = ids
  const before: Record<string, Partial<CanvasElement>> = {}
  for (const i of startIds) before[i] = pickMove(st().elements[i])
  let moved = false
  let clones: CanvasElement[] = []
  let cloneMap = new Map<string, string>()
  let lastDrop: { id: string; hint: DropHint } | null = null

  track(
    (ev) => {
      const cur = st()
      if (!moved) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
        moved = true
        cur.setDragging(true)
        if (cloneMode) {
          const sorted = [...ids].sort((a, b) => (cur.elements[a].z < cur.elements[b].z ? -1 : 1))
          const zs = keysAfter(Object.values(cur.elements).map((x) => x.z), sorted.length)
          const map: Record<string, string> = {}
          clones = sorted.map((oid, i) => {
            const o = cur.elements[oid]
            const nid = newId()
            map[oid] = nid
            const box = o.parentId ? domBox(oid) : null
            return {
              ...o, id: nid, z: zs[i], parentId: null, sortKey: null, content: structuredClone(o.content),
              ...(box ? { x: box.x, y: box.y, width: box.w } : {}),
            }
          })
          cur._add(clones)
          cloneMap = new Map(Object.entries(map))
          primary = map[id]
          ids = clones.map((c) => c.id)
          cur.setSelection(ids)
        } else {
          // Lift cards out of their column so they follow the pointer like any other card.
          const lifted = ids.filter((i) => cur.elements[i].parentId)
          if (lifted.length) {
            cur._patch(lifted.map((i) => {
              const b = domBox(i)
              return { id: i, patch: { parentId: null, sortKey: null, ...(b ? { x: b.x, y: b.y, width: b.w } : {}) } }
            }))
          }
        }
        capture()
      }
      const zoom = cur.viewport.zoom
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      const o = origins[primary]
      const doSnap = cloneMode || !ev.altKey
      let ddx = (doSnap ? snap(o.x + dx) : o.x + dx) - o.x
      let ddy = (doSnap ? snap(o.y + dy) : o.y + dy) - o.y
      lastDrop = dropTargetAt(ev, ids)
      cur.setDropHint(lastDrop ? { targetId: lastDrop.id, hint: lastDrop.hint } : null)
      if (doSnap && !lastDrop) {
        // Snap guides: align edges/centres of the moving group with other cards.
        const group = boundsOf(ids.map((i) => ({ ...elementRect(cur, i), x: origins[i].x + ddx, y: origins[i].y + ddy })))!
        const others = Object.keys(cur.elements).filter((i) => !ids.includes(i) && !cur.elements[i].parentId).map((i) => elementRect(cur, i))
        const g = alignGuides(group, others, GUIDE_THRESHOLD / zoom)
        ddx += g.dx
        ddy += g.dy
        cur.setGuides(g.guides)
      } else cur.setGuides([])
      cur._patch(ids.map((i) => ({ id: i, patch: { x: origins[i].x + ddx, y: origins[i].y + ddy } })))
    },
    () => {
      const cur = st()
      cur.setDragging(false)
      cur.setGuides([])
      cur.setDropHint(null)
      if (!moved) {
        if (!e.shiftKey && wasSelected && ids.length > 1) cur.setSelection([id])
        return
      }
      // z-to-front for everything that moved, keeping relative order.
      const sorted = [...ids].sort((a, b) => (cur.elements[a].z < cur.elements[b].z ? -1 : 1))
      const others = Object.values(cur.elements).filter((x) => !ids.includes(x.id)).map((x) => x.z)
      const zs = keysAfter(others, sorted.length)
      const patches: Record<string, Partial<CanvasElement>> = {}
      sorted.forEach((i, k) => { patches[i] = { z: zs[k] } })
      // Dropped on a card that takes drops (column): its patches (parentId, sortKey, width) win.
      if (lastDrop) {
        const target = cur.elements[lastDrop.id]
        const dt = getCard(target.type)?.dropTarget
        if (dt) {
          const dragged = sorted.map((i) => cur.elements[i])
          const dropped = dt.drop({ target, dragged, hint: lastDrop.hint })
          for (const i in dropped) patches[i] = { ...patches[i], ...dropped[i] }
        }
      }
      cur._patch(Object.entries(patches).map(([pid, patch]) => ({ id: pid, patch })))
      if (cloneMode) {
        // Lines between the copied cards are copied too.
        const lines = connectionsAmong(Object.values(cur.connections), new Set(cloneMap.keys()))
        const shift = { x: cur.elements[primary].x - origins[primary].x, y: cur.elements[primary].y - origins[primary].y }
        const copies = cloneConnections(lines, cloneMap, newId, shift)
        cur._addConns(copies)
        const added = addCmd(ids.map((i) => st().elements[i]))
        cur.commit(copies.length ? batch('Duplicate', [added, addConnsCmd(copies, false)]) : added)
        return
      }
      const entries = startIds.map((i) => ({ id: i, before: before[i], after: pickMove(st().elements[i]) }))
        .filter((en) => MOVE_KEYS.some((k) => en.before[k] !== en.after[k]))
      if (entries.length) cur.commit(patchCmd('Move', entries))
    },
  )
  return true
}

export function startResize(e: ReactPointerEvent, id: string, axis: 'x' | 'xy'): void {
  const s = st()
  const el = s.elements[id]
  const def = getCard(el.type)
  if (!def) return
  const origin = { w: el.width, h: elementHeight(s, id) }
  const sx = e.clientX
  const sy = e.clientY
  let changed = false
  track(
    (ev) => {
      const cur = st()
      const z = cur.viewport.zoom
      const box = resizeBox(origin, { dx: (ev.clientX - sx) / z, dy: (ev.clientY - sy) / z }, {
        axis,
        aspect: def.resize === 'aspect',
        minW: def.minWidth,
        minH: def.minHeight,
        snap: !ev.altKey,
      })
      const patch: Partial<CanvasElement> = { width: box.w }
      if (axis === 'xy' || def.resize === 'aspect') patch.height = box.h
      changed = box.w !== origin.w || (patch.height !== undefined && patch.height !== origin.h)
      cur._patch([{ id, patch }])
    },
    () => {
      if (!changed) return
      const cur = st()
      const now = cur.elements[id]
      const entries = [{
        id,
        before: { width: el.width, height: el.height },
        after: { width: now.width, height: now.height },
      }]
      cur.commit(patchCmd('Resize', entries))
    },
  )
}

/** Two-finger touch: pan + pinch zoom. Returns handlers bound to a pointer map. */
export function createTouchGestures() {
  const pts = new Map<number, { x: number; y: number }>()
  let start: { dist: number; cx: number; cy: number; vp: { x: number; y: number; zoom: number } } | null = null
  const metrics = () => {
    const [a, b] = [...pts.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
  }
  return {
    down(e: ReactPointerEvent): boolean {
      if (e.pointerType !== 'touch') return false
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) start = { ...metrics(), vp: st().viewport }
      return pts.size >= 2
    },
    move(e: ReactPointerEvent): void {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size !== 2 || !start) return
      const m = metrics()
      const anchor = clientToScreen(start.cx, start.cy)
      const zoomed = zoomAt(start.vp, start.vp.zoom * (m.dist / start.dist), anchor)
      st().setViewport({ ...zoomed, x: zoomed.x + (m.cx - start.cx), y: zoomed.y + (m.cy - start.cy) })
    },
    up(e: ReactPointerEvent): void {
      pts.delete(e.pointerId)
      if (pts.size < 2) start = null
    },
    get active() { return pts.size >= 2 },
  }
}
