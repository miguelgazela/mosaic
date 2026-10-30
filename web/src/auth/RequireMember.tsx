import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { NotMember } from './NotMember'
import { FullPageMessage } from '../ui/FullPageMessage'

export function RequireMember({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const member = useQuery({
    queryKey: ['is_member', session?.user.id],
    enabled: Boolean(session),
    // Membership doesn't change mid-session. A refetch on window focus that fails (laptop just woke, network not back)
    // used to flip this to the error screen, unmounting the open board and losing edits not yet synced.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_member')
      if (error) throw error
      return data as boolean
    },
  })

  if (loading || (session && member.isPending)) return <FullPageMessage>Loading…</FullPageMessage>
  if (!session) return <Navigate to="/login" replace />
  if (member.isError && member.data === undefined) return <FullPageMessage>Could not check access: {member.error.message}</FullPageMessage>
  if (!member.data) return <NotMember />
  return <>{children}</>
}
