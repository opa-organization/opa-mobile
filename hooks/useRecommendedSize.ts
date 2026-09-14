import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

interface RecommendedSize {
  size_label: string
  fit_preference: 'ajustado' | 'justo' | 'holgado'
}

export function useRecommendedSize(guideId?: string | null) {
  const session = useAuthStore((s) => s.session)

  const { data: recommendation, loading, error, refetch } = useSupabaseQuery<RecommendedSize>(
    'useRecommendedSize',
    async () => {
      if (!guideId || !session) return { data: null, error: null }
      const { data, error } = await supabase.rpc('get_recommended_size', {
        guide_id: guideId,
        p_user_id: session.user.id,
      })
      return { data: data ?? null, error }
    },
    [guideId, session],
  )

  return { recommendation, loading, error, refetch }
}
