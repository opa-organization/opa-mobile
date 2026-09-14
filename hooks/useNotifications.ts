import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AppNotification } from '../types'

// Lista de notificaciones del usuario logueado + contador de no leídas.
// Alimentada por triggers de DB (ver migración create_notificaciones_system) —
// este hook solo lee y marca como leída, nunca inserta. Con suscripción
// realtime (mismo patrón que useLike/useSave) para que la campanita y la
// lista se actualicen en vivo sin refetch manual cuando llega una notificación
// nueva o se marca como leída desde otra pestaña/dispositivo.
export function useNotifications(userId?: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) { setNotifications([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('notificaciones')
      .select(`
        *,
        actor:perfiles!notificaciones_actor_id_fkey(id, username, display_name, avatar_url, is_brand),
        outfit:outfits(id, title, cover_image_url),
        garment:prendas(id, name, brand_id)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications((data as AppNotification[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!userId) return
    // Defensivo: la campanita vive en el header de Home y puede quedar
    // montada/desmontada rápido durante una transición de navegación (ej.
    // justo después del login/signup, mientras el router todavía resuelve a
    // qué pantalla ir) — si ya existe un canal con este mismo topic sin haber
    // terminado de limpiarse, sacarlo primero. Si no, un segundo `.on()`
    // sobre el canal viejo (ya suscripto) tira "cannot add postgres_changes
    // callbacks ... after subscribe()".
    const topic = `notificaciones-${userId}`
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones', filter: `recipient_id=eq.${userId}` },
        () => { fetchAll() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchAll])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notificaciones').update({ read: true }).eq('id', id).eq('read', false)
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || !userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase.from('notificaciones').update({ read: true }).eq('recipient_id', userId).eq('read', false)
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchAll }
}
