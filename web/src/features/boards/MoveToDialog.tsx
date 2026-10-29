import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { create } from 'zustand'
import { planMove } from '../../canvas/move'
import { selectedIds, useBoard } from '../../canvas/store'
import { Button, Dialog } from '../../ui'
import { ancestorIds, subtreeIds, visibleRows } from './boardTree'
import { getBoardRepo } from './boardRepo'
import { BoardTile } from './icons'
import { moveSelectionToBoard } from './moveCards'

interface MoveDialogState { ids: string[] | null; open(ids: string[]): void; close(): void }
const useMoveDialog = create<MoveDialogState>()((set) => ({ ids: null, open: (ids) => set({ ids }), close: () => set({ ids: null }) }))

/** Open "Move N cards to…" for the current selection. */
export function openMoveDialog(): void {
  const ids = selectedIds(useBoard.getState())
  if (ids.length) useMoveDialog.getState().open(ids)
}

/** Mounted once in the app shell. */
export function MoveToHost() {
  const ids = useMoveDialog((s) => s.ids)
  const close = useMoveDialog((s) => s.close)
  return ids ? <MoveToDialog ids={ids} onClose={close} /> : null
}

function MoveToDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const current = useBoard((s) => s.boardId)
  const count = useMemo(() => {
    const s = useBoard.getState()
    return planMove(s.elements, s.connections, ids)?.top.length ?? ids.length
  }, [ids])
  // A board cannot go into itself: its own card's board and everything below are off limits.
  const tree = useQuery({ queryKey: ['board-tree'], queryFn: () => getBoardRepo().tree(), staleTime: 0 })
  const nodes = tree.data ?? []
  const blocked = useMemo(() => {
    const els = useBoard.getState().elements
    const own = ids.flatMap((i) => (els[i]?.type === 'board' && typeof els[i].content.boardId === 'string' ? [els[i].content.boardId as string] : []))
    return subtreeIds(nodes, own)
  }, [ids, nodes])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string> | null>(null)
  const expanded = useMemo(
    () => open ?? new Set([...nodes.filter((n) => n.isHome).map((n) => n.id), ...(current ? [current, ...ancestorIds(nodes, current)] : [])]),
    [open, nodes, current],
  )
  const rows = useMemo(() => visibleRows(nodes, expanded, q), [nodes, expanded, q])
  const target = nodes.find((n) => n.id === picked)
  const list = useRef<HTMLDivElement>(null)

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }
  const disabled = (id: string) => id === current || blocked.has(id)
  const go = () => {
    if (!target) return
    moveSelectionToBoard({ id: target.id, title: target.title })
    onClose()
  }
  const focusRow = (delta: number) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="treeitem"]:not([aria-disabled="true"])') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[Math.max(0, Math.min(items.length - 1, i + delta))]?.focus()
  }

  return (
    <Dialog
      title={`Move ${count} ${count === 1 ? 'card' : 'cards'} to…`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!target} onClick={go}>{target ? `Move to ${target.title}` : 'Move'}</Button>
        </>
      }
    >
      <label className="mb-2 flex h-10 items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] px-3 text-[var(--text-muted)] focus-within:border-[var(--primary)] focus-within:shadow-[var(--ring-focus)]">
        <Search size={15} aria-hidden />
        <input
          autoFocus
          aria-label="Search boards"
          placeholder="Search boards"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(1) }
            else if (e.key === 'Enter' && target) go()
          }}
          className="min-w-0 flex-1 bg-transparent text-[length:var(--text-card)] text-[var(--text)] outline-none focus-visible:shadow-none placeholder:text-[var(--text-muted)]"
        />
      </label>
      <div
        ref={list}
        role="tree"
        aria-label="Boards"
        data-testid="move-tree"
        className="-mx-2 max-h-[300px] overflow-auto px-2"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(1) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(-1) }
        }}
      >
        {tree.isPending && <p className="px-2 py-3 text-[var(--text-muted)]" role="status">Loading boards…</p>}
        {tree.isError && <p className="px-2 py-3 text-[var(--danger)]">Couldn’t load your boards.</p>}
        {!tree.isPending && !tree.isError && rows.length === 0 && <p className="px-2 py-3 text-[var(--text-muted)]">No boards match “{q}”.</p>}
        {rows.map(({ node, depth, hasChildren, expanded: isOpen }) => {
          const off = disabled(node.id)
          const on = picked === node.id
          return (
            <div key={node.id} className="flex items-center" style={{ paddingLeft: depth * 22 }}>
              <button
                tabIndex={-1}
                aria-label={isOpen ? `Collapse ${node.title}` : `Expand ${node.title}`}
                className={`flex h-8 w-6 shrink-0 items-center justify-center text-[var(--text-secondary)] ${hasChildren && !q ? '' : 'invisible'}`}
                onClick={() => toggle(node.id)}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={on}
                aria-disabled={off}
                aria-expanded={hasChildren ? isOpen : undefined}
                data-board-id={node.id}
                onClick={() => { if (!off) setPicked(node.id) }}
                onDoubleClick={() => { if (!off) { setPicked(node.id); moveSelectionToBoard({ id: node.id, title: node.title }); onClose() } }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' && hasChildren && !isOpen) toggle(node.id)
                  else if (e.key === 'ArrowLeft' && hasChildren && isOpen) toggle(node.id)
                  else if (e.key === 'Enter' && !off) { e.preventDefault(); e.stopPropagation(); setPicked(node.id) }
                }}
                className={`flex h-9 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-ui)] px-2 text-left text-[length:var(--text-card)] outline-none focus-visible:shadow-[var(--ring-focus)] ${
                  on ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary-ink)]' : off ? 'cursor-default text-[var(--text-muted)]' : 'hover:bg-[var(--fill-hover)]'
                }`}
              >
                <span className="shrink-0" style={{ opacity: off ? 0.6 : 1 }}>
                  <BoardTile icon={node.isHome ? 'home' : node.icon} color={node.color} size={20} glyph={12} radius="6px" />
                </span>
                <span className="min-w-0 flex-1 truncate">{node.title}</span>
                {node.id === current && <span className="shrink-0 text-[length:var(--text-caption)] font-normal">Current board</span>}
                {on && <Check size={16} aria-hidden />}
              </button>
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}
