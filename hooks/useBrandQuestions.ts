import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Question } from '../types'

interface Options {
  limit?: number
}

interface BrandQuestionsData {
  questions: Question[]
  totalCount: number
}

// Preguntas SIN responder de una marca (tabla `preguntas`, nueva). El Home
// pide solo las primeras 3 (limit) + el total real para el badge y el botón
// "ver todas"; app/brand/questions.tsx pide el listado completo (sin limit).
export function useBrandQuestions(brandId?: string | null, { limit }: Options = {}) {
  const { data, loading, error, refetch } = useSupabaseQuery<BrandQuestionsData>(
    'useBrandQuestions',
    async () => {
      if (!brandId) return { data: { questions: [], totalCount: 0 }, error: null }

      let query = supabase
        .from('preguntas')
        .select('*, user:perfiles(username, avatar_url), garment:prendas(name)')
        .eq('brand_id', brandId)
        .is('answer', null)
        .order('created_at', { ascending: false })
      if (limit) query = query.limit(limit)

      const [{ data, error: listError }, { count, error: countError }] = await Promise.all([
        query,
        supabase.from('preguntas').select('*', { count: 'exact', head: true }).eq('brand_id', brandId).is('answer', null),
      ])

      return {
        data: { questions: (data as Question[]) ?? [], totalCount: count ?? 0 },
        error: listError ?? countError,
      }
    },
    [brandId, limit],
  )

  // Responder recarga la lista en vez de editar el estado local a mano — así
  // totalCount y la lista siempre quedan consistentes con lo que hay en la DB,
  // a costa de un round-trip extra en vez de sacar la pregunta al instante.
  async function answer(questionId: string, answerText: string) {
    const { error } = await supabase
      .from('preguntas')
      .update({ answer: answerText, answered_at: new Date().toISOString() })
      .eq('id', questionId)
    if (!error) refetch()
    return { error }
  }

  return {
    questions: data?.questions ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
    answer,
  }
}
