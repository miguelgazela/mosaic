import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { NotMember } from './NotMember'

export function RequireMember({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const member = useQuery({
    queryKey: ['is_member', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_member')
      if (error) throw error
      return data as boolean
    },
  })

  if (loading || (session && member.isPending)) return <p className="p-6 text-sm">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (member.isError) return <p className="p-6 text-sm">Could not check access: {member.error.message}</p>
  if (!member.data) return <NotMember />
  return <>{children}</>
}
