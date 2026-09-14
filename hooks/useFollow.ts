import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export function useFollow(targetUserId: string) {
  const session = useAuthStore((s) => s.session)
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session || !targetUserId || session.user.id === targetUserId) return
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', session.user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data))
  }, [targetUserId, session])

  const toggle = useCallback(async () => {
    if (!session || loading) return
    setLoading(true)
    if (following) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('following_id', targetUserId)
      setFollowing(false)
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: session.user.id, following_id: targetUserId })
      if (!error || error.code === '23505') setFollowing(true)
    }
    setLoading(false)
  }, [following, loading, targetUserId, session])

  return { following, toggle }
}
