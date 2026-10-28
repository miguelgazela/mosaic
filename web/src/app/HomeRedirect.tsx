import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { FullPageMessage } from '../ui/FullPageMessage'

export function HomeRedirect() {
  const home = useQuery({
    queryKey: ['home_board'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ensure_home')
      if (error) throw error
      return data as string
    },
  })
  if (home.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (home.isError) return <FullPageMessage>Could not open Home: {home.error.message}</FullPageMessage>
  return <Navigate to={`/b/${home.data}`} replace />
}
