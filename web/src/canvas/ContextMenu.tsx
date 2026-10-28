import { useEffect } from 'react'
import { addCard, deleteSelection, duplicateSelection, pasteClipboard, reorder, selectAll, setColor } from './actions'
import { CARD_COLOR_KEYS, colorVar } from './colors'
import type { Point } from './geometry'

export interface MenuState {
  x: number
  y: number
  world: Point
  onCard: boolean
}

const item = 'block w-full rounded-md px-3 py-1.5 text-left text-[length:var(--text-sm)] hover:bg-black/5'

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
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

  return (
    <div
      role="menu"
      className="fixed z-[3000000] w-48 rounded-xl border bg-white p-1"
      style={{ left: menu.x, top: menu.y, boxShadow: 'var(--shadow-card-hover)', borderColor: 'var(--border)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.onCard ? (
        <>
          <div className="flex flex-wrap gap-1 px-3 py-2">
            {CARD_COLOR_KEYS.map((k) => (
              <button
                key={k}
                aria-label={`Colour ${k}`}
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: colorVar(k) }}
                onClick={run(() => setColor(k))}
              />
            ))}
            <button aria-label="No colour" className="h-4 w-4 rounded-full border border-black/20 bg-white" onClick={run(() => setColor(null))} />
          </div>
          <button role="menuitem" className={item} onClick={run(duplicateSelection)}>Duplicate</button>
          <button role="menuitem" className={item} onClick={run(() => reorder(true))}>Bring to front</button>
          <button role="menuitem" className={item} onClick={run(() => reorder(false))}>Send to back</button>
          <button role="menuitem" className={`${item} text-red-600`} onClick={run(deleteSelection)}>Delete</button>
        </>
      ) : (
        <>
          <button role="menuitem" className={item} onClick={run(() => addCard('debug', menu.world))}>Add debug card here</button>
          <button
            role="menuitem"
            className={item}
            onClick={run(() => {
              navigator.clipboard?.readText().then((t) => pasteClipboard(t)).catch(() => pasteClipboard(null))
            })}
          >
            Paste
          </button>
          <button role="menuitem" className={item} onClick={run(selectAll)}>Select all</button>
        </>
      )}
    </div>
  )
}
