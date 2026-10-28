import { clientToWorld } from './canvasDom'
import type { Rect } from './geometry'
import { elementRect, type BoardState } from './store'
import { useBoard } from './store'

/** Rect a line attaches to. A card inside a column uses its measured rect; a collapsed column's cards use the column. */
export function endRect(s: BoardState, id: string): Rect | null {
  const e = s.elements[id]
  if (!e) return null
  if (e.parentId) return s.childRects[id] ?? elementRect(s, id)
  return elementRect(s, id)
}

/** World rect of a rendered card, read from the DOM (null when it is not on screen, e.g. in a collapsed column). */
export function domRect(id: string): Rect | null {
  const node = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
  if (!node) return null
  const r = node.getBoundingClientRect()
  const p = clientToWorld(r.left, r.top)
  const z = useBoard.getState().viewport.zoom
  return { x: p.x, y: p.y, w: r.width / z, h: r.height / z }
}

/** Current rect for interaction code: DOM-measured when possible, store otherwise. */
export function liveRect(id: string): Rect | null {
  return domRect(id) ?? endRect(useBoard.getState(), id)
}

const same = (a: Rect | undefined, b: Rect): boolean =>
  !!a && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01

/**
 * Keep `childRects` in step with the DOM for cards inside columns that a line is attached to
 * (their position comes from the column layout, not from the store). Returns an unsubscribe function.
 */
export function trackChildRects(): () => void {
  let raf = 0
  let settle: ReturnType<typeof setTimeout> | undefined
  const measure = () => {
    raf = 0
    const s = useBoard.getState()
    const ids = new Set<string>()
    for (const c of Object.values(s.connections)) {
      for (const e of [c.from, c.to]) if (e.elementId && s.elements[e.elementId]?.parentId) ids.add(e.elementId)
    }
    const next: Record<string, Rect> = {}
    let changed = ids.size !== Object.keys(s.childRects).length
    for (const id of ids) {
      const r = domRect(id)
      if (!r) continue
      next[id] = r
      if (!same(s.childRects[id], r)) changed = true
    }
    if (changed || Object.keys(next).length !== Object.keys(s.childRects).length) s.setChildRects(next)
  }
  // Cards tilt and settle with a CSS transition after a drag; measure once more when it is over.
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(measure)
    clearTimeout(settle)
    settle = setTimeout(() => { if (!raf) raf = requestAnimationFrame(measure) }, 320)
  }
  schedule()
  const unsub = useBoard.subscribe((s, p) => {
    if (s.elements !== p.elements || s.measured !== p.measured || s.connections !== p.connections || s.size !== p.size) schedule()
  })
  return () => {
    unsub()
    if (raf) cancelAnimationFrame(raf)
    clearTimeout(settle)
  }
}
