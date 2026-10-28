import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../auth/AuthProvider'
import { LoginPage } from '../auth/LoginPage'
import { RequireMember } from '../auth/RequireMember'
import { HomeRedirect } from './HomeRedirect'
import { BoardPage } from './BoardPage'
import { DevCanvasPage } from './DevCanvasPage'
import { DevBoardPage } from './DevBoardPage'
import { NotFoundPage } from './NotFoundPage'
import { NotMember } from '../auth/NotMember'
import { ToastHost } from '../ui'
import { useFlushAllOnStart } from '../lib/sync/useFlushAllOnStart'

const queryClient = new QueryClient()

function SyncBoot() {
  useFlushAllOnStart()
  return null
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncBoot />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireMember><HomeRedirect /></RequireMember>} />
            <Route path="/b/:boardId" element={<RequireMember><BoardPage /></RequireMember>} />
            {import.meta.env.DEV && <Route path="/dev/canvas" element={<DevCanvasPage />} />}
            {import.meta.env.DEV && <Route path="/dev/board/:boardId" element={<DevBoardPage />} />}
            {import.meta.env.DEV && <Route path="/dev/not-member" element={<NotMember />} />}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <ToastHost />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
