import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { CanvasView } from '../canvas/CanvasView'
import { useBoard } from '../canvas/store'

// P1: canvas is local only; P2 loads/saves elements per board.
export function BoardPage() {
  const { boardId } = useParams()
  const { signOut } = useAuth()
  useEffect(() => {
    useBoard.getState().reset([])
  }, [boardId])
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
        <span>Board {boardId}</span>
        <button className="rounded-md border px-2 py-1" onClick={signOut}>
          Sign out
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <CanvasView />
      </div>
    </div>
  )
}
