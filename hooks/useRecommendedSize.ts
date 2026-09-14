import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

interface RecommendedSize {
  size_label: string
  fit_preference: 'ajustado' | 'justo' | 'holgado'
}

export function useRecommendedSize(guideId?: string | null) {
  const session = useAuthStore((s) => s.session)
  const [recommendation, setRecommendation] = useState<RecommendedSize | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!guideId || !session) { setRecommendation(null); return }
    fetchRecommendation(guideId, session.user.id)
  }, [guideId, session])

  async function fetchRecommendation(guide_id: string, p_user_id: string) {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('get_recommended_size', { guide_id, p_user_id })
      setRecommendation(data ?? null)
    } finally {
      setLoading(false)
    }
  }

  return { recommendation, loading }
}
