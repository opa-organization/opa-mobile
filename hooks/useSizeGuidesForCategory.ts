import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { SizeGuide } from '../types'

// prendas.category (torso/piernas/calzado/extras) usa otro vocabulario que
// size_guides.category (tops/bottoms/calzado/extras) — mismo mapeo que ya usa
// measurementCols() en app/product/[id].tsx.
function toGuideCategory(category: string): string {
  if (category === 'torso') return 'tops'
  if (category === 'piernas') return 'bottoms'
  return category
}

// Guías disponibles para una categoría de prenda: las 10 default de OPA
// (brand_id null) + las propias de la marca si tuviera alguna creada.
export function useSizeGuidesForCategory(category: string | null, brandId?: string | null) {
  const { data, loading, error, refetch } = useSupabaseQuery<SizeGuide[]>(
    'useSizeGuidesForCategory',
    async () => {
      if (!category) return { data: [], error: null }
      const guideCategory = toGuideCategory(category)
      let query = supabase.from('size_guides').select('*').eq('category', guideCategory)
      query = brandId ? query.or(`brand_id.is.null,brand_id.eq.${brandId}`) : query.is('brand_id', null)
      const { data, error } = await query.order('name')
      return { data: (data ?? []) as SizeGuide[], error }
    },
    [category, brandId],
  )

  return { guides: data ?? [], loading, error, refetch }
}
