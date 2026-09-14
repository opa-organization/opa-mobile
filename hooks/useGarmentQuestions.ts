import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Question } from '../types'

// Q&A público de una prenda, estilo Mercado Libre: todas las preguntas hechas
// sobre ESA prenda (respondidas o no), visibles para cualquiera que visite la
// publicación — no solo para quien preguntó o la marca dueña. RLS pública
// habilitada para filas con garment_id (migración `public_read_garment_questions`).
export function useGarmentQuestions(garmentId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<Question[]>(
    'useGarmentQuestions',
    async () => {
      if (!garmentId) return { data: [], error: null }
      const { data, error } = await supabase
        .from('preguntas')
        .select('*, user:perfiles(username, avatar_url)')
        .eq('garment_id', garmentId)
        .order('created_at', { ascending: false })
      return { data: (data as Question[]) ?? [], error }
    },
    [garmentId],
  )

  return { questions: data ?? [], loading, error, refetch }
}
