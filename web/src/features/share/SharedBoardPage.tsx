import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Link2Off } from 'lucide-react'
import { CanvasView } from '../../canvas/CanvasView'
import { useBoard } from '../../canvas/store'
import { signedUrls } from '../../lib/storage/client'
import { fromConnRow, fromRow } from '../../lib/sync/rows'
import { LogoMark } from '../../ui'
import { FullPageMessage } from '../../ui/FullPageMessage'
import { boardInfoKey, setBoardRepo, type BoardRepo } from '../boards/boardRepo'
import { BoardTile } from '../boards/icons'
import { BoardHrefContext } from '../boards/nav'
import { fetchShared, ShareGone, type SharePayload } from './viewerApi'

/** Board cards ask the repo for title and count; in the shared view the answers come from the payload (no signed-in calls). */
function sharedRepo(p: SharePayload): BoardRepo {
  const no = () => Promise.reject(new Error('read only'))
  return {
    create: no, update: no, tree: no, move: no, restoreLines: no, duplicate: no, trash: no, restore: no, trashItems: no, restoreElement: no, deleteForever: no, search: no,
    info: async (id) => p.children[id] ? { title: p.children[id].title, icon: p.children[id].icon, color: p.children[id].color } : { title: 'Private board', icon: null, color: null, locked: true },
    count: async (id) => p.children[id]?.count ?? 0,
  }
}

function MadeWith() {
  return (
    <Link to="/" className="ml-auto flex items-center gap-2 rounded-[var(--radius-ui)] px-2 py-1 text-[length:var(--text-card)] font-medium text-[var(--text-secondary)] hover:bg-[var(--fill-hover)]">
      <LogoMark size={20} /> Made with Mosaic
    </Link>
  )
}

const bar = 'flex shrink-0 items-center gap-3 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4'

function Tile({ b }: { b: { icon: string | null; color: string | null } }) {
  return <BoardTile icon={b.icon} color={b.color} size={24} glyph={14} radius="var(--radius-chip)" />
}

/** Top bar of the shared view (07-shared-board-*): no account, no tools. */
function SharedTopBar({ p, hrefFor }: { p: SharePayload; hrefFor: (id: string) => string }) {
  const deep = p.path.length > 1
  const parent = p.path[p.path.length - 2]
  return (
    <header className={bar} style={{ height: 'var(--topbar-h)' }}>
      {deep ? (
        <>
          <Link to={hrefFor(parent.id)} aria-label={`Back to ${parent.title}`} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-ui)] hover:bg-[var(--fill-hover)]"><ChevronLeft size={18} /></Link>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            {p.path.slice(0, -1).map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <Link to={hrefFor(c.id)} className="truncate text-[length:var(--text-body)] text-[var(--text-secondary)] hover:text-[var(--text)]">{c.title}</Link>
                <ChevronRight size={14} className="text-[var(--icon-subtle)]" aria-hidden />
              </span>
            ))}
            <Tile b={p.board} />
            <h1 className="truncate text-[length:var(--text-body)] font-semibold">{p.board.title}</h1>
          </nav>
          <span className="truncate text-[length:var(--text-caption)] text-[var(--text-secondary)]">Shared by {p.ownerName}, view only</span>
        </>
      ) : (
        <>
          <Tile b={p.board} />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[length:var(--text-body)] font-semibold">{p.board.title}</h1>
            <p className="truncate text-[length:var(--text-caption)] text-[var(--text-secondary)]">Shared by {p.ownerName}, view only</p>
          </div>
        </>
      )}
      <MadeWith />
    </header>
  )
}

export function SharedGone() {
  return (
    <div className="flex h-full flex-col" data-testid="share-gone">
      <header className={bar} style={{ height: 'var(--topbar-h)' }}><MadeWith /></header>
      <main className="dotted flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-[420px] rounded-[var(--radius-dialog)] bg-[var(--card-bg)] p-7" style={{ boxShadow: 'var(--shadow-dialog)' }}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fill-hover)] text-[var(--text)]"><Link2Off size={20} /></span>
          <h1 className="mt-5 text-[length:var(--text-h3)] font-semibold">This link doesn’t work any more</h1>
          <p className="mt-3 text-[length:var(--text-body)] text-[var(--text-secondary)]">The owner turned it off, or the address is wrong. Ask the person who sent it for a new link.</p>
        </div>
      </main>
    </div>
  )
}

/** `/s/:token` and `/s/:token/b/:boardId`: read-only board for anyone with the link, no sign-in. */
export function SharedBoardPage() {
  const { token = '', boardId } = useParams()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['shared', token, boardId ?? 'root'],
    queryFn: () => fetchShared(token, boardId),
    gcTime: 0,
    staleTime: Infinity,
    retry: (n, e) => !(e instanceof ShareGone) && n < 1,
    refetchOnWindowFocus: false,
  })
  const [shownFor, setShownFor] = useState<string | null>(null)
  const p = q.data
  const rootId = p?.root.id
  const hrefFor = useMemo(() => (id: string) => (id === rootId ? `/s/${token}` : `/s/${token}/b/${id}`), [token, rootId])

  useEffect(() => {
    if (!p) return
    setBoardRepo(sharedRepo(p))
    for (const [id, c] of Object.entries(p.children)) qc.setQueryData(boardInfoKey(id), { title: c.title, icon: c.icon, color: c.color })
    signedUrls.seed(p.urls)
    const s = useBoard.getState()
    s.setReadOnly(true)
    s.reset(p.elements.map(fromRow), p.connections.map(fromConnRow))
    s.setBoardId(p.board.id)
    s.setViewport(p.board.viewport ?? { x: 0, y: 0, zoom: 1 })
    setShownFor(`${token}/${boardId ?? ''}`)
    return () => {
      setShownFor(null)
      setBoardRepo(null)
      const st = useBoard.getState()
      st.reset([])
      st.setReadOnly(false)
    }
  }, [p, qc, token, boardId])

  if (q.isError) {
    if (q.error instanceof ShareGone) return <SharedGone />
    return (
      <FullPageMessage>
        <div className="flex flex-col items-center gap-4 text-center">
          <p>Couldn’t open this board. {q.error.message}</p>
          <button className="rounded-[var(--radius-ui)] bg-[var(--primary)] px-4 py-2 font-semibold text-white" onClick={() => void q.refetch()}>Try again</button>
        </div>
      </FullPageMessage>
    )
  }
  if (!p) return <FullPageMessage>Opening shared board…</FullPageMessage>

  return (
    <BoardHrefContext.Provider value={hrefFor}>
      <div className="flex h-full flex-col" data-testid="shared-board">
        <SharedTopBar p={p} hrefFor={hrefFor} />
        <div className="relative min-h-0 flex-1">{shownFor && <CanvasView hideEmptyHint hidePill />}</div>
      </div>
    </BoardHrefContext.Provider>
  )
}
