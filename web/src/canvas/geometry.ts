export const GRID = 8
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Viewport { x: number; y: number; zoom: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
export const clampZoom = (z: number): number => clamp(z, MIN_ZOOM, MAX_ZOOM)

export const snap = (v: number, grid = GRID): number => Math.round(v / grid) * grid
export const maybeSnap = (v: number, enabled: boolean, grid = GRID): number => (enabled ? snap(v, grid) : v)

export const screenToWorld = (vp: Viewport, p: Point): Point => ({
  x: (p.x - vp.x) / vp.zoom,
  y: (p.y - vp.y) / vp.zoom,
})

export const worldToScreen = (vp: Viewport, p: Point): Point => ({
  x: p.x * vp.zoom + vp.x,
  y: p.y * vp.zoom + vp.y,
})

/** Zoom to `zoom` keeping the world point under `anchor` (screen space) fixed. */
export function zoomAt(vp: Viewport, zoom: number, anchor: Point): Viewport {
  const z = clampZoom(zoom)
  const wx = (anchor.x - vp.x) / vp.zoom
  const wy = (anchor.y - vp.y) / vp.zoom
  return { zoom: z, x: anchor.x - wx * z, y: anchor.y - wy * z }
}

export const centerOfView = (vp: Viewport, size: Size): Point =>
  screenToWorld(vp, { x: size.w / 2, y: size.h / 2 })

export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

/** Overlap with positive area; touching edges do not intersect. */
export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Viewport showing `bounds` centred with padding; null bounds → 100% at origin. */
export function fitViewport(bounds: Rect | null, size: Size, padding = 64, maxZoom = 1): Viewport {
  if (!bounds) return { x: 0, y: 0, zoom: 1 }
  const zx = (size.w - padding * 2) / Math.max(bounds.w, 1)
  const zy = (size.h - padding * 2) / Math.max(bounds.h, 1)
  const zoom = clamp(Math.min(zx, zy), MIN_ZOOM, maxZoom)
  return {
    zoom,
    x: size.w / 2 - (bounds.x + bounds.w / 2) * zoom,
    y: size.h / 2 - (bounds.y + bounds.h / 2) * zoom,
  }
}

export interface ResizeOpts {
  /** 'x' changes width only; 'xy' changes both. */
  axis: 'x' | 'xy'
  aspect: boolean
  minW: number
  minH: number
  snap: boolean
}

/** New size when dragging the east / south-east handle by (dx, dy) world units. */
export function resizeBox(origin: { w: number; h: number }, d: { dx: number; dy: number }, o: ResizeOpts): { w: number; h: number } {
  let w = Math.max(o.minW, maybeSnap(origin.w + d.dx, o.snap))
  if (o.aspect) {
    const ratio = origin.w / origin.h
    let h = w / ratio
    if (h < o.minH) {
      h = o.minH
      w = h * ratio
    }
    return { w, h }
  }
  const h = o.axis === 'xy' ? Math.max(o.minH, maybeSnap(origin.h + d.dy, o.snap)) : origin.h
  return { w, h }
}

export interface Guide {
  /** 'v' = vertical line at x = pos; 'h' = horizontal line at y = pos. */
  axis: 'v' | 'h'
  pos: number
  /** Extent along the other axis. */
  from: number
  to: number
}

const anchors = (lo: number, size: number): number[] => [lo, lo + size / 2, lo + size]

function bestOffset(mine: number[], theirs: number[], threshold: number): number {
  let best = 0
  let bestAbs = Infinity
  for (const m of mine) {
    for (const t of theirs) {
      const d = t - m
      if (Math.abs(d) <= threshold && Math.abs(d) < bestAbs) { best = d; bestAbs = Math.abs(d) }
    }
  }
  return bestAbs === Infinity ? 0 : best
}

/**
 * Snap guides (FR-53): when an edge or centre of `moving` is within `threshold` of an edge or
 * centre of another rect, return the offset that aligns them and the lines to draw.
 */
export function alignGuides(moving: Rect, others: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const xs = others.flatMap((o) => anchors(o.x, o.w))
  const ys = others.flatMap((o) => anchors(o.y, o.h))
  const dx = bestOffset(anchors(moving.x, moving.w), xs, threshold)
  const dy = bestOffset(anchors(moving.y, moving.h), ys, threshold)
  const m = { ...moving, x: moving.x + dx, y: moving.y + dy }
  const EPS = 0.5
  const lines = new Map<string, Guide>()
  const add = (axis: 'v' | 'h', pos: number, from: number, to: number) => {
    const key = `${axis}${Math.round(pos * 2)}`
    const cur = lines.get(key)
    if (cur) { cur.from = Math.min(cur.from, from); cur.to = Math.max(cur.to, to) } else lines.set(key, { axis, pos, from, to })
  }
  for (const o of others) {
    const top = Math.min(m.y, o.y)
    const bottom = Math.max(m.y + m.h, o.y + o.h)
    const left = Math.min(m.x, o.x)
    const right = Math.max(m.x + m.w, o.x + o.w)
    for (const a of anchors(m.x, m.w)) for (const b of anchors(o.x, o.w)) if (Math.abs(a - b) < EPS) add('v', b, top, bottom)
    for (const a of anchors(m.y, m.h)) for (const b of anchors(o.y, o.h)) if (Math.abs(a - b) < EPS) add('h', b, left, right)
  }
  return { dx, dy, guides: [...lines.values()] }
}
