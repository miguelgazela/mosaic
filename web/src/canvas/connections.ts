import type { Point, Rect } from './geometry'

export type Side = 'top' | 'right' | 'bottom' | 'left'
/** Where a line meets a card: a side and a position `t` (0–1) along it. */
export interface Anchor { side: Side; t: number }

/** One end of a line. Attached: `elementId` + `anchor`. Free: `point` (world space). */
export interface ConnEnd {
  elementId: string | null
  anchor?: Anchor
  point?: Point
}

export type Head = 'none' | 'start' | 'end' | 'both'

export interface ConnStyle {
  curve: 'straight' | 'curved'
  /** Curved lines only: offset of the curve's midpoint from the middle of the chord (world px). Unset = default bow. */
  bend?: Point
  dash: boolean
  head: Head
  /** Hex colour, one of LINE_COLORS. */
  color: string
}

export interface Connection {
  id: string
  from: ConnEnd
  to: ConnEnd
  style: ConnStyle
  label: string | null
}

/** Line colours from design/screens/00-connections.png. */
export const LINE_COLORS = [
  { hex: '#55524D', name: 'Graphite' },
  { hex: '#7C3AED', name: 'Violet' },
  { hex: '#C2410C', name: 'Orange' },
  { hex: '#1E7A4C', name: 'Green' },
] as const

export const defaultStyle = (): ConnStyle => ({ curve: 'straight', dash: false, head: 'end', color: LINE_COLORS[0].hex })

/** Stroke and arrowhead sizes (world px; 2 px stroke, 9 px arrowhead per the design). */
export const STROKE = 2
export const ARROW = 9

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function anchorPoint(r: Rect, a: Anchor): Point {
  const t = Math.min(1, Math.max(0, a.t))
  switch (a.side) {
    case 'top': return { x: r.x + r.w * t, y: r.y }
    case 'bottom': return { x: r.x + r.w * t, y: r.y + r.h }
    case 'left': return { x: r.x, y: r.y + r.h * t }
    case 'right': return { x: r.x + r.w, y: r.y + r.h * t }
  }
}

/** Side of `r` that faces `toward` (compares the offset to the card's half-size, so wide cards prefer left/right). */
export function facingSide(r: Rect, toward: Point): Side {
  const dx = (toward.x - (r.x + r.w / 2)) / Math.max(r.w / 2, 1)
  const dy = (toward.y - (r.y + r.h / 2)) / Math.max(r.h / 2, 1)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

export const sideNormal = (s: Side): Point =>
  s === 'top' ? { x: 0, y: -1 } : s === 'bottom' ? { x: 0, y: 1 } : s === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 }

/** Resolve an end to a world point, or null when its card is missing. */
export function resolveEnd(end: ConnEnd, rectOf: (id: string) => Rect | null): Point | null {
  if (end.elementId) {
    const r = rectOf(end.elementId)
    if (!r) return null
    return anchorPoint(r, end.anchor ?? { side: 'right', t: 0.5 })
  }
  return end.point ?? null
}

export interface LineGeometry {
  a: Point
  b: Point
  /** Quadratic control point (curved lines). */
  c: Point | null
  /** SVG path data. */
  d: string
  /** Point on the line halfway along (label, popover, bend handle). */
  mid: Point
  /** Direction the line leaves `a` and arrives at `b` (unit vectors). */
  dirStart: Point
  dirEnd: Point
}

const unit = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y)
  return l < 1e-6 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l }
}

/** Default bow of a curved line: a fifth of its length, perpendicular to the chord. */
export function defaultBend(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: 0, y: 0 }
  const k = Math.min(len * 0.2, 120)
  return { x: (-dy / len) * k, y: (dx / len) * k }
}

/**
 * Geometry of a line between `a` and `b`. `trim` shortens the drawn path at each end (so a stroke does not poke
 * through the tip of an arrowhead); `mid`, `dirStart` and `dirEnd` always refer to the untrimmed line.
 */
export function lineGeometry(
  a: Point,
  b: Point,
  style: Pick<ConnStyle, 'curve' | 'bend'>,
  trim: { start: number; end: number } = { start: 0, end: 0 },
): LineGeometry {
  const m = mid(a, b)
  const curved = style.curve === 'curved'
  const off = curved ? style.bend ?? defaultBend(a, b) : { x: 0, y: 0 }
  // A quadratic curve passes through (mid + control) / 2 at t = ½, so the control sits at twice the offset.
  const c = curved ? { x: m.x + 2 * off.x, y: m.y + 2 * off.y } : null
  const dirStart = unit(c ? { x: c.x - a.x, y: c.y - a.y } : { x: b.x - a.x, y: b.y - a.y })
  const dirEnd = unit(c ? { x: b.x - c.x, y: b.y - c.y } : { x: b.x - a.x, y: b.y - a.y })
  const pa = { x: a.x + dirStart.x * trim.start, y: a.y + dirStart.y * trim.start }
  const pb = { x: b.x - dirEnd.x * trim.end, y: b.y - dirEnd.y * trim.end }
  return {
    a, b, c,
    d: c ? `M${pa.x} ${pa.y}Q${c.x} ${c.y} ${pb.x} ${pb.y}` : `M${pa.x} ${pa.y}L${pb.x} ${pb.y}`,
    mid: { x: m.x + off.x, y: m.y + off.y },
    dirStart,
    dirEnd,
  }
}

/** Triangle with its tip at `tip`, pointing along `dir`. Returns SVG `points`. */
export function arrowPoints(tip: Point, dir: Point, size = ARROW): string {
  const back = { x: tip.x - dir.x * size, y: tip.y - dir.y * size }
  const w = size * 0.55
  const nx = -dir.y * w
  const ny = dir.x * w
  return `${tip.x},${tip.y} ${back.x + nx},${back.y + ny} ${back.x - nx},${back.y - ny}`
}

/** Whether the arrowhead is drawn at the start / end. */
export const headAtStart = (h: Head): boolean => h === 'start' || h === 'both'
export const headAtEnd = (h: Head): boolean => h === 'end' || h === 'both'

// --- copy / duplicate ------------------------------------------------------------------

/** Lines to carry along with `ids`: every attached end is in the set, and at least one end is attached. */
export function connectionsAmong(conns: Iterable<Connection>, ids: ReadonlySet<string>): Connection[] {
  const out: Connection[] = []
  for (const c of conns) {
    const ends = [c.from, c.to]
    const attached = ends.filter((e) => e.elementId)
    if (attached.length && attached.every((e) => ids.has(e.elementId!))) out.push(c)
  }
  return out
}

/** Lines that touch any of `ids` (they go when those cards are deleted). */
export function connectionsTouching(conns: Iterable<Connection>, ids: ReadonlySet<string>): Connection[] {
  const out: Connection[] = []
  for (const c of conns) if ((c.from.elementId && ids.has(c.from.elementId)) || (c.to.elementId && ids.has(c.to.elementId))) out.push(c)
  return out
}

/** Copies of `conns` re-pointed through `idMap` (old card id → new card id); free ends move by `offset`. */
export function cloneConnections(
  conns: Connection[],
  idMap: ReadonlyMap<string, string>,
  makeId: () => string,
  offset: Point,
): Connection[] {
  const end = (e: ConnEnd): ConnEnd =>
    e.elementId
      ? { elementId: idMap.get(e.elementId) ?? e.elementId, anchor: e.anchor ? { ...e.anchor } : undefined }
      : { elementId: null, point: e.point ? { x: e.point.x + offset.x, y: e.point.y + offset.y } : undefined }
  return conns.map((c) => ({
    id: makeId(),
    from: end(c.from),
    to: end(c.to),
    style: { ...c.style, bend: c.style.bend ? { ...c.style.bend } : undefined },
    label: c.label,
  }))
}
