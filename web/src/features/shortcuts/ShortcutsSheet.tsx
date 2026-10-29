import { useEffect, type ReactNode } from 'react'
import { Dialog } from '../../ui'
import { useShortcutsSheet } from './store'

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const Key = ({ children, label }: { children: ReactNode; label?: string }) => (
  <kbd aria-label={label} className="inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--fill-hover)] px-1.5 text-[length:var(--text-caption)] font-medium text-[var(--text)]">{children}</kbd>
)
const Hint = ({ children }: { children: ReactNode }) => <span className="text-[length:var(--text-caption)] text-[var(--text-muted)]">{children}</span>

type Row = { label: string; keys: ReactNode }
const keys = (...k: string[]) => <span className="flex items-center gap-1">{k.map((x) => <Key key={x}>{x}</Key>)}</span>
const combo = (...parts: string[][]) => <span className="flex items-center gap-2.5">{parts.map((p, i) => <span key={i} className="flex gap-1">{p.map((x) => <Key key={x}>{x}</Key>)}</span>)}</span>
const typed = (k: string, then = 'space') => <span className="flex items-center gap-1.5"><Hint>type</Hint><Key>{k}</Key><Hint>then {then}</Hint></span>

const SECTIONS: { title: string; col: 0 | 1; rows: Row[] }[] = [
  { title: 'Canvas', col: 0, rows: [
    { label: 'Pan', keys: <span className="flex items-center gap-1.5"><Key>Space</Key><Hint>+ drag</Hint></span> },
    { label: 'Zoom in / out', keys: keys('+', '−') },
    { label: 'Fit to content', keys: keys('⇧', '1') },
    { label: 'Zoom to 100%', keys: keys('0') },
    { label: 'Select / hand / line tool', keys: keys('V', 'H', 'L') },
    { label: 'Undo / redo', keys: combo([mod, 'Z'], ['⇧', mod, 'Z']) },
    { label: 'Select all', keys: keys(mod, 'A') },
  ] },
  { title: 'Text', col: 0, rows: [
    { label: 'Bold / italic / underline', keys: combo([mod, 'B'], [mod, 'I'], [mod, 'U']) },
    { label: 'Heading', keys: typed('#') },
    { label: 'Bulleted list', keys: typed('-') },
    { label: 'Checklist item', keys: typed('[]') },
  ] },
  { title: 'Cards', col: 1, rows: [
    { label: 'Add note / to-do / column / board', keys: keys('N', 'T', 'C', 'B') },
    { label: 'Move selection', keys: keys('←', '↑', '↓', '→') },
    { label: 'Move 10× further', keys: <span className="flex items-center gap-1.5"><Key>⇧</Key><Hint>+ arrow</Hint></span> },
    { label: 'Duplicate', keys: keys(mod, 'D') },
    { label: 'Delete', keys: keys('⌫') },
    { label: 'Bring to front / send to back', keys: keys(']', '[') },
    { label: 'Drag without snapping', keys: <span className="flex items-center gap-1.5"><Hint>hold</Hint><Key>⌥</Key></span> },
  ] },
  { title: 'Navigation', col: 1, rows: [
    { label: 'Search', keys: keys(mod, 'K') },
    { label: 'Open selected board', keys: keys('↵') },
    { label: 'Close, or clear selection', keys: keys('Esc') },
    { label: 'Show this sheet', keys: keys('?') },
  ] },
]

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={760}>
      <div className="grid gap-x-10 gap-y-6 pt-2 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-6">
            {SECTIONS.filter((s) => s.col === col).map((s) => (
              <section key={s.title} aria-labelledby={`sc-${s.title}`}>
                <h3 id={`sc-${s.title}`} className="mb-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-muted)]">{s.title}</h3>
                <ul className="flex flex-col">
                  {s.rows.map((r) => (
                    <li key={r.label} className="flex min-h-[34px] items-center justify-between gap-4 text-[length:var(--text-card)]">
                      <span>{r.label}</span>{r.keys}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  )
}

/** Mounted once in App: opens on "?" when nothing is being typed into. */
export function ShortcutsHost() {
  const open = useShortcutsSheet((s) => s.open)
  const setOpen = useShortcutsSheet((s) => s.setOpen)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [setOpen])
  return open ? <ShortcutsSheet onClose={() => setOpen(false)} /> : null
}
