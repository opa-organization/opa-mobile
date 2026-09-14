import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { WardrobeItem } from '../types'

export function useWardrobe(userId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<WardrobeItem[]>(
    'useWardrobe',
    async () => {
      if (!userId) return { data: [], error: null }
      const { data, error } = await supabase
        .from('prendas_armario')
        .select('*, garment:prendas(*, brand:marcas(*))')
        .eq('user_id', userId)
      return { data: (data ?? []) as WardrobeItem[], error }
    },
    [userId],
  )

  return { items: data ?? [], loading, error, refetch }
}
