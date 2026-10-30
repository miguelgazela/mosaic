import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CanvasView } from '../canvas/CanvasView'
import { useBoard } from '../canvas/store'
import { boardInfoKey, ensureDevRepo, getBoardRepo, useBoardInfo } from '../features/boards/boardRepo'
import { HomeEmpty } from '../features/boards/HomeEmpty'
import { BoardHrefContext, TrashHrefContext } from '../features/boards/nav'
import { recordRecent } from '../features/boards/recent'
import { memoryShareRepo, setShareRepo } from '../features/share/shareApi'
import { OfflineBanner, useOnline } from '../ui'
import { usePhone } from '../lib/usePhone'
import { TopBar } from './TopBar'

/** One in-memory share repo for the dev session; sub-board titles come from the dev database. */
function ensureDevShares(db: ReturnType<typeof ensureDevRepo>['db']) {
  const w = window as unknown as { __devShares?: ReturnType<typeof memoryShareRepo> }
  w.__devShares ??= memoryShareRepo((id) => [...db.boards.values()].filter((b) => b.parentId === id && b.deletedAt === null).map((b) => b.title))
  setShareRepo(w.__devShares)
}

const devHref = (id: string) => `/dev/board/${id}`

/**
 * Dev-only, auth-free board shell (top bar + canvas) for visual checks and e2e: /dev/board/x. Boards, cards and
 * lines live in an in-memory database (`DevDb`, see boardRepo.ts) that stands in for Supabase, so child boards,
 * moving cards, duplicating and the trash work without a backend. `?home=1` shows the Home empty state, `?view=1` the read-only board (04-board-read-only).
 */
export function DevBoardPage() {
  const { boardId = 'x' } = useParams()
  const [params] = useSearchParams()
  const online = useOnline()
  const qc = useQueryClient()
  const [ready, setReady] = useState(false)
  const phone = usePhone()
  const readOnly = params.get('view') === '1' || phone
  const isHome = params.get('home') === '1' || boardId === 'home'
  const title = useBoardInfo(boardId).data?.title ?? 'Untitled board'
  const repo = useMemo(() => ensureDevRepo(), [])
  const db = repo.db
  useMemo(() => ensureDevShares(db), [db])

  useEffect(() => {
    setReady(false)
    const store = useBoard.getState()
    db.ensure(boardId)
    const { elements, lines } = db.live(boardId)
    store.reset(elements, lines)
    store.setBoardId(boardId)
    store.setReadOnly(readOnly)
    if (!isHome && boardId !== 'home') recordRecent(boardId)

    // Mirror every change on this board into the in-memory database (what the write queue does for Supabase).
    let prevEls = useBoard.getState().elements
    let prevLines = useBoard.getState().connections
    const unsub = useBoard.subscribe((s) => {
      if (s.elements === prevEls && s.connections === prevLines) return
      const ne = s.elements
      const nl = s.connections
      if (!s.syncMuted && !s.dragging && s.boardId === boardId) {
        const gone = Object.keys(prevEls).filter((id) => !(id in ne))
        const changed = Object.values(ne).filter((e) => prevEls[e.id] !== e)
        db.reviveElements(changed, boardId)
        db.deleteElements(gone)
        db.saveLines(boardId, Object.values(nl).filter((c) => prevLines[c.id] !== c))
        db.deleteLines(Object.keys(prevLines).filter((id) => !(id in nl)))
      }
      if (!s.dragging) { prevEls = ne; prevLines = nl }
    })
    setReady(true)
    return () => { unsub(); useBoard.getState().setReadOnly(false) }
  }, [boardId, db, isHome, readOnly])

  const path = db.path(boardId)
  const board = db.boards.get(boardId)
  return (
    <BoardHrefContext.Provider value={devHref}>
      <TrashHrefContext.Provider value="/dev/trash">
        <div className="flex h-full flex-col">
          <TopBar
            ancestors={path.slice(0, -1).map((p) => ({ id: p.id, title: p.title, to: p.id === 'home' ? '/dev/board/home' : devHref(p.id) }))}
            title={title}
            onRename={(t) => { qc.setQueryData(boardInfoKey(boardId), (d: object | undefined) => ({ ...d, title: t })); void getBoardRepo().update(boardId, { title: t }) }}
            saveState={online ? 'saved' : 'offline'}
            email="miguel@example.com"
            onSignOut={() => {}}
            readOnly={readOnly}
            board={board ? { id: boardId, parentId: board.isHome ? null : board.parentId, icon: board.isHome ? undefined : board.icon, color: board.color } : undefined}
          />
          <OfflineBanner online={online} />
          <div className="relative min-h-0 flex-1">
            {ready && <CanvasView hideEmptyHint={isHome || readOnly} hidePill={phone} />}
            {ready && isHome && <HomeEmpty />}
          </div>
        </div>
      </TrashHrefContext.Provider>
    </BoardHrefContext.Provider>
  )
}
