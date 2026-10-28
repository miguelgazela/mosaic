import { memo, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { startBend, startMoveEnd } from './connectInteractions'
import {
  ARROW, STROKE, anchorPoint, arrowPoints, headAtEnd, headAtStart, lineGeometry, resolveEnd, type Connection, type LineGeometry,
} from './connections'
import { endRect, liveRect, trackChildRects } from './connectionLayout'
import type { Point, Rect } from './geometry'
import { useBoard } from './store'

/** Resolved end points of a line (null while a card it hangs on is missing). */
function useEnds(c: Connection | undefined): { a: Point; b: Point } | null {
  const rA = useBoard(useShallow((s) => (c?.from.elementId ? endRect(s, c.from.elementId) : null) as Rect | null))
  const rB = useBoard(useShallow((s) => (c?.to.elementId ? endRect(s, c.to.elementId) : null) as Rect | null))
  return useMemo(() => {
    if (!c) return null
    const a = resolveEnd(c.from, () => rA)
    const b = resolveEnd(c.to, () => rB)
    return a && b ? { a, b } : null
  }, [c, rA, rB])
}

/** Geometry of a line, trimmed so the stroke ends inside its arrowheads. */
function useGeometry(c: Connection | undefined): LineGeometry | null {
  const ends = useEnds(c)
  return useMemo(() => {
    if (!c || !ends) return null
    return lineGeometry(ends.a, ends.b, c.style, {
      start: headAtStart(c.style.head) ? ARROW * 0.7 : 0,
      end: headAtEnd(c.style.head) ? ARROW * 0.7 : 0,
    })
  }, [c, ends])
}

const darker = (hex: string) => `color-mix(in srgb, ${hex} 78%, black)`

const ConnectionView = memo(function ConnectionView({ id }: { id: string }) {
  const c = useBoard((s) => s.connections[id])
  const g = useGeometry(c)
  const zoom = useBoard((s) => s.viewport.zoom)
  const selected = useBoard((s) => s.selectedConn === id)
  const [hover, setHover] = useState(false)
  if (!c || !g) return null
  const w = Math.max(STROKE, 1.5 / zoom)
  const hot = hover && !selected
  const color = hot ? darker(c.style.color) : c.style.color
  const select = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const s = useBoard.getState()
    if (s.spaceHeld || s.tool === 'hand') return // let the canvas pan
    e.stopPropagation()
    s.selectConn(id)
  }
  const events = {
    onPointerDown: select,
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      useBoard.getState().selectConn(id)
      useBoard.getState().setEditingConn(id)
    },
  }
  return (
    <g data-testid="connection" data-id={id} data-selected={selected} data-hover={hot}>
      {hot && <path d={g.d} fill="none" stroke="var(--primary)" strokeOpacity={0.22} strokeWidth={10 / zoom} strokeLinecap="round" />}
      <path
        d={g.d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(14 / zoom, 8)}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        data-testid="connection-hit"
        {...events}
      />
      <path
        d={g.d}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeDasharray={c.style.dash ? `${w * 3} ${w * 2.5}` : undefined}
        style={{ pointerEvents: 'none' }}
      />
      {headAtEnd(c.style.head) && <polygon points={arrowPoints(g.b, g.dirEnd)} fill={color} style={{ pointerEvents: 'none' }} />}
      {headAtStart(c.style.head) && <polygon points={arrowPoints(g.a, { x: -g.dirStart.x, y: -g.dirStart.y })} fill={color} style={{ pointerEvents: 'none' }} />}
      {c.label && (
        <text
          x={g.mid.x}
          y={g.mid.y}
          textAnchor="middle"
          dominantBaseline="central"
          data-testid="connection-label"
          style={{
            fontSize: 12, fontWeight: 500, fill: 'var(--text)', stroke: 'var(--canvas-bg)', strokeWidth: 8,
            paintOrder: 'stroke', strokeLinejoin: 'round', cursor: 'pointer', userSelect: 'none',
          }}
          {...events}
        >
          {c.label}
        </text>
      )}
    </g>
  )
})

/** Lines under the cards (SVG in world space). Lines follow their cards; hit areas are wider than the stroke. */
export const ConnectionsLayer = memo(function ConnectionsLayer() {
  const ids = useBoard(useShallow((s) => Object.keys(s.connections)))
  useEffect(() => trackChildRects(), [])
  return (
    <svg
      data-testid="connections-layer"
      width={1}
      height={1}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}
      aria-hidden
    >
      {ids.map((id) => <ConnectionView key={id} id={id} />)}
    </svg>
  )
})

const handleStyle = { fill: 'var(--card-bg)', stroke: 'var(--primary)' }

/** Handles of the selected line, the preview while drawing, and the highlight on the card a line would snap to. */
export const ConnectionsOverlay = memo(function ConnectionsOverlay() {
  const selId = useBoard((s) => s.selectedConn)
  const c = useBoard((s) => (s.selectedConn ? s.connections[s.selectedConn] : undefined))
  const g = useGeometry(c)
  const zoom = useBoard((s) => s.viewport.zoom)
  const drawing = useBoard((s) => s.drawing)
  const snapRect = drawing?.snap?.rect ?? null
  const fixedPt = useMemo(() => (drawing ? resolveEnd(drawing.fixed, liveRect) : null), [drawing])
  const r = 5 / zoom
  const sw = 1.5 / zoom

  let preview: LineGeometry | null = null
  let tip: Point | null = null
  if (drawing && fixedPt && !drawing.highlightOnly) {
    tip = drawing.cursor
    if (drawing.snap) tip = anchorPoint(drawing.snap.rect, drawing.snap.anchor)
    preview = lineGeometry(fixedPt, tip, { curve: drawing.snap ? 'straight' : 'curved' })
  }

  return (
    <svg
      data-testid="connections-overlay"
      width={1}
      height={1}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 1_900_000 }}
    >
      {snapRect && (
        <rect
          data-testid="connection-snap"
          x={snapRect.x}
          y={snapRect.y}
          width={snapRect.w}
          height={snapRect.h}
          rx={6}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2 / zoom}
        />
      )}
      {snapRect && (
        <rect
          x={snapRect.x - 3 / zoom}
          y={snapRect.y - 3 / zoom}
          width={snapRect.w + 6 / zoom}
          height={snapRect.h + 6 / zoom}
          rx={8}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.22}
          strokeWidth={6 / zoom}
        />
      )}
      {preview && fixedPt && (
        <g data-testid="connection-preview">
          <path d={preview.d} fill="none" stroke="var(--primary)" strokeWidth={Math.max(STROKE, 1.5 / zoom)} strokeDasharray={`${6 / zoom} ${5 / zoom}`} />
          <circle cx={fixedPt.x} cy={fixedPt.y} r={r * 0.8} fill="var(--primary)" />
        </g>
      )}
      {c && g && selId && !drawing && (
        <g data-testid="connection-handles">
          <circle
            data-testid="bend-handle"
            cx={g.mid.x}
            cy={g.mid.y}
            r={r}
            fill="var(--primary)"
            stroke="var(--card-bg)"
            strokeWidth={sw}
            style={{ pointerEvents: 'all', cursor: 'grab' }}
            onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) startBend(e, selId, g.a, g.b) }}
          />
          {(['from', 'to'] as const).map((which) => {
            const p = which === 'from' ? g.a : g.b
            return (
              <circle
                key={which}
                data-testid={`end-handle-${which}`}
                cx={p.x}
                cy={p.y}
                r={r}
                {...handleStyle}
                strokeWidth={sw}
                style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) startMoveEnd(e, selId, which) }}
              />
            )
          })}
        </g>
      )}
    </svg>
  )
})
