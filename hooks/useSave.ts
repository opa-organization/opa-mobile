import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'

export function useSave(outfitId: string, initialCount: number) {
  const session = useAuthStore((s) => s.session)
  const [saved, setSaved] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('outfits_guardados')
      .select('outfit_id')
      .eq('outfit_id', outfitId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [outfitId, session])

  // Contador en vivo: on_outfit_save mantiene outfits.saves_count via trigger
  // en cada INSERT/DELETE de outfits_guardados (de cualquier usuario, no solo
  // el propio). Se toma el valor confirmado de la fila en vez de sumar/restar
  // a mano, así no hay drift entre lo que optimistamos en toggle() y la DB.
  useEffect(() => {
    const channel = supabase
      .channel(`outfit-saves-${outfitId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'outfits', filter: `id=eq.${outfitId}` },
        (payload) => {
          const nextCount = (payload.new as { saves_count?: number }).saves_count
          if (typeof nextCount === 'number') setCount(nextCount)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [outfitId])

  // El toggle pasa por la API (opa-backend) en vez de escribir directo a
  // Supabase — ahí se aplica rate limiting real y se bloquean cuentas de
  // marca server-side (antes solo se ocultaba el botón en el cliente).
  const toggle = useCallback(async () => {
    if (!session || loading) return
    setLoading(true)
    try {
      if (saved) {
        await api.unsaveOutfit(outfitId)
        setSaved(false)
        setCount((c) => Math.max(0, c - 1))
      } else {
        await api.saveOutfit(outfitId)
        setSaved(true)
        setCount((c) => c + 1)
      }
    } catch {
      // Falló (rate limit, red, cuenta de marca, etc.) — se deja el estado como estaba.
    } finally {
      setLoading(false)
    }
  }, [saved, loading, outfitId, session])

  return { saved, count, toggle }
}
