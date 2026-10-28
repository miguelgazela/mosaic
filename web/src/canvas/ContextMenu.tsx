import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Copy, Palette, Trash2 } from 'lucide-react'
import { listCards } from '../cards/registry'
import { MenuDivider, MenuItem, MenuPanel } from '../ui'
import { addCard, deleteSelection, duplicateSelection, pasteClipboard, reorder, selectAll, setColor } from './actions'
import { ColorSwatches } from './ColorSwatches'
import type { Point } from './geometry'
import { useBoard } from './store'
import { fitToContent } from './viewport'

export interface MenuState {
  x: number
  y: number
  world: Point
  onCard: boolean
}

const MENU_W = 240

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const [colourOpen, setColourOpen] = useState(false)
  useEffect(() => {
    const close = () => onClose()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', close)
    }
  }, [onClose])

  const run = (fn: () => void) => () => { fn(); onClose() }
  const left = Math.min(menu.x, window.innerWidth - MENU_W - 8)
  const top = Math.min(menu.y, window.innerHeight - (menu.onCard ? 260 : 240))
  const colour = useBoard((s) => {
    const cs = new Set(Object.keys(s.selected).map((id) => s.elements[id]?.color ?? null))
    return cs.size === 1 ? [...cs][0] : 'mixed'
  })
  const adders = listCards().filter((c) => c.shortcut)

  return (
    <MenuPanel
      className="fixed z-[3000000]"
      style={{ left, top, width: MENU_W }}
      onClose={onClose}
      label={menu.onCard ? 'Card' : 'Canvas'}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <>
        {menu.onCard ? (
          <>
            <div className="relative">
              <MenuItem icon={<Palette size={15} />} submenu onClick={() => setColourOpen((o) => !o)}>Colour</MenuItem>
              {colourOpen && (
                <div
                  className="absolute left-full top-0 ml-1 w-[176px] rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-1"
                  style={{ boxShadow: 'var(--shadow-menu)' }}
                >
                  <ColorSwatches value={colour} onPick={(k) => { setColor(k); onClose() }} />
                </div>
              )}
            </div>
            <MenuItem icon={<Copy size={15} />} shortcut="⌘D" onClick={run(duplicateSelection)}>Duplicate</MenuItem>
            <MenuDivider />
            <MenuItem icon={<ArrowUpToLine size={15} />} shortcut="]" onClick={run(() => reorder(true))}>Bring to front</MenuItem>
            <MenuItem icon={<ArrowDownToLine size={15} />} shortcut="[" onClick={run(() => reorder(false))}>Send to back</MenuItem>
            <MenuDivider />
            <MenuItem icon={<Trash2 size={15} />} destructive shortcut="⌫" onClick={run(deleteSelection)}>Delete</MenuItem>
          </>
        ) : (
          <>
            {adders.map((c) => {
              const Icon = c.toolbar?.icon
              return (
                <MenuItem key={c.type} icon={Icon && <Icon size={15} />} shortcut={c.shortcut!.toUpperCase()} onClick={run(() => addCard(c.type, menu.world))}>
                  Add {c.label.toLowerCase()} here
                </MenuItem>
              )
            })}
            {adders.length > 0 && <MenuDivider />}
            <MenuItem
              shortcut="⌘V"
              onClick={run(() => {
                navigator.clipboard?.readText().then((t) => pasteClipboard(t)).catch(() => pasteClipboard(null))
              })}
            >
              Paste
            </MenuItem>
            <MenuItem shortcut="⌘A" onClick={run(selectAll)}>Select all</MenuItem>
            <MenuItem shortcut="⇧1" onClick={run(fitToContent)}>Fit to content</MenuItem>
          </>
        )}
      </>
    </MenuPanel>
  )
}
