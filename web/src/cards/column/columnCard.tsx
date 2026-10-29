import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Columns3, Pencil } from 'lucide-react'
import { generateKeyBetween } from 'fractional-indexing'
import { useShallow } from 'zustand/react/shallow'
import { patchCmd } from '../../canvas/commands'
import { childrenOf, insertIndex } from '../../canvas/columns'
import { colorVar } from '../../canvas/colors'
import { useBoard } from '../../canvas/store'
import type { CanvasElement } from '../../canvas/types'
import type { CardDefinition, CardProps, DropTarget } from '../types'

const titleOf = (c: Record<string, unknown>): string => (typeof c.title === 'string' ? c.title : '')
const collapsedOf = (c: Record<string, unknown>): boolean => c.collapsed === true

function setContent(id: string, label: string, patch: Record<string, unknown>) {
  const s = useBoard.getState()
  const el = s.elements[id]
  if (!el) return
  s.exec(patchCmd(label, [{ id, before: { content: el.content }, after: { content: { ...el.content, ...patch } } }]))
}

function ColumnCard({ element: el, renderChild }: CardProps) {
  const kids = useBoard(useShallow((s) => childrenOf(s.elements, el.id).map((c) => c.id)))
  const over = useBoard((s) => (s.dropHint?.targetId === el.id ? (s.dropHint.hint.index ?? kids.length) : null))
  const editing = useBoard((s) => s.editing === el.id)
  const title = titleOf(el.content)
  const collapsed = collapsedOf(el.content)
  const dropping = over !== null

  return (
    <div
      data-testid="column-card"
      data-drop-over={dropping || undefined}
      className="rounded-[var(--radius-ui)]"
      style={{
        background: dropping ? 'var(--primary-soft)' : (colorVar(el.color) ?? 'var(--chrome-bg)'),
        boxShadow: dropping ? 'inset 0 0 0 2px var(--primary)' : undefined,
        padding: collapsed ? 0 : '0 var(--column-pad-x) var(--column-pad-y)',
      }}
    >
      <div className="flex h-12 items-center gap-2 px-1" style={collapsed ? { padding: '0 16px' } : undefined}>
        {editing ? (
          <TitleInput id={el.id} initial={title} />
        ) : (
          <div
            className={`min-w-0 flex-1 truncate text-[length:var(--text-card-title)] font-semibold leading-[var(--leading-card-title)] ${title ? '' : 'text-[var(--text-muted)]'}`}
            onDoubleClick={() => useBoard.getState().setEditing(el.id)}
          >
            {title || 'Untitled column'}
          </div>
        )}
        {collapsed ? (
          <span className="rounded-full bg-[var(--fill-pressed)] px-2 text-[length:var(--text-caption)] font-medium leading-5 text-[var(--text-secondary)]">
            {kids.length} {kids.length === 1 ? 'card' : 'cards'}
          </span>
        ) : (
          <span className="text-[length:var(--text-caption)] text-[var(--text-muted)]" data-testid="column-count">{kids.length}</span>
        )}
        <button
          data-nodrag
          aria-label={collapsed ? 'Expand column' : 'Collapse column'}
          aria-expanded={!collapsed}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--text-secondary)] hover:bg-[var(--fill-hover)]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setContent(el.id, collapsed ? 'Expand column' : 'Collapse column', { collapsed: !collapsed })}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div data-column-body className="flex flex-col gap-[var(--column-gap)]">
          {kids.length === 0 ? (
            <div
              className="flex h-[108px] items-center justify-center rounded-[var(--radius-ui)] border border-dashed border-[var(--border-strong)] text-[length:var(--text-sm)] text-[var(--text-muted)]"
            >
              Drag cards here to stack them
            </div>
          ) : (
            kids.map((id, i) => (
              <div key={id} data-column-slot className="relative">
                {over === i && <InsertLine at="top" />}
                {renderChild(id)}
                {over === kids.length && i === kids.length - 1 && <InsertLine at="bottom" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function InsertLine({ at }: { at: 'top' | 'bottom' }) {
  return (
    <div
      data-testid="insert-line"
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-[var(--primary)]"
      style={{ [at]: -5 }}
    >
      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[var(--primary)]" />
    </div>
  )
}

function TitleInput({ id, initial }: { id: string; initial: string }) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save && draft !== initial) setContent(id, 'Rename column', { title: draft.trim() })
    useBoard.getState().setEditing(null)
  }
  return (
    <input
      ref={ref}
      data-nodrag
      aria-label="Column title"
      placeholder="Name this column"
      value={draft}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      className="min-w-0 flex-1 rounded-[var(--radius-chip)] border border-[var(--primary)] bg-[var(--card-bg)] px-1.5 py-0.5 text-[length:var(--text-card-title)] font-semibold outline-none"
    />
  )
}

const dropTarget: DropTarget = {
  accepts: (target, dragged) => dragged.length > 0 && dragged.every((d) => d.type !== 'column' && d.id !== target.id),
  hover(target, p) {
    const node = document.querySelector<HTMLElement>(`[data-card-id="${target.id}"]`)
    const mids = [...(node?.querySelectorAll<HTMLElement>('[data-column-slot]') ?? [])].map((n) => {
      const r = n.getBoundingClientRect()
      return r.top + r.height / 2
    })
    return { index: insertIndex(mids, p.clientY) }
  },
  drop({ target, dragged, hint }) {
    const ids = new Set(dragged.map((d) => d.id))
    const sibs = childrenOf(useBoard.getState().elements, target.id).filter((c) => !ids.has(c.id))
    const at = Math.max(0, Math.min(hint.index ?? sibs.length, sibs.length))
    let prev = sibs[at - 1]?.sortKey ?? null
    const next = sibs[at]?.sortKey ?? null
    const ordered: CanvasElement[] = [...dragged].sort((a, b) => a.y - b.y || a.x - b.x)
    const out: Record<string, Partial<CanvasElement>> = {}
    for (const d of ordered) {
      prev = generateKeyBetween(prev, next)
      out[d.id] = { parentId: target.id, sortKey: prev, width: target.width }
    }
    return out
  },
}

export const columnCard: CardDefinition = {
  type: 'column',
  label: 'Column',
  Component: ColumnCard,
  defaultSize: { width: 280, height: null },
  resize: 'width',
  minWidth: 200,
  minHeight: 64,
  shortcut: 'C',
  editOnCreate: true,
  toolbar: { label: 'Column', icon: Columns3 },
  defaultContent: () => ({ title: '', collapsed: false }),
  dropTarget,
  menuItems: (el) => [{ id: 'rename', label: 'Rename', icon: Pencil, run: () => useBoard.getState().setEditing(el.id) }],
  toPlainText: (el) => titleOf(el.content),
  toMarkdown: (el, ctx) => [`## ${titleOf(el.content) || 'Untitled column'}`, ...(ctx?.childrenMarkdown(el.id) ?? [])].join('\n\n'),
}
