import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { SizeGuide, SizeGuideEntry } from '../types'

interface SizeGuideData {
  guide: SizeGuide | null
  entries: SizeGuideEntry[]
}

export function useSizeGuide(guideId?: string | null) {
  const { data, loading, error, refetch } = useSupabaseQuery<SizeGuideData>(
    'useSizeGuide',
    async () => {
      if (!guideId) return { data: { guide: null, entries: [] }, error: null }
      const [guideRes, entriesRes] = await Promise.all([
        supabase.from('size_guides').select('*').eq('id', guideId).maybeSingle(),
        supabase.from('size_guide_entries').select('*').eq('guide_id', guideId).order('sort_order'),
      ])
      return {
        data: {
          guide: guideRes.data as SizeGuide | null,
          entries: (entriesRes.data ?? []) as SizeGuideEntry[],
        },
        error: guideRes.error ?? entriesRes.error,
      }
    },
    [guideId],
  )

  return { guide: data?.guide ?? null, entries: data?.entries ?? [], loading, error, refetch }
}
