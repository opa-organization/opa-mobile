import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'

export function useLike(outfitId: string, initialCount: number) {
  const session = useAuthStore((s) => s.session)
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('outfit_likes')
      .select('outfit_id')
      .eq('outfit_id', outfitId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [outfitId, session])

  // Contador en vivo: on_outfit_like mantiene outfits.likes_count via trigger
  // en cada INSERT/DELETE de outfit_likes (de cualquier usuario, no solo el
  // propio). Se toma el valor confirmado de la fila en vez de sumar/restar a
  // mano, así no hay drift entre lo que optimistamos localmente en toggle()
  // y lo que terminó quedando en la DB.
  useEffect(() => {
    // Defensivo: si un canal con este mismo topic quedó suscripto de una
    // instancia anterior del componente (ej. Fast Refresh mientras la página
    // ya estaba montada, o un remontaje rápido del FlatList) sacarlo antes de
    // crear uno nuevo — si no, `.on()` sobre un canal ya suscripto tira
    // "cannot add postgres_changes callbacks ... after subscribe()" (mismo
    // bug ya encontrado y arreglado con este mismo fix en useNotifications.ts).
    const topic = `outfit-likes-${outfitId}`
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'outfits', filter: `id=eq.${outfitId}` },
        (payload) => {
          const nextCount = (payload.new as { likes_count?: number }).likes_count
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
      if (liked) {
        await api.unlikeOutfit(outfitId)
        setLiked(false)
        setCount((c) => Math.max(0, c - 1))
      } else {
        await api.likeOutfit(outfitId)
        setLiked(true)
        setCount((c) => c + 1)
      }
    } catch {
      // Falló (rate limit, red, cuenta de marca, etc.) — se deja el estado como estaba.
    } finally {
      setLoading(false)
    }
  }, [liked, loading, outfitId, session])

  return { liked, count, toggle }
}
