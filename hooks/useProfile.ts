import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'

export function useProfile(userId?: string) {
  const { data: profile, loading, error, refetch } = useSupabaseQuery<Profile>(
    'useProfile',
    async () => {
      if (!userId) return { data: null, error: null }
      return supabase.from('perfiles').select('*').eq('id', userId).single()
    },
    [userId],
  )

  return { profile, loading, error, refetch }
}
