import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

// IDs de `marcas` que el usuario autenticado sigue. El follow de una marca usa
// la misma tabla `follows` que el follow entre usuarios (following_id = marcas.profile_id),
// así que hace falta un segundo paso para resolver profile_id → marcas.id.
export function useFollowedBrandIds() {
  const session = useAuthStore((s) => s.session)
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setBrandIds([])
      setLoading(false)
      return
    }
    fetchFollowedBrandIds(session.user.id)
  }, [session])

  async function fetchFollowedBrandIds(userId: string) {
    setLoading(true)
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    const followingIds = (follows ?? []).map((f) => f.following_id)
    if (followingIds.length === 0) {
      setBrandIds([])
      setLoading(false)
      return
    }

    const { data: marcas } = await supabase
      .from('marcas')
      .select('id')
      .in('profile_id', followingIds)

    setBrandIds((marcas ?? []).map((m) => m.id))
    setLoading(false)
  }

  return { brandIds, loading }
}
