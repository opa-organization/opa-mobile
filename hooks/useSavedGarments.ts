import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Garment } from '../types'

interface SavedGarmentRow {
  garment_id: string
  garment: Garment
}

export function useSavedGarments(userId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<SavedGarmentRow[]>(
    'useSavedGarments',
    async () => {
      if (!userId) return { data: [], error: null }
      const { data, error } = await supabase
        .from('prendas_guardadas')
        .select('garment_id, garment:prendas(*, brand:marcas(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      return { data: (data ?? []) as unknown as SavedGarmentRow[], error }
    },
    [userId],
  )

  return { garments: data ?? [], loading, error, refetch }
}
