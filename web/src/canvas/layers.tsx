import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CardShell } from './CardShell'
import { boundsOf, worldToScreen } from './geometry'
import { elementRect, selectedIds, useBoard } from './store'

const CardLayer = memo(function CardLayer() {
  const ids = useBoard(useShallow((s) => Object.keys(s.elements).filter((id) => !s.elements[id].parentId)))
  return (
    <>
      {ids.map((id) => (
        <CardShell key={id} id={id} />
      ))}
    </>
  )
})

/** Bounding box around a multi-selection (world space). */
function SelectionBox() {
  const box = useBoard(
    useShallow((s) => {
      const ids = selectedIds(s)
      if (ids.length < 2) return null
      const b = boundsOf(ids.map((id) => elementRect(s, id)))
      return b ? [b.x, b.y, b.w, b.h] : null
    }),
  )
  if (!box) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: box[0] - 6,
        top: box[1] - 6,
        width: box[2] + 12,
        height: box[3] + 12,
        border: 'calc(1.5px / var(--zoom)) dashed var(--primary)',
        pointerEvents: 'none',
        zIndex: 2_000_000,
      }}
    />
  )
}

/** FR-53: thin primary lines where a dragged card aligns with another. */
function GuidesLayer() {
  const guides = useBoard((s) => s.guides)
  if (!guides.length) return null
  return (
    <>
      {guides.map((g) => (
        <div
          key={`${g.axis}${g.pos}`}
          data-testid="snap-guide"
          style={{
            position: 'absolute',
            background: 'var(--primary)',
            pointerEvents: 'none',
            zIndex: 2_000_001,
            ...(g.axis === 'v'
              ? { left: g.pos, top: g.from - 16, width: 'calc(1px / var(--zoom))', height: g.to - g.from + 32 }
              : { top: g.pos, left: g.from - 16, height: 'calc(1px / var(--zoom))', width: g.to - g.from + 32 }),
          }}
        />
      ))}
    </>
  )
}

export function WorldLayer() {
  const vp = useBoard((s) => s.viewport)
  return (
    <div
      data-testid="world"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        ['--zoom' as string]: vp.zoom,
      }}
    >
      <CardLayer />
      <SelectionBox />
      <GuidesLayer />
    </div>
  )
}

export function GridBackground() {
  const vp = useBoard((s) => s.viewport)
  const cell = 24 * vp.zoom
  if (vp.zoom < 0.5) return null
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1.2px)',
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
      }}
    />
  )
}

export function MarqueeOverlay() {
  const m = useBoard((s) => s.marquee)
  const vp = useBoard((s) => s.viewport)
  if (!m) return null
  const tl = worldToScreen(vp, m)
  return (
    <div
      data-testid="marquee"
      className="pointer-events-none absolute border border-[var(--primary)]"
      style={{ background: 'var(--marquee-fill)', left: tl.x, top: tl.y, width: m.w * vp.zoom, height: m.h * vp.zoom }}
    />
  )
}
