import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserMeasurements } from '../types'
import { useAuthStore } from '../store/useAuthStore'

export function useUserMeasurements() {
  const session = useAuthStore((s) => s.session)
  const [measurements, setMeasurements] = useState<UserMeasurements | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    fetchMeasurements(session.user.id)
  }, [session])

  async function fetchMeasurements(userId: string) {
    try {
      const { data } = await supabase
        .from('user_measurements')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      setMeasurements(data as UserMeasurements | null)
    } finally {
      setLoading(false)
    }
  }

  const save = useCallback(async (values: Partial<Omit<UserMeasurements, 'id' | 'user_id' | 'updated_at'>>) => {
    if (!session) return
    const { data, error } = await supabase
      .from('user_measurements')
      .upsert({ user_id: session.user.id, ...values }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()
    if (!error && data) setMeasurements(data as UserMeasurements)
    return error
  }, [session])

  return { measurements, loading, save }
}
