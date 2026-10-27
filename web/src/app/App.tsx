import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../auth/AuthProvider'
import { LoginPage } from '../auth/LoginPage'
import { RequireMember } from '../auth/RequireMember'
import { HomeRedirect } from './HomeRedirect'
import { BoardPage } from './BoardPage'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireMember><HomeRedirect /></RequireMember>} />
            <Route path="/b/:boardId" element={<RequireMember><BoardPage /></RequireMember>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
