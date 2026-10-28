import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { CanvasView } from '../canvas/CanvasView'
import { elementHeight, useBoard } from '../canvas/store'
import { BoardSkeleton } from '../features/boards/BoardSkeleton'
import { saveSkeleton } from '../features/boards/skeleton'
import { fetchBoard, renameBoard, type BoardData, type BoardMeta } from '../lib/sync/boardApi'
import { startBoardSync } from '../lib/sync/boardSync'
import { useSync } from '../lib/sync/status'
import { Button, OfflineBanner, useOnline } from '../ui'
import { FullPageMessage } from '../ui/FullPageMessage'
import { TopBar } from './TopBar'

const boardKey = (id: string) => ['board', id] as const

function withTitle(d: BoardData, title: string): BoardData {
  return { ...d, board: { ...d.board, title }, path: d.path.map((p, i) => (i === d.path.length - 1 ? { ...p, title } : p)) }
}

export function BoardPage() {
  const { boardId = '' } = useParams()
  const { session, signOut } = useAuth()
  const online = useOnline()
  const status = useSync((s) => s.status)
  const qc = useQueryClient()

  // Fresh load on every open (gcTime 0); the canvas store owns the data afterwards.
  const board = useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => fetchBoard(boardId),
    gcTime: 0,
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const loaded = useRef<BoardData | undefined>(undefined)
  loaded.current = board.data
  const hasData = Boolean(board.data)
  const [readyFor, setReadyFor] = useState<string | null>(null)

  const onBoardChange = useCallback((row: Partial<BoardMeta>) => {
    qc.setQueryData<BoardData>(boardKey(boardId), (d) => {
      if (!d) return d
      const next = { ...d, board: { ...d.board, ...row, viewport: d.board.viewport } }
      return row.title ? withTitle(next, row.title) : next
    })
  }, [qc, boardId])

  useEffect(() => {
    const data = loaded.current
    if (!hasData || !data) return
    let cancelled = false
    let stop: (() => void) | undefined
    startBoardSync(data, { onBoardChange }).then((s) => {
      if (cancelled) { s(); return }
      stop = s
      setReadyFor(boardId)
    })
    return () => {
      cancelled = true
      const s = useBoard.getState()
      const d = loaded.current
      if (stop && d) {
        saveSkeleton(boardId, {
          title: d.board.title,
          viewport: s.viewport,
          rects: Object.values(s.elements).map((e) => ({ x: e.x, y: e.y, w: e.width, h: elementHeight(s, e.id) })),
        })
      }
      setReadyFor(null)
      stop?.()
    }
  }, [boardId, hasData, onBoardChange])

  const rename = useMutation({
    mutationFn: (title: string) => renameBoard(boardId, title),
    onMutate: async (title) => {
      const prev = qc.getQueryData<BoardData>(boardKey(boardId))
      if (prev) qc.setQueryData(boardKey(boardId), withTitle(prev, title))
      return { prev }
    },
    onError: (_e, _t, ctx) => { if (ctx?.prev) qc.setQueryData(boardKey(boardId), ctx.prev) },
  })

  if (board.isError) {
    return (
      <FullPageMessage>
        <div className="flex flex-col items-center gap-3 text-center">
          <p>Could not open this board: {board.error.message}</p>
          <div className="flex gap-2">
            <Button onClick={() => void board.refetch()}>Retry</Button>
            <Link className="inline-flex h-9 items-center rounded-[var(--radius-ui)] px-4 text-[length:var(--text-card)] font-semibold hover:bg-[var(--fill-hover)]" to="/">Go Home</Link>
          </div>
        </div>
      </FullPageMessage>
    )
  }

  const data = board.data
  const path = data?.path ?? []
  const current = path[path.length - 1]
  // Retrying after a failed send still reads as "Saving…"; only a lost connection is "Offline".
  const saveState = !online || status === 'offline' ? 'offline' : status === 'saved' ? 'saved' : 'saving'
  return (
    <div className="flex h-full flex-col">
      <TopBar
        ancestors={path.slice(0, -1).map((p) => ({ id: p.id, title: p.title, to: `/b/${p.id}` }))}
        title={current?.title ?? ''}
        onRename={(t) => rename.mutate(t)}
        saveState={saveState}
        email={session?.user.email ?? ''}
        onSignOut={signOut}
      />
      <OfflineBanner online={online} />
      <div className="min-h-0 flex-1">
        {readyFor === boardId ? <CanvasView /> : <BoardSkeleton key={boardId} boardId={boardId} />}
      </div>
    </div>
  )
}
