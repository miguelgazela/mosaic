import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

// Placeholder until the canvas engine lands (P1).
export function BoardPage() {
  const { boardId } = useParams()
  const { signOut } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
        <span>Board {boardId}</span>
        <button className="rounded-md border px-2 py-1" onClick={signOut}>
          Sign out
        </button>
      </header>
      <div className="flex-1" />
    </div>
  )
}
