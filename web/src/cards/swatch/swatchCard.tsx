import { useEffect, useRef, useState } from 'react'
import { Check, Droplet, Pencil } from 'lucide-react'
import { patchCmd } from '../../canvas/commands'
import { useBoard } from '../../canvas/store'
import { toast } from '../../ui'
import { normalizeHex } from './hex'
import type { CardDefinition, CardProps } from '../types'

const hexOf = (c: Record<string, unknown>): string => normalizeHex(typeof c.hex === 'string' ? c.hex : '') ?? '#D98F72'
const nameOf = (c: Record<string, unknown>): string => (typeof c.name === 'string' ? c.name : '')

function SwatchCard({ element: el }: CardProps) {
  const hex = hexOf(el.content)
  const name = nameOf(el.content)
  const editing = useBoard((s) => s.editing === el.id)
  const [copied, setCopied] = useState(false)
  const down = useRef<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
    } catch {
      toast('Couldn’t copy. Select the hex and copy it by hand.')
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-testid="swatch-card"
      className="relative cursor-pointer rounded-[var(--radius-card)] bg-[var(--card-bg)]"
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onClick={(e) => {
        const d = down.current
        if (editing || e.shiftKey || e.metaKey || e.ctrlKey) return
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
        void copy()
      }}
      onDoubleClick={() => useBoard.getState().setEditing(el.id)}
    >
      <div className="relative flex h-[88px] items-center justify-center rounded-t-[var(--radius-card)]" style={{ background: hex }}>
        {copied && (
          <span role="status" className="flex items-center gap-1 rounded-full bg-[var(--card-bg)] px-2.5 py-0.5 text-[length:var(--text-caption)] font-semibold text-[var(--success)]">
            <Check size={12} aria-hidden /> Copied
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <div className="truncate text-[length:var(--text-caption)] font-bold leading-[var(--leading-caption)]">{name || hex}</div>
        <div className="truncate text-[length:var(--text-caption)] leading-[var(--leading-caption)] text-[var(--text-muted)]">{name ? hex : 'No name'}</div>
      </div>
      {editing && <SwatchEditor id={el.id} hex={hex} name={name} />}
    </div>
  )
}

function SwatchEditor({ id, hex, name }: { id: string; hex: string; name: string }) {
  const [h, setH] = useState(hex)
  const [n, setN] = useState(name)
  const draft = useRef({ h, n })
  draft.current = { h, n }
  const box = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  const commit = () => {
    if (done.current) return
    done.current = true
    const next = normalizeHex(draft.current.h) ?? hex
    const nm = draft.current.n.trim()
    const s = useBoard.getState()
    const el = s.elements[id]
    if (el && (next !== hex || nm !== name)) {
      const content = { ...el.content, hex: next, name: nm || undefined }
      s.exec(patchCmd('Edit colour', [{ id, before: { content: el.content }, after: { content } }]))
    }
    s.setEditing(null)
  }
  // Closing from outside (clicking the canvas) saves too.
  useEffect(() => {
    const unsub = useBoard.subscribe((s) => { if (s.editing !== id) commit() })
    return () => { unsub() }
  }, [id])
  useEffect(() => { box.current?.querySelector<HTMLInputElement>('input[type=text]')?.focus() }, [])

  const valid = normalizeHex(h) !== null
  return (
    <div
      ref={box}
      data-nodrag
      role="dialog"
      aria-label="Edit colour"
      className="absolute left-0 top-full z-20 mt-2 flex w-[200px] cursor-default flex-col gap-2 rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-2.5"
      style={{ boxShadow: 'var(--shadow-menu)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' || e.key === 'Escape') commit()
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick colour"
          value={normalizeHex(h)?.toLowerCase() ?? '#000000'}
          onChange={(e) => setH(e.target.value.toUpperCase())}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-transparent p-0"
        />
        <input
          type="text"
          aria-label="Hex"
          aria-invalid={!valid}
          value={h}
          maxLength={7}
          onChange={(e) => setH(e.target.value)}
          className={`h-8 min-w-0 flex-1 rounded-[var(--radius-ui)] border px-2 font-mono text-[length:var(--text-sm)] outline-none focus:border-[var(--primary)] ${valid ? 'border-[var(--border-strong)]' : 'border-[var(--danger)]'}`}
        />
      </div>
      <input
        type="text"
        aria-label="Name"
        placeholder="Name (optional)"
        value={n}
        maxLength={40}
        onChange={(e) => setN(e.target.value)}
        className="h-8 rounded-[var(--radius-ui)] border border-[var(--border-strong)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--primary)]"
      />
      <button
        className="h-8 rounded-[var(--radius-ui)] bg-[var(--primary)] text-[length:var(--text-sm)] font-semibold text-white hover:bg-[var(--primary-hover)]"
        onClick={commit}
      >
        Done
      </button>
    </div>
  )
}

export const swatchCard: CardDefinition = {
  type: 'swatch',
  label: 'Colour',
  Component: SwatchCard,
  defaultSize: { width: 120, height: null },
  resize: 'none',
  minWidth: 120,
  minHeight: 120,
  colorable: false,
  editOnCreate: true,
  toolbar: { label: 'Colour', icon: Droplet },
  defaultContent: () => ({ hex: '#D98F72' }),
  menuItems: (el) => [{ id: 'edit', label: 'Edit colour', icon: Pencil, run: () => useBoard.getState().setEditing(el.id) }],
  toPlainText: (el) => `${nameOf(el.content)} ${hexOf(el.content)}`.trim(),
  toMarkdown: (el) => `- ${nameOf(el.content) ? `${nameOf(el.content)} ` : ''}\`${hexOf(el.content)}\``,
}
