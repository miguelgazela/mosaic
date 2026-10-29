import { Minus, Plus, Redo2, Undo2 } from 'lucide-react'
import { MenuDivider, MenuItem, MenuPanel } from '../ui'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui'
import { useBoard } from './store'
import { fitToContent, zoomBy, zoomTo } from './viewport'

const LEVELS = [0.25, 0.5, 1, 2]
const btn =
  'flex h-8 items-center justify-center rounded-[var(--radius-ui)] text-[length:var(--text-sm)] font-medium hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)]'

/** Undo / redo for people who don't reach for the keyboard (⌘Z / ⇧⌘Z). */
export function UndoControls() {
  const canUndo = useBoard((s) => s.canUndo)
  const canRedo = useBoard((s) => s.canRedo)
  const undo = useBoard((s) => s.undo)
  const redo = useBoard((s) => s.redo)
  return (
    <div
      className="absolute bottom-4 right-[188px] flex items-center gap-0.5 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--card-bg)] p-1"
      style={{ boxShadow: 'var(--shadow-card)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip label="Undo" shortcut="⌘Z" side="top">
        <button className={`${btn} w-8 disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent`} aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button>
      </Tooltip>
      <Tooltip label="Redo" shortcut="⇧⌘Z" side="top">
        <button className={`${btn} w-8 disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent`} aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button>
      </Tooltip>
    </div>
  )
}

export function ZoomControls() {
  const zoom = useBoard((s) => s.viewport.zoom)
  const pct = Math.round(zoom * 100)
  return (
    <div
      className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--card-bg)] p-1"
      style={{ boxShadow: 'var(--shadow-card)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className={`${btn} w-8`} aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}><Minus size={16} /></button>
      <Popover
        up
        align="right"
        trigger={({ toggle }) => (
          <button className={`${btn} w-14`} aria-label="Zoom level" aria-haspopup="menu" data-testid="zoom-level" onClick={toggle}>
            {pct}%
          </button>
        )}
      >
        {(close) => (
          <MenuPanel className="w-[192px]" onClose={close} label="Zoom">
            {LEVELS.map((l) => (
              <MenuItem key={l} checked={pct === l * 100} onClick={() => { zoomTo(l); close() }}>{l * 100}%</MenuItem>
            ))}
            <MenuDivider />
            <MenuItem shortcut="⇧1" onClick={() => { fitToContent(); close() }}>Fit to content</MenuItem>
          </MenuPanel>
        )}
      </Popover>
      <button className={`${btn} w-8`} aria-label="Zoom in" onClick={() => zoomBy(1.25)}><Plus size={16} /></button>
    </div>
  )
}
