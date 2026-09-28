import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import { useAuthStore } from '../store/useAuthStore'

// "Seguido por @x y N más que seguís": cuentas que el viewer sigue y que a su
// vez siguen al perfil visitado (intersección de las dos listas de `follows`).
// Mismo patrón de 2 pasos que useFollowList: primero ids, después perfiles —
// solo se traen los perfiles de las primeras `previewLimit` (los avatares),
// el resto alcanza con el total.
export function useMutualFollowers(targetUserId: string | undefined, previewLimit = 3) {
  const session = useAuthStore((s) => s.session)
  const viewerId = session?.user.id
  const [preview, setPreview] = useState<Profile[]>([])
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!viewerId || !targetUserId || viewerId === targetUserId) {
        setPreview([])
        setTotalCount(0)
        return
      }
      const { data: myFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerId)
      const followingIds = (myFollowing ?? []).map((f) => f.following_id as string)
      if (followingIds.length === 0) {
        if (!cancelled) { setPreview([]); setTotalCount(0) }
        return
      }

      const { data: mutual } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', targetUserId)
        .in('follower_id', followingIds)
      const mutualIds = (mutual ?? []).map((f) => f.follower_id as string)
      if (mutualIds.length === 0) {
        if (!cancelled) { setPreview([]); setTotalCount(0) }
        return
      }

      const { data: profiles } = await supabase
        .from('perfiles')
        .select('*')
        .in('id', mutualIds)
        .order('username', { ascending: true })
        .limit(previewLimit)
      if (!cancelled) {
        setPreview(profiles ?? [])
        setTotalCount(mutualIds.length)
      }
    }
    load()
    return () => { cancelled = true }
  }, [viewerId, targetUserId, previewLimit])

  return { preview, totalCount }
}
