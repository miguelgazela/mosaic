import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Columns3, CornerDownLeft, File, FileText, ImageIcon, Link2, ListChecks, Loader2, Palette, Search, X, type LucideIcon } from 'lucide-react'
import { BoardTile } from '../boards/icons'
import { getBoardRepo } from '../boards/boardRepo'
import { useBoardHref, useTrashHref } from '../boards/nav'
import { readRecent } from '../boards/recent'
import { flatHits, groupHits, moveSelection, parseSnippet, pathText, queryWords, type SearchRow } from './parse'

const DEBOUNCE_MS = 180

const TYPE_ICON: Record<string, LucideIcon> = { note: FileText, image: ImageIcon, file: File, link: Link2, todo: ListChecks, column: Columns3, swatch: Palette }

/** ⌘K / Ctrl+K toggles the palette from anywhere (also while a note is being edited). */
export function useSearchHotkey(toggle: () => void): void {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [toggle])
}

function Marked({ text }: { text: string }) {
  return <>{parseSnippet(text).map((s, i) => (s.hit ? <mark key={i} className="rounded-[var(--radius-chip)] bg-[var(--warning-soft)] px-0.5 text-inherit">{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

function Tile({ icon, color }: { icon: string | null; color: string | null }) {
  return <BoardTile icon={icon} color={color} size={24} glyph={14} radius="var(--radius-card)" />
}

const kbd = 'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--border)] bg-[var(--fill-hover)] px-1 text-[length:var(--text-caption)] text-[var(--text-secondary)]'

interface Item { key: string; row: SearchRow; recent?: boolean }

function Row({ item, selected, onPick, onHover }: { item: Item; selected: boolean; onPick: () => void; onHover: () => void }) {
  const { row, recent } = item
  const isBoard = row.kind === 'board'
  const Icon = isBoard ? null : TYPE_ICON[row.type] ?? FileText
  const tone = selected && !recent ? 'bg-[var(--primary-soft)] shadow-[inset_3px_0_0_var(--primary)]' : selected ? 'bg-[var(--fill-hover)]' : ''
  return (
    <li
      id={`sp-${item.key}`}
      role="option"
      aria-selected={selected}
      data-testid="search-row"
      onMouseMove={onHover}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-ui)] px-3 py-1.5 ${tone}`}
    >
      {isBoard ? <Tile icon={row.icon} color={row.color} /> : Icon && <Icon size={16} className="shrink-0 text-[var(--text-secondary)]" aria-hidden />}
      {isBoard ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[length:var(--text-card)] font-medium">{recent ? row.title : <Marked text={row.snippet || row.title} />}</span>
          <span className="max-w-[45%] shrink-0 truncate text-[length:var(--text-sm)] text-[var(--text-muted)]">{pathText(row.path)}</span>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--text-card)] leading-5"><Marked text={row.snippet} /></span>
          <span className="block truncate text-[length:var(--text-caption)] leading-4 text-[var(--text-muted)]">{pathText(row.path.slice(1)) || row.path[0]?.title}</span>
        </span>
      )}
      {selected && !recent && <span className={`${kbd} shrink-0`} aria-hidden><CornerDownLeft size={12} /></span>}
    </li>
  )
}

const Label = ({ children }: { children: ReactNode }) => <div className="px-3 pb-1 pt-3 text-[length:var(--text-caption)] font-semibold text-[var(--text-secondary)]">{children}</div>

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const boardHref = useBoardHref()
  const trashHref = useTrashHref()
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sel, setSel] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [q])
  useEffect(() => { input.current?.focus() }, [])

  const searching = queryWords(q).length > 0
  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => getBoardRepo().search(debounced),
    enabled: queryWords(debounced).length > 0,
    staleTime: 10_000,
  })
  const tree = useQuery({ queryKey: ['board-tree'], queryFn: () => getBoardRepo().tree(), staleTime: 0 })

  const recent: Item[] = useMemo(() => {
    const nodes = tree.data ?? []
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return readRecent().flatMap((id) => {
      const n = byId.get(id)
      if (!n || n.isHome) return []
      const path: SearchRow['path'] = []
      for (let p = n.parentId ? byId.get(n.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) path.unshift({ id: p.id, title: p.title, icon: p.icon })
      return [{ key: `r-${id}`, recent: true, row: { kind: 'board' as const, id, boardId: id, type: 'board', title: n.title, snippet: '', path, icon: n.icon, color: n.color } }]
    })
  }, [tree.data])

  // Typed text shows nothing stale: results count only once they belong to what is typed now.
  const fresh = searching && debounced === q.trim() && results.data !== undefined && !results.isFetching
  const groups = useMemo(() => groupHits(fresh ? results.data! : []), [fresh, results.data])
  const items: Item[] = useMemo(
    () => (searching ? flatHits(groups).map((row) => ({ key: `${row.kind}-${row.id}`, row })) : recent),
    [searching, groups, recent],
  )
  useEffect(() => { setSel(0) }, [items.length, q])

  const open = (row: SearchRow) => {
    onClose()
    navigate(row.kind === 'board' ? boardHref(row.id) : `${boardHref(row.boardId)}?card=${row.id}`)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => moveSelection(s, e.key === 'ArrowDown' ? 1 : -1, items.length)) }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); open(items[sel].row) }
  }
  useEffect(() => { document.getElementById(`sp-${items[sel]?.key}`)?.scrollIntoView({ block: 'nearest' }) }, [sel, items])

  const loading = searching && !fresh && !results.isError
  const empty = fresh && items.length === 0
  const idx = (it: Item) => items.indexOf(it)
  const boardItems = items.filter((i) => searching && i.row.kind === 'board')
  const cardItems = items.filter((i) => searching && i.row.kind === 'element')
  const render = (it: Item) => <Row key={it.key} item={it} selected={idx(it) === sel} onHover={() => setSel(idx(it))} onPick={() => open(it.row)} />

  return (
    <div className="fixed inset-0 z-[3500000] flex items-start justify-center bg-[var(--overlay-dim)] p-4" style={{ paddingTop: 120 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey} className="animate-menu-in w-full max-w-[624px] overflow-hidden rounded-[var(--radius-dialog)] bg-[var(--card-bg)]" style={{ boxShadow: 'var(--shadow-dialog)' }}>
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
          {loading ? <Loader2 size={18} className="shrink-0 animate-spin text-[var(--text-muted)]" aria-hidden /> : <Search size={18} className="shrink-0 text-[var(--text-muted)]" aria-hidden />}
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="sp-list"
            aria-activedescendant={items[sel] ? `sp-${items[sel].key}` : undefined}
            aria-label="Search boards and cards"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search boards and cards"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[length:var(--text-body)] outline-none focus-visible:shadow-none placeholder:text-[var(--text-muted)]"
          />
          {q ? (
            <button aria-label="Clear search" onClick={() => { setQ(''); input.current?.focus() }} className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-chip)] text-[var(--text-secondary)] hover:bg-[var(--fill-hover)]"><X size={16} /></button>
          ) : (
            <kbd className={`${kbd} px-1.5 font-medium`}>Esc</kbd>
          )}
        </div>

        {loading && (
          <div data-testid="search-loading" className="flex flex-col gap-3 p-4" aria-label="Searching" role="status">
            {[36, 66, 52].map((w) => (
              <div key={w} className="flex items-center gap-3"><span className="h-6 w-6 rounded-[var(--radius-card)] bg-[var(--fill-hover)]" /><span className="h-2.5 rounded-full bg-[var(--fill-hover)]" style={{ width: `${w}%` }} /></div>
            ))}
          </div>
        )}

        {results.isError && searching && (
          <p role="alert" className="px-6 py-8 text-center text-[length:var(--text-sm)] text-[var(--danger-ink)]">Search isn’t available right now. Try again in a moment.</p>
        )}

        {empty && (
          <div data-testid="search-empty" className="flex flex-col items-center gap-2 px-8 py-8 text-center">
            <p className="text-[length:var(--text-card)] font-semibold">No matches for “{q.trim()}”</p>
            <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">Search looks at board names, notes, to-dos, links, file names and captions. Items in Trash aren’t included.</p>
            <Link to={trashHref} onClick={onClose} className="mt-1 text-[length:var(--text-sm)] font-semibold text-[var(--link)] underline">Look in Trash</Link>
          </div>
        )}

        {!searching && recent.length > 0 && (
          <ul id="sp-list" role="listbox" aria-label="Recent boards" className="max-h-[400px] overflow-auto px-2 pb-2">
            <Label>Recent boards</Label>
            {recent.map(render)}
          </ul>
        )}
        {!searching && recent.length === 0 && (
          <p className="px-6 py-8 text-center text-[length:var(--text-sm)] text-[var(--text-secondary)]">Type to search board names, notes, to-dos, links, file names and captions.</p>
        )}

        {fresh && items.length > 0 && (
          <>
            <ul id="sp-list" role="listbox" aria-label="Results" className="max-h-[400px] overflow-auto px-2 pb-2">
              {boardItems.length > 0 && <Label>Boards</Label>}
              {boardItems.map(render)}
              {cardItems.length > 0 && <Label>Cards</Label>}
              {cardItems.map(render)}
            </ul>
            <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--text-secondary)]" aria-hidden>
              <span className="flex items-center gap-1.5"><kbd className={kbd}><ArrowUp size={12} /></kbd><kbd className={kbd}><ArrowDown size={12} /></kbd> Move</span>
              <span className="flex items-center gap-1.5"><kbd className={kbd}><CornerDownLeft size={12} /></kbd> Open</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
