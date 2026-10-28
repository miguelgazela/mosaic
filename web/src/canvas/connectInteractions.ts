import type { PointerEvent as ReactPointerEvent } from 'react'
import { newId } from '../lib/ids'
import { clientToWorld } from './canvasDom'
import { addConnsCmd, patchConnCmd } from './commands'
import {
  defaultStyle, facingSide, resolveEnd, type Anchor, type ConnEnd, type Side,
} from './connections'
import { liveRect } from './connectionLayout'
import type { Point, Rect } from './geometry'
import { track } from './interactions'
import { useBoard } from './store'

const st = () => useBoard.getState()
const DRAG_THRESHOLD = 3
/** A free line shorter than this (world px) is treated as a stray click and dropped. */
const MIN_FREE_LENGTH = 12

/** Card under the pointer (innermost first), skipping `exclude` and the column it sits in. */
function cardAt(clientX: number, clientY: number, exclude: string | null): string | null {
  const parent = exclude ? st().elements[exclude]?.parentId ?? null : null
  for (const n of document.elementsFromPoint(clientX, clientY)) {
    const id = n.closest<HTMLElement>('[data-card-id]')?.dataset.cardId
    if (id && id !== exclude && id !== parent && st().elements[id]) return id
  }
  return null
}

/** Side of `r` closest to `p` (for a pointer that starts on the card). */
export function nearestSide(r: Rect, p: Point): Side {
  const d: [Side, number][] = [
    ['left', Math.abs(p.x - r.x)],
    ['right', Math.abs(p.x - (r.x + r.w))],
    ['top', Math.abs(p.y - r.y)],
    ['bottom', Math.abs(p.y - (r.y + r.h))],
  ]
  return d.sort((a, b) => a[1] - b[1])[0][0]
}

const mid: Anchor['t'] = 0.5

/**
 * Drag a line out of `from`. The other end follows the pointer and snaps to the card under it
 * (side facing the start). Releasing on empty canvas leaves a free end. One undo step.
 */
function startLine(e: { clientX: number; clientY: number }, start: ConnEnd, autoSide = false): void {
  const rectOfStart = start.elementId ? liveRect(start.elementId) : null
  /** With `autoSide` the line leaves from the side facing the other end, wherever the pointer went down. */
  const fromFor = (toward: Point): ConnEnd =>
    autoSide && start.elementId && rectOfStart ? { elementId: start.elementId, anchor: { side: facingSide(rectOfStart, toward), t: mid } } : start
  const origin = resolveEnd(start, liveRect)
  if (!origin) return
  const sx = e.clientX
  const sy = e.clientY
  let moved = false
  st().setDrawing({ fixed: start, cursor: origin, snap: null })
  track(
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      moved = true
      const cursor = clientToWorld(ev.clientX, ev.clientY)
      const target = cardAt(ev.clientX, ev.clientY, start.elementId)
      const r = target ? liveRect(target) : null
      const toward = target && r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : cursor
      const from = fromFor(toward)
      const fixed = resolveEnd(from, liveRect) ?? origin
      st().setDrawing({
        fixed: from,
        cursor,
        snap: target && r ? { id: target, anchor: { side: facingSide(r, fixed), t: mid }, rect: r } : null,
      })
    },
    () => {
      const d = st().drawing
      st().setDrawing(null)
      if (!moved || !d) return
      const from = d.fixed
      const fixed = resolveEnd(from, liveRect) ?? origin
      if (!d.snap && Math.hypot(d.cursor.x - fixed.x, d.cursor.y - fixed.y) < MIN_FREE_LENGTH) return
      const to: ConnEnd = d.snap ? { elementId: d.snap.id, anchor: d.snap.anchor } : { elementId: null, point: d.cursor }
      st().exec(addConnsCmd([{ id: newId(), from, to, style: defaultStyle(), label: null }]))
      st().setTool('select')
    },
  )
}

/** Pointer-down on a card's edge handle. */
export function startLineFromHandle(e: ReactPointerEvent, id: string, side: Side): void {
  startLine(e, { elementId: id, anchor: { side, t: mid } })
}

/** Line tool: pointer-down on a card (returns true so the card is not dragged). */
export function startLineFromCard(e: ReactPointerEvent, id: string): boolean {
  const r = liveRect(id)
  if (!r) return false
  startLine(e, { elementId: id, anchor: { side: nearestSide(r, clientToWorld(e.clientX, e.clientY)), t: mid } }, true)
  return true
}

/** Line tool: pointer-down on empty canvas starts a free end. */
export function startLineFromCanvas(e: ReactPointerEvent): void {
  startLine(e, { elementId: null, point: clientToWorld(e.clientX, e.clientY) })
}

/** Drag one end of a line: attaches to the card under the pointer, detaches onto empty canvas. */
export function startMoveEnd(e: ReactPointerEvent, connId: string, which: 'from' | 'to'): void {
  const c0 = st().connections[connId]
  if (!c0) return
  const other = which === 'from' ? c0.to : c0.from
  const fixed = resolveEnd(other, liveRect)
  if (!fixed) return
  const sx = e.clientX
  const sy = e.clientY
  let moved = false
  track(
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      if (!moved) { moved = true; st().setDragging(true) }
      const target = cardAt(ev.clientX, ev.clientY, other.elementId)
      const r = target ? liveRect(target) : null
      const cursor = clientToWorld(ev.clientX, ev.clientY)
      const end: ConnEnd = target && r
        ? { elementId: target, anchor: { side: facingSide(r, fixed), t: mid } }
        : { elementId: null, point: cursor }
      st()._patchConns([{ id: connId, patch: { [which]: end } }])
      st().setDrawing({
        fixed: other, cursor, highlightOnly: true,
        snap: target && r ? { id: target, anchor: { side: facingSide(r, fixed), t: mid }, rect: r } : null,
      })
    },
    () => {
      st().setDrawing(null)
      if (!moved) return
      st().setDragging(false)
      const now = st().connections[connId]
      if (now) st().commit(patchConnCmd('Move line end', [{ id: connId, before: { [which]: c0[which] }, after: { [which]: now[which] } }]))
    },
  )
}

/** Drag the bend handle: the curve's midpoint follows the pointer (a straight line becomes curved). */
export function startBend(e: ReactPointerEvent, connId: string, a: Point, b: Point): void {
  const c0 = st().connections[connId]
  if (!c0) return
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const sx = e.clientX
  const sy = e.clientY
  let moved = false
  track(
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      if (!moved) { moved = true; st().setDragging(true) }
      const p = clientToWorld(ev.clientX, ev.clientY)
      st()._patchConns([{ id: connId, patch: { style: { ...c0.style, curve: 'curved', bend: { x: p.x - m.x, y: p.y - m.y } } } }])
    },
    () => {
      if (!moved) return
      st().setDragging(false)
      const now = st().connections[connId]
      if (now) st().commit(patchConnCmd('Bend line', [{ id: connId, before: { style: c0.style }, after: { style: now.style } }]))
    },
  )
}
