import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } }, loading: false }) }))

import { RequireMember } from './RequireMember'

describe('RequireMember', () => {
  it('keeps the page mounted when a later membership check fails or the window refocuses', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    const mounts = { n: 0, unmounts: 0 }
    function Child() {
      useEffect(() => { mounts.n++; return () => { mounts.unmounts++ } }, [])
      return <p>board</p>
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<QueryClientProvider client={qc}><MemoryRouter><RequireMember><Child /></RequireMember></MemoryRouter></QueryClientProvider>)
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(host.textContent).toBe('board')

    rpc.mockResolvedValue({ data: null, error: new Error('network down') })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      await qc.refetchQueries({ queryKey: ['is_member'] }).catch(() => {})
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(host.textContent).toBe('board')
    expect(mounts.unmounts).toBe(0)
    act(() => root.unmount())
  })
})
