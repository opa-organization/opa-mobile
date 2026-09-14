import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Brand } from '../types'

// Carga la marca de la cuenta logueada (marcas.profile_id = userId).
// Solo devuelve algo para cuentas de marca (perfiles.is_brand = true); para
// usuarios normales no hay fila en `marcas` con su profile_id y brand queda null.
export function useMyBrand(userId?: string) {
  const { data: brand, loading, error, refetch } = useSupabaseQuery<Brand>(
    'useMyBrand',
    async () => {
      if (!userId) return { data: null, error: null }
      return supabase.from('marcas').select('*').eq('profile_id', userId).maybeSingle()
    },
    [userId],
  )

  return { brand, loading, error, refetch }
}
