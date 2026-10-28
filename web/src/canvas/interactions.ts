import type { PointerEvent as ReactPointerEvent } from 'react'
import { newId } from '../lib/ids'
import { getCard } from '../cards/registry'
import { addCmd, patchCmd, patchEntries } from './commands'
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
function track(onMove: (e: Ev) => void, onEnd: () => void): void {
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
      const hits = Object.keys(cur.elements).filter((id) => rectsIntersect(rect, elementRect(cur, id)))
      const ids = [...new Set([...base, ...hits])]
      const k = ids.join()
      if (k !== key) { key = k; cur.setSelection(ids) }
      cur.setMarquee(rect)
    },
    () => st().setMarquee(null),
  )
}

/** Pointer-down on a card. Returns true when the engine handled it (caller stops propagation). */
export function startCardDrag(e: ReactPointerEvent, id: string): boolean {
  const s = st()
  if (e.button !== 0 || s.spaceHeld || s.tool === 'hand') return false
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
  capture()
  const startOrigins = origins
  const startIds = ids
  let moved = false
  let clones: CanvasElement[] = []

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
            return { ...o, id: nid, z: zs[i], content: structuredClone(o.content) }
          })
          cur._add(clones)
          primary = map[id]
          ids = clones.map((c) => c.id)
          cur.setSelection(ids)
          capture()
        }
      }
      const zoom = cur.viewport.zoom
      const dx = (ev.clientX - sx) / zoom
      const dy = (ev.clientY - sy) / zoom
      const o = origins[primary]
      const doSnap = cloneMode || !ev.altKey
      let ddx = (doSnap ? snap(o.x + dx) : o.x + dx) - o.x
      let ddy = (doSnap ? snap(o.y + dy) : o.y + dy) - o.y
      if (doSnap) {
        // Snap guides: align edges/centres of the moving group with other cards.
        const group = boundsOf(ids.map((i) => ({ ...elementRect(cur, i), x: origins[i].x + ddx, y: origins[i].y + ddy })))!
        const others = Object.keys(cur.elements).filter((i) => !ids.includes(i)).map((i) => elementRect(cur, i))
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
      if (!moved) {
        if (!e.shiftKey && wasSelected && ids.length > 1) cur.setSelection([id])
        return
      }
      // z-to-front for everything that moved, keeping relative order.
      const sorted = [...ids].sort((a, b) => (cur.elements[a].z < cur.elements[b].z ? -1 : 1))
      const others = Object.values(cur.elements).filter((x) => !ids.includes(x.id)).map((x) => x.z)
      const zs = keysAfter(others, sorted.length)
      const patches = sorted.map((i, k) => ({ id: i, patch: { z: zs[k] } }))
      if (cloneMode) {
        cur._patch(patches)
        const finals = ids.map((i) => st().elements[i])
        cur.commit(addCmd(finals))
        return
      }
      const same = startIds.every((i) => cur.elements[i].x === startOrigins[i].x && cur.elements[i].y === startOrigins[i].y)
      if (same) return
      const afters: Record<string, Partial<CanvasElement>> = {}
      sorted.forEach((i, k) => { afters[i] = { x: cur.elements[i].x, y: cur.elements[i].y, z: zs[k] } })
      // before-state = original positions/z
      const entries = patchEntries(cur.elements, afters).map((en) => ({
        ...en,
        before: { x: startOrigins[en.id].x, y: startOrigins[en.id].y, z: startOrigins[en.id].z },
      }))
      cur._patch(patches)
      cur.commit(patchCmd('Move', entries))
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
