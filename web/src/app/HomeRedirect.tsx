import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function HomeRedirect() {
  const home = useQuery({
    queryKey: ['home_board'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ensure_home')
      if (error) throw error
      return data as string
    },
  })
  if (home.isPending) return <p className="p-6 text-sm">Loading…</p>
  if (home.isError) return <p className="p-6 text-sm">Could not open Home: {home.error.message}</p>
  return <Navigate to={`/b/${home.data}`} replace />
}
