import { Minus, Plus } from 'lucide-react'
import { MenuDivider, MenuItem, MenuPanel } from '../ui'
import { Popover } from '../ui/Popover'
import { useBoard } from './store'
import { fitToContent, zoomBy, zoomTo } from './viewport'

const LEVELS = [0.25, 0.5, 1, 2]
const btn =
  'flex h-8 items-center justify-center rounded-[var(--radius-ui)] text-[length:var(--text-sm)] font-medium hover:bg-[var(--fill-hover)] active:bg-[var(--fill-pressed)]'

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
