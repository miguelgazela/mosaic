import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

/** Name from the owner's `members` row; falls back to the email's local part. */
export function useDisplayName(): string {
  const { session } = useAuth()
  const uid = session?.user.id
  const q = useQuery({
    queryKey: ['member_name', uid],
    enabled: Boolean(uid),
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from('members').select('display_name').eq('user_id', uid!).maybeSingle()
      return (data?.display_name as string | null) ?? null
    },
  })
  const email = session?.user.email ?? ''
  return q.data?.trim() || email.split('@')[0]
}
