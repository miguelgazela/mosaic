import { useEffect, useState } from 'react'
import { loadSkeleton } from './skeleton'

const FALLBACK = [
  { x: 96, y: 96, w: 96, h: 100 }, { x: 212, y: 96, w: 200, h: 130 },
  { x: 432, y: 96, w: 180, h: 140 }, { x: 212, y: 246, w: 200, h: 70 },
]

/** Cards at their last-seen positions; the spinner pill appears only after 400 ms. */
export function BoardSkeleton({ boardId }: { boardId: string }) {
  const [snap] = useState(() => loadSkeleton(boardId))
  const [pill, setPill] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPill(true), 400)
    return () => clearTimeout(t)
  }, [])
  const vp = snap?.viewport ?? { x: 0, y: 0, zoom: 1 }
  const rects = snap?.rects.length ? snap.rects : FALLBACK
  return (
    <div data-testid="board-skeleton" className="relative h-full w-full overflow-hidden bg-[var(--canvas-bg)]" aria-busy="true">
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {rects.map((r, i) => (
          <div key={i} className="absolute rounded-lg bg-[var(--card-bg)] opacity-60" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />
        ))}
      </div>
      {pill && (
        <div role="status" className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] shadow-md">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5" /></svg>
          Opening {snap?.title ?? 'board'}…
        </div>
      )}
    </div>
  )
}
