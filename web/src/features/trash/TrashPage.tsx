import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, ChevronRight, Clock, File, FileText, Image, LayoutDashboard, Link2, Palette, Columns3, Trash2, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Dialog, LogoMark, toast } from '../../ui'
import { getBoardRepo, type TrashItem } from '../boards/boardRepo'
import { BoardTile } from '../boards/icons'
import { useBoardHref } from '../boards/nav'
import { TRASH_DAYS, confirmText, daysLeft, deletedLabel, describeItem, visibleTrash, wasInText } from './describe'

const initials = (email: string) => email.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'

/** “Name” in curly quotes (notes are already quoted). */
const quoted = (t: string) => (t.startsWith('“') ? t : `“${t}”`)

export const TRASH_KEY = ['trash'] as const

const ICONS: Record<string, LucideIcon> = {
  board: LayoutDashboard, note: FileText, image: Image, file: File, link: Link2, todo: CheckSquare, column: Columns3, swatch: Palette,
}

/** Last week before the purge: shown with a clock and the word "days", never colour alone. */
const URGENT_DAYS = 7

function Tile({ item }: { item: TrashItem }) {
  const Icon = ICONS[item.type] ?? FileText
  if (item.kind === 'board') return <BoardTile icon={item.icon} color={item.color} size={32} glyph={16} radius="var(--radius-ui)" />
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-ui)]"
      style={{ background: 'var(--fill-hover)', color: 'var(--text-secondary)' }}
      aria-hidden
    >
      <Icon size={16} />
    </span>
  )
}

const keyOf = (i: TrashItem) => `${i.kind}:${i.id}`

function Row({ item, now, checked, onCheck, onRestore, onDelete }: { item: TrashItem; now: number; checked: boolean; onCheck: (on: boolean) => void; onRestore: () => void; onDelete: () => void }) {
  const { title, kind } = describeItem(item)
  const left = daysLeft(item.deletedAt, now)
  const urgent = left <= URGENT_DAYS
  return (
    <tr data-testid="trash-row" data-kind={item.kind} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--fill-hover)]">
      <td className="w-10 py-3 pl-4">
        <input type="checkbox" aria-label={`Select ${title}`} checked={checked} onChange={(e) => onCheck(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Tile item={item} />
          <div className="min-w-0">
            <div className="max-w-[240px] truncate font-semibold" title={title}>{title}</div>
            <div className="text-[length:var(--text-caption)] text-[var(--text-muted)]">{kind}</div>
          </div>
        </div>
      </td>
      <td className="max-w-[180px] px-3 py-3 text-[var(--text-secondary)]"><span className="line-clamp-2">{wasInText(item.wasIn)}</span></td>
      <td className="px-3 py-3 text-[var(--text-secondary)]">{deletedLabel(item.deletedAt, now)}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 ${urgent ? 'font-semibold text-[var(--danger-ink)]' : 'text-[var(--text-secondary)]'}`}>
          {urgent && <Clock size={14} aria-hidden />}
          {left} {left === 1 ? 'day' : 'days'}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button className="!h-8 !px-3" onClick={onRestore} aria-label={`Restore ${title}`}>Restore</Button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${title} forever`}
            className="w-[72px] rounded-[var(--radius-ui)] px-1 py-1 text-center text-[length:var(--text-sm)] font-semibold leading-4 text-[var(--danger-ink)] hover:bg-[var(--fill-hover)]"
          >
            Delete forever
          </button>
        </div>
      </td>
    </tr>
  )
}

/** Trash (06-trash-populated / 06-trash-empty): boards and cards kept for 30 days. */
export function TrashPage({ homeTo = '/' }: { homeTo?: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const href = useBoardHref()
  const qc = useQueryClient()
  const repo = getBoardRepo()
  const items = useQuery({ queryKey: TRASH_KEY, queryFn: () => getBoardRepo().trashItems(), refetchOnWindowFocus: true, staleTime: 0 })
  const list = items.data ? visibleTrash(items.data) : []
  const [asking, setAsking] = useState<TrashItem[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Only items still in the list count (a refresh may have dropped some).
  const chosen = list.filter((i) => picked.has(keyOf(i)))
  const allOn = list.length > 0 && chosen.length === list.length
  const setOne = (i: TrashItem, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(keyOf(i)); else n.delete(keyOf(i)); return n })
  const now = Date.now()
  const email = session?.user.email ?? ''

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: TRASH_KEY })
    void qc.invalidateQueries({ queryKey: ['board-tree'] })
    void qc.invalidateQueries({ queryKey: ['board-count'] })
  }
  // Boards first, so cards that were in a trashed board can follow it back.
  const boardsFirst = (xs: TrashItem[]) => [...xs].sort((a, b) => Number(b.kind === 'board') - Number(a.kind === 'board'))
  const restore = useMutation({
    mutationFn: async (xs: TrashItem[]) => {
      const failed: TrashItem[] = []
      for (const i of boardsFirst(xs)) {
        try { await (i.kind === 'board' ? repo.restore(i.id) : repo.restoreElement(i.id)) } catch { failed.push(i) }
      }
      return failed
    },
    onSuccess: (failed, xs) => {
      refresh()
      setPicked(new Set())
      if (failed.length) toast(failed.length === xs.length ? 'Couldn’t restore that. Restore the board it was in first.' : `Restored ${xs.length - failed.length} of ${xs.length}. Restore the board the rest were in first.`, { tone: 'error' })
      else if (xs.length > 1) toast(`Restored ${xs.length} items`, { tone: 'success' })
      else {
        const i = xs[0]
        toast(`Restored ${describeItem(i).title}`, i.kind === 'board' ? { tone: 'success', action: { label: 'Open', run: () => navigate(href(i.id)) } } : { tone: 'success' })
      }
    },
  })
  const forever = useMutation({
    mutationFn: async (xs: TrashItem[]) => {
      let failed = 0
      for (const i of boardsFirst(xs)) {
        try { await repo.deleteForever(i.kind, i.id) } catch { failed++ }
      }
      return failed
    },
    onSuccess: (failed) => {
      setAsking(null); setPicked(new Set()); refresh()
      if (failed) toast(`Couldn’t delete ${failed} item${failed === 1 ? '' : 's'}`, { tone: 'error' })
      else toast('Deleted forever')
    },
  })

  return (
    <div className="flex min-h-full flex-col bg-[var(--chrome-bg)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4" style={{ height: 'var(--topbar-h)' }}>
        <Link to={homeTo} aria-label="Home" className="mr-2 rounded-[var(--radius-ui)]"><LogoMark /></Link>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[length:var(--text-card)]">
          <Link to={homeTo} className="rounded-[var(--radius-ui)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--fill-hover)] hover:text-[var(--text)]">Home</Link>
          <ChevronRight size={14} className="text-[var(--icon-subtle)]" aria-hidden />
          <span aria-current="page" className="px-2 py-1 font-semibold">Trash</span>
        </nav>
        <div className="flex-1" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:var(--text-caption)] font-bold text-[var(--primary-ink)]">{initials(email)}</span>
      </header>

      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 pb-16 pt-10">
        <h1 className="text-[length:var(--text-h1)] font-semibold leading-[var(--leading-h1)]">Trash</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Deleted boards and cards stay here for {TRASH_DAYS} days, then they’re deleted forever.</p>

        {items.isPending ? (
          <p className="mt-10 text-[var(--text-muted)]" role="status">Loading trash…</p>
        ) : items.isError ? (
          <div className="mt-10 flex items-center gap-3">
            <p className="text-[var(--danger)]">Couldn’t load the trash.</p>
            <Button onClick={() => void items.refetch()}>Try again</Button>
          </div>
        ) : list.length === 0 ? (
          <div data-testid="trash-empty" className="mt-8 flex flex-col items-center rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] px-6 py-16 text-center">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--fill-hover)]"><Trash2 size={24} aria-hidden /></span>
            <h2 className="mt-4 text-[length:var(--text-body)] font-semibold">Trash is empty</h2>
            <p className="mt-2 max-w-[340px] text-[length:var(--text-card)] text-[var(--text-secondary)]">When you delete a board or card, it waits here so you can restore it.</p>
          </div>
        ) : (
          <>
          {chosen.length > 0 && (
            <div role="toolbar" aria-label="Selected items" data-testid="trash-bulk" className="mt-6 flex items-center gap-3 rounded-[var(--radius-menu)] bg-[var(--primary-soft)] px-4 py-2">
              <span className="font-semibold text-[var(--primary-ink)]">{chosen.length} selected</span>
              <div className="flex-1" />
              <Button className="!h-8 !px-3" onClick={() => restore.mutate(chosen)} disabled={restore.isPending}>Restore selected</Button>
              <Button className="!h-8 !px-3" variant="destructive" onClick={() => setAsking(chosen)}>Delete selected forever</Button>
            </div>
          )}
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)]">
            <table className="w-full border-collapse text-left text-[length:var(--text-card)]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[length:var(--text-caption)] font-semibold text-[var(--text-secondary)]">
                  <th scope="col" className="w-10 py-3 pl-4">
                    <input type="checkbox" aria-label="Select all" checked={allOn} onChange={(e) => setPicked(e.target.checked ? new Set(list.map(keyOf)) : new Set())} className="h-4 w-4 accent-[var(--primary)]" />
                  </th>
                  <th scope="col" className="px-4 py-3">Item</th>
                  <th scope="col" className="px-3 py-3">Was in</th>
                  <th scope="col" className="px-3 py-3">Deleted</th>
                  <th scope="col" className="px-3 py-3">Deleted forever in</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <Row key={keyOf(i)} item={i} now={now} checked={picked.has(keyOf(i))} onCheck={(on) => setOne(i, on)} onRestore={() => restore.mutate([i])} onDelete={() => setAsking([i])} />
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </main>

      {asking && (
        <Dialog
          title={asking.length > 1 ? `Delete ${asking.length} items forever?` : `Delete ${quoted(describeItem(asking[0]).title)} forever?`}
          onClose={() => setAsking(null)}
          width={420}
          footer={
            <>
              <Button autoFocus onClick={() => setAsking(null)}>Cancel</Button>
              <Button variant="destructive" disabled={forever.isPending} onClick={() => forever.mutate(asking)}>Delete forever</Button>
            </>
          }
        >
          <p className="text-[var(--text-secondary)]">{asking.length > 1 ? 'They will be gone for good, boards with everything in them. This can’t be undone.' : confirmText(asking[0])}</p>
        </Dialog>
      )}
    </div>
  )
}
