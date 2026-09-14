import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { GarmentReview } from './useGarmentReviews'

type BrandReview = GarmentReview & { garment?: { name: string } | null }

// "Opiniones recientes" de la Home de marca: últimas reseñas entre TODAS las
// prendas de la marca (no una sola, a diferencia de useGarmentReviews). Recibe
// los garment_id ya resueltos (los trae useBrand) en vez de hacer un join por
// brand_id — reseñas no tiene brand_id propio.
export function useBrandReviews(garmentIds: string[], limit = 3) {
  const key = garmentIds.join(',')

  const { data, loading, error, refetch } = useSupabaseQuery<BrandReview[]>(
    'useBrandReviews',
    async () => {
      if (garmentIds.length === 0) return { data: [], error: null }
      const { data, error } = await supabase
        .from('reseñas')
        .select('id, rating, comment, created_at, user:perfiles(username, avatar_url), garment:prendas(name)')
        .in('garment_id', garmentIds)
        .order('created_at', { ascending: false })
        .limit(limit)
      return { data: (data as unknown as BrandReview[]) ?? [], error }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, limit],
  )

  return { reviews: data ?? [], loading, error, refetch }
}
