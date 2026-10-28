import { Copy, Layers, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { getCard } from '../cards/registry'
import { IconButton, Tooltip } from '../ui'
import { Popover } from '../ui/Popover'
import { MenuPanel } from '../ui'
import { deleteSelection, duplicateSelection, reorder, setColor } from './actions'
import { ColorSwatches } from './ColorSwatches'
import { colorVar } from './colors'
import { boundsOf, worldToScreen } from './geometry'
import { elementRect, selectedIds, useBoard } from './store'

const Sep = () => <span className="mx-0.5 h-5 w-px bg-[var(--divider)]" aria-hidden />

/** FR-52: floats above the selection at constant size. Move-to-board joins in P8 (hidden until then). */
export function SelectionToolbar() {
  const info = useBoard(
    useShallow((s) => {
      if (s.dragging || s.marquee || s.panning || s.editing) return null
      const ids = selectedIds(s)
      if (!ids.length) return null
      const b = boundsOf(ids.map((id) => elementRect(s, id)))!
      const colours = new Set(ids.map((id) => s.elements[id].color))
      const colorable = ids.some((id) => getCard(s.elements[id].type)?.colorable !== false)
      return { count: ids.length, x: b.x, y: b.y, w: b.w, colour: colours.size === 1 ? [...colours][0] : 'mixed', colorable }
    }),
  )
  const vp = useBoard((s) => s.viewport)
  if (!info) return null
  const top = worldToScreen(vp, { x: info.x + info.w / 2, y: info.y })
  const mixed = info.colour === 'mixed'
  return (
    <div
      data-testid="selection-toolbar"
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--card-bg)] p-1"
      style={{ left: top.x, top: Math.max(top.y - 12, 56), boxShadow: 'var(--shadow-menu)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {info.count > 1 && <span className="px-2 text-[length:var(--text-sm)] font-semibold">{info.count} cards</span>}
      {info.count > 1 && <Sep />}
      {info.colorable && (
        <>
          <Popover
            trigger={({ toggle }) => (
              <Tooltip label="Colour" side="top">
                <IconButton aria-label="Colour" className="!h-8 !w-8" onClick={toggle}>
                  <span
                    className="h-[18px] w-[18px] rounded-full border border-[var(--border-strong)]"
                    style={{ background: mixed ? 'conic-gradient(var(--card-color-1) 0 50%, var(--card-color-5) 0)' : (colorVar(info.colour) ?? '#fff') }}
                  />
                </IconButton>
              </Tooltip>
            )}
          >
            {(close) => (
              <MenuPanel className="w-[208px]" onClose={close}>
                <ColorSwatches value={info.colour} onPick={(k) => { setColor(k); close() }} />
              </MenuPanel>
            )}
          </Popover>
          <Sep />
        </>
      )}
      <Tooltip label="Duplicate" shortcut="⌘D" side="top">
        <IconButton aria-label="Duplicate" className="!h-8 !w-8" onClick={duplicateSelection}><Copy size={16} /></IconButton>
      </Tooltip>
      <Tooltip label="Bring to front" shortcut="]" side="top">
        <IconButton aria-label="Bring to front" className="!h-8 !w-8" onClick={() => reorder(true)}><Layers size={16} /></IconButton>
      </Tooltip>
      <Sep />
      <Tooltip label="Delete" shortcut="⌫" side="top">
        <IconButton aria-label="Delete" className="!h-8 !w-8 !text-[var(--danger)]" onClick={deleteSelection}><Trash2 size={16} /></IconButton>
      </Tooltip>
    </div>
  )
}
