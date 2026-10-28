import { useEffect, useState } from 'react'
import { CanvasView } from '../canvas/CanvasView'
import { useBoard } from '../canvas/store'
import { OfflineBanner, useOnline } from '../ui'
import { TopBar } from './TopBar'

/** Dev-only, auth-free board shell (top bar + canvas, local state) for visual checks: /dev/board/x */
export function DevBoardPage() {
  const online = useOnline()
  const [title, setTitle] = useState('Untitled board')
  useEffect(() => { useBoard.getState().reset([]) }, [])
  return (
    <div className="flex h-full flex-col">
      <TopBar
        ancestors={[{ id: 'home', title: 'Home', to: '/' }]}
        title={title}
        onRename={setTitle}
        saveState={online ? 'saved' : 'offline'}
        email="miguel@example.com"
        onSignOut={() => {}}
      />
      <OfflineBanner online={online} />
      <div className="min-h-0 flex-1"><CanvasView /></div>
    </div>
  )
}
