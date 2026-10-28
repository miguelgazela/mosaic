import { useEffect, useRef } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { upsertElements } from './boardApi'
import { flushAllQueued } from './flushAll'
import { idbQueuedBoards } from './idbStore'

/** Once per signed-in session: send queued edits for every board in IndexedDB (waits for a connection). */
export function useFlushAllOnStart(): void {
  const { session } = useAuth()
  const userId = session?.user.id
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!userId || done.current === userId) return
    const run = () => {
      done.current = userId
      void flushAllQueued(idbQueuedBoards, upsertElements).catch(() => {})
    }
    if (navigator.onLine) { run(); return }
    window.addEventListener('online', run, { once: true })
    return () => window.removeEventListener('online', run)
  }, [userId])
}
