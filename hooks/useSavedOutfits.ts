import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Outfit } from '../types'

export function useSavedOutfits(userId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<Outfit[]>(
    'useSavedOutfits',
    async () => {
      if (!userId) return { data: [], error: null }
      const { data, error } = await supabase
        .from('outfits_guardados')
        .select('outfit:outfits(*, creator:perfiles(*), garments:outfit_items(*, garment:prendas(*, brand:marcas(*))))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      const outfits = (data?.map((row: any) => row.outfit).filter(Boolean) ?? []) as Outfit[]
      return { data: outfits, error }
    },
    [userId],
  )

  return { outfits: data ?? [], loading, error, refetch }
}
