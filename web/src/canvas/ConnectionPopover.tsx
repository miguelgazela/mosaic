import { ArrowLeft, ArrowLeftRight, ArrowRight, Minus, Trash2 } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { IconButton } from '../ui'
import { deleteSelection, updateConnection } from './actions'
import { useShallow } from 'zustand/react/shallow'
import { LINE_COLORS, lineGeometry, resolveEnd, type Head } from './connections'
import { endRect } from './connectionLayout'
import { worldToScreen } from './geometry'
import { useBoard } from './store'

/** Radio group: arrow keys move inside it (and select), Tab leaves it. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    const items = [...ref.current!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const next = items[(i + dir + items.length) % items.length]
    next.focus()
    next.click()
  }
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="flex items-center gap-0.5 rounded-[var(--radius-ui)] bg-[var(--fill-hover)] p-0.5" onKeyDown={onKeyDown}>
      {children}
    </div>
  )
}

function Radio({ label, checked, onSelect, children }: { label: string; checked: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      className={
        'flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text)] transition-colors duration-[var(--dur-hover)] ' +
        'focus-visible:shadow-[var(--ring-focus)] focus-visible:outline-none ' +
        (checked ? 'bg-[var(--card-bg)] shadow-[var(--shadow-card)]' : 'hover:bg-[var(--fill-pressed)]')
      }
    >
      {children}
    </button>
  )
}

const Straight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
)
const Curved = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 13C3 6 9 10 13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
)
const Dashed = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 8h2.5M6.8 8h2.5M11.5 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
)

const HEADS: { value: Head; label: string; icon: ReactNode }[] = [
  { value: 'none', label: 'No arrowheads', icon: <Minus size={16} /> },
  { value: 'start', label: 'Arrowhead at start', icon: <ArrowLeft size={16} /> },
  { value: 'end', label: 'Arrowhead at end', icon: <ArrowRight size={16} /> },
  { value: 'both', label: 'Arrowheads at both ends', icon: <ArrowLeftRight size={16} /> },
]


function LabelEditor({ id, initial }: { id: string; initial: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const finish = (value: string | null) => {
    const s = useBoard.getState()
    s.setEditingConn(null)
    if (value !== null && value.trim() !== initial) updateConnection(id, { label: value.trim() || null }, 'Label line')
  }
  return (
    <input
      ref={ref}
      aria-label="Line label"
      defaultValue={initial}
      placeholder="Label"
      maxLength={80}
      className="h-8 w-[140px] rounded-[var(--radius-ui)] border border-[var(--primary)] bg-[var(--card-bg)] px-2 text-[length:var(--text-sm)] outline-none shadow-[var(--ring-focus)]"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(e.currentTarget.value)
        else if (e.key === 'Escape') finish(null)
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  )
}

/** Line style popover: opens 12 px above the selected line's midpoint, constant size at every zoom. */
export function ConnectionPopover() {
  const id = useBoard((s) => s.selectedConn)
  const c = useBoard((s) => (s.selectedConn ? s.connections[s.selectedConn] : undefined))
  const editing = useBoard((s) => s.editingConn === s.selectedConn && s.selectedConn !== null)
  const hidden = useBoard((s) => s.dragging || s.drawing !== null || s.panning)
  const vp = useBoard((s) => s.viewport)
  const mid = useBoard(
    useShallow((s) => {
      const conn = s.selectedConn ? s.connections[s.selectedConn] : undefined
      if (!conn) return null
      const a = resolveEnd(conn.from, (i) => endRect(s, i))
      const b = resolveEnd(conn.to, (i) => endRect(s, i))
      return a && b ? lineGeometry(a, b, conn.style).mid : null
    }),
  )
  if (!id || !c || !mid || hidden) return null
  const p = worldToScreen(vp, mid)
  const st = c.style
  const set = (patch: Partial<typeof st>, label: string) => updateConnection(id, { style: { ...st, ...patch } }, label)
  return (
    <div
      data-testid="connection-popover"
      role="toolbar"
      aria-label="Line style"
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-[var(--radius-menu)] border border-[var(--chrome-border)] bg-[var(--card-bg)] p-1.5"
      style={{ left: p.x, top: Math.max(p.y - 12, 56), boxShadow: 'var(--shadow-menu)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Group label="Curve">
        <Radio label="Straight" checked={st.curve === 'straight'} onSelect={() => set({ curve: 'straight' }, 'Straight line')}><Straight /></Radio>
        <Radio label="Curved" checked={st.curve === 'curved'} onSelect={() => set({ curve: 'curved' }, 'Curved line')}><Curved /></Radio>
      </Group>
      <Group label="Dash">
        <Radio label="Solid" checked={!st.dash} onSelect={() => set({ dash: false }, 'Solid line')}><Minus size={16} /></Radio>
        <Radio label="Dashed" checked={st.dash} onSelect={() => set({ dash: true }, 'Dashed line')}><Dashed /></Radio>
      </Group>
      <Group label="Arrowheads">
        {HEADS.map((h) => (
          <Radio key={h.value} label={h.label} checked={st.head === h.value} onSelect={() => set({ head: h.value }, 'Arrowheads')}>{h.icon}</Radio>
        ))}
      </Group>
      <Group label="Colour">
        {LINE_COLORS.map((col) => {
          const checked = st.color.toLowerCase() === col.hex.toLowerCase()
          return (
            <button
              key={col.hex}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={col.name}
              title={col.name}
              tabIndex={checked ? 0 : -1}
              onClick={() => set({ color: col.hex }, 'Line colour')}
              className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:shadow-[var(--ring-focus)] focus-visible:outline-none"
            >
              <span
                className="h-[22px] w-[22px] rounded-full"
                style={{ background: col.hex, boxShadow: checked ? '0 0 0 2px var(--card-bg), 0 0 0 4px var(--primary)' : undefined }}
              />
            </button>
          )
        })}
      </Group>
      <span className="h-5 w-px bg-[var(--divider)]" aria-hidden />
      {editing ? (
        <LabelEditor id={id} initial={c.label ?? ''} />
      ) : (
        <button
          type="button"
          className="h-8 rounded-[var(--radius-ui)] px-2.5 text-[length:var(--text-sm)] font-medium hover:bg-[var(--fill-hover)] focus-visible:shadow-[var(--ring-focus)] focus-visible:outline-none"
          onClick={() => useBoard.getState().setEditingConn(id)}
        >
          {c.label ? 'Edit label' : 'Label'}
        </button>
      )}
      <IconButton aria-label="Delete line" className="!h-8 !w-8 !text-[var(--danger)]" onClick={deleteSelection}><Trash2 size={16} /></IconButton>
    </div>
  )
}
