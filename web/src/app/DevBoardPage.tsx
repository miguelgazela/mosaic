import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CanvasView } from '../canvas/CanvasView'
import { useBoard } from '../canvas/store'
import { boardInfoKey, getBoardRepo, memoryBoardRepo, setBoardRepo, useBoardInfo } from '../features/boards/boardRepo'
import { HomeEmpty } from '../features/boards/HomeEmpty'
import { BoardHrefContext } from '../features/boards/nav'
import { OfflineBanner, useOnline } from '../ui'
import { TopBar } from './TopBar'

const devHref = (id: string) => `/dev/board/${id}`

/**
 * Dev-only, auth-free board shell (top bar + canvas, boards kept in memory) for visual checks and
 * e2e: /dev/board/x. Child boards opened from board cards live at /dev/board/<id>; `?home=1` shows the Home empty state.
 */
export function DevBoardPage() {
  const { boardId = 'x' } = useParams()
  const [params] = useSearchParams()
  const online = useOnline()
  const qc = useQueryClient()
  const [ready, setReady] = useState(false)
  const isHome = params.get('home') === '1'
  const title = useBoardInfo(boardId).data?.title ?? 'Untitled board'
  useMemo(() => {
    // One in-memory repo for the whole dev session, so child boards keep their names.
    const w = window as unknown as { __devRepo?: ReturnType<typeof memoryBoardRepo> }
    w.__devRepo ??= memoryBoardRepo()
    setBoardRepo(w.__devRepo)
  }, [])
  useEffect(() => {
    setReady(false)
    useBoard.getState().reset([])
    useBoard.getState().setBoardId(boardId)
    setReady(true)
  }, [boardId])
  return (
    <BoardHrefContext.Provider value={devHref}>
      <div className="flex h-full flex-col">
        <TopBar
          ancestors={[{ id: 'home', title: 'Home', to: '/' }]}
          title={title}
          onRename={(t) => { qc.setQueryData(boardInfoKey(boardId), (d: object | undefined) => ({ ...d, title: t })); void getBoardRepo().update(boardId, { title: t }) }}
          saveState={online ? 'saved' : 'offline'}
          email="miguel@example.com"
          onSignOut={() => {}}
        />
        <OfflineBanner online={online} />
        <div className="relative min-h-0 flex-1">
          {ready && <CanvasView hideEmptyHint={isHome} />}
          {ready && isHome && <HomeEmpty />}
        </div>
      </div>
    </BoardHrefContext.Provider>
  )
}
