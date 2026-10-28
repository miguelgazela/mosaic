import { useState } from 'react'
import { useBoard } from './store'
import { fitToContent, zoomBy, zoomTo } from './viewport'

const LEVELS = [0.25, 0.5, 1, 2, 4]
const btn = 'h-8 min-w-8 rounded-[var(--radius-ui)] px-2 text-[length:var(--text-sm)] hover:bg-black/5'

export function ZoomControls() {
  const zoom = useBoard((s) => s.viewport.zoom)
  const canUndo = useBoard((s) => s.canUndo)
  const canRedo = useBoard((s) => s.canRedo)
  const [open, setOpen] = useState(false)
  return (
    <div
      className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border bg-white p-1"
      style={{ boxShadow: 'var(--shadow-card)', borderColor: 'var(--border)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className={btn} disabled={!canUndo} onClick={() => useBoard.getState().undo()} title="Undo (⌘Z)">↶</button>
      <button className={btn} disabled={!canRedo} onClick={() => useBoard.getState().redo()} title="Redo (⇧⌘Z)">↷</button>
      <span className="mx-1 h-5 w-px bg-black/10" />
      <button className={btn} aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
      <div className="relative">
        <button className={btn} aria-label="Zoom level" data-testid="zoom-level" onClick={() => setOpen((o) => !o)}>
          {Math.round(zoom * 100)}%
        </button>
        {open && (
          <div
            className="absolute bottom-10 right-0 w-36 rounded-xl border bg-white p-1"
            style={{ boxShadow: 'var(--shadow-card-hover)', borderColor: 'var(--border)' }}
          >
            {LEVELS.map((l) => (
              <button key={l} className={`${btn} block w-full text-left`} onClick={() => { zoomTo(l); setOpen(false) }}>
                {l * 100}%
              </button>
            ))}
            <button className={`${btn} block w-full text-left`} onClick={() => { fitToContent(); setOpen(false) }}>
              Fit to content
            </button>
          </div>
        )}
      </div>
      <button className={btn} aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
    </div>
  )
}
