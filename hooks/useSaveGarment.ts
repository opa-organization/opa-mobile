import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

// Guardar una prenda en favoritos para comprar más tarde (`prendas_guardadas`).
// Mismo patrón optimista que useLike/useSave (outfits).
export function useSaveGarment(garmentId?: string) {
  const session = useAuthStore((s) => s.session)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!garmentId || !session) { setSaved(false); return }
    supabase
      .from('prendas_guardadas')
      .select('id')
      .eq('garment_id', garmentId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [garmentId, session])

  const toggle = useCallback(async () => {
    if (!garmentId || !session || loading) return
    setLoading(true)
    if (saved) {
      setSaved(false)
      await supabase
        .from('prendas_guardadas')
        .delete()
        .eq('garment_id', garmentId)
        .eq('user_id', session.user.id)
    } else {
      setSaved(true)
      const { error } = await supabase
        .from('prendas_guardadas')
        .insert({ garment_id: garmentId, user_id: session.user.id })
      if (error && error.code !== '23505') setSaved(false)
    }
    setLoading(false)
  }, [saved, loading, garmentId, session])

  return { saved, toggle, requiresAuth: !session }
}
