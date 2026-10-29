import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Copy, FolderInput, Palette, Trash2, Columns3 } from 'lucide-react'
import { getCard, listCards } from '../cards/registry'
import { MenuDivider, MenuItem, MenuPanel } from '../ui'
import { openMoveDialog } from '../features/boards/MoveToDialog'
import { addCard, deleteSelection, duplicateSelection, moveSelectionInto, pasteClipboard, pasteData, reorder, selectAll, setColor } from './actions'
import { toPasteData } from './paste'
import { ColorSwatches } from './ColorSwatches'
import type { Point } from './geometry'
import { selectedIds, useBoard } from './store'
import { fitToContent } from './viewport'

export interface MenuState {
  x: number
  y: number
  world: Point
  onCard: boolean
}

const MENU_W = 240

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const [panel, setPanel] = useState<string | null>(null)
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
  // The menu is a snapshot of the selection at open time (it closes on any pointer-down).
  const [card] = useState(() => {
    const s = useBoard.getState()
    const ids = selectedIds(s)
    const els = ids.map((id) => s.elements[id]).filter(Boolean)
    const single = els.length === 1 ? els[0] : null
    const colorable = els.some((e) => getCard(e.type)?.colorable !== false)
    // Cards that can take the selection into themselves (columns; board cards send it to another board instead).
    const targets = els.length
      ? Object.values(s.elements)
          .filter((t) => { const dt = getCard(t.type)?.dropTarget; return !ids.includes(t.id) && dt && !dt.moveTo && dt.accepts(t, els) })
          .map((t) => ({ id: t.id, label: getCard(t.type)!.toPlainText(t) || 'Untitled column' }))
      : []
    return { singleId: single?.id ?? null, singleType: single?.type ?? null, colorable, targets }
  })
  // The card can be gone while the menu is open (deleted in another tab, undo): then it has no extra items.
  const single = useBoard((s) => (card.singleId ? s.elements[card.singleId] : undefined))
  const extra = single && card.singleType ? getCard(card.singleType)?.menuItems?.(single) ?? [] : []
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
            {extra.map((it) => (
              <div key={it.id} className="relative">
                <MenuItem
                  icon={it.icon && <it.icon size={15} />}
                  submenu={!!it.panel}
                  onClick={() => { if (it.panel) setPanel(panel === it.id ? null : it.id); else { it.run?.(); onClose() } }}
                >
                  {it.label}
                </MenuItem>
                {it.panel && panel === it.id && <SidePanel auto>{it.panel(onClose)}</SidePanel>}
              </div>
            ))}
            {card.colorable && (
              <div className="relative">
                <MenuItem icon={<Palette size={15} />} submenu onClick={() => setPanel(panel === 'colour' ? null : 'colour')}>Colour</MenuItem>
                {panel === 'colour' && (
                  <SidePanel>
                    <ColorSwatches value={colour} onPick={(k) => { setColor(k); onClose() }} />
                  </SidePanel>
                )}
              </div>
            )}
            <MenuItem icon={<FolderInput size={15} />} onClick={run(openMoveDialog)}>Move to…</MenuItem>
            {card.targets.length > 0 && (
              <div className="relative">
                <MenuItem icon={<Columns3 size={15} />} submenu onClick={() => setPanel(panel === 'column' ? null : 'column')}>Move into column…</MenuItem>
                {panel === 'column' && (
                  <SidePanel wide>
                    <div role="menu" aria-label="Move into column" className="flex max-h-[240px] flex-col overflow-auto">
                      {card.targets.map((t) => (
                        <MenuItem key={t.id} onClick={run(() => moveSelectionInto(t.id))}>{t.label}</MenuItem>
                      ))}
                    </div>
                  </SidePanel>
                )}
              </div>
            )}
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
                navigator.clipboard?.readText().then((t) => pasteClipboard(t) || pasteData(toPasteData(t), menu.world)).catch(() => pasteClipboard(null))
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

function SidePanel({ children, wide, auto }: { children: React.ReactNode; wide?: boolean; auto?: boolean }) {
  return (
    <div
      className={`absolute left-full top-0 ml-1 rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-1 ${auto ? 'w-max' : wide ? 'w-[220px]' : 'w-[200px]'}`}
      style={{ boxShadow: 'var(--shadow-menu)' }}
    >
      {children}
    </div>
  )
}
