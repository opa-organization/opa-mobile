import { useEffect, useState } from 'react'
import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { Brand, Garment, Outfit } from '../types'

interface BrandData {
  brand: Brand | null
  garments: Garment[]   // catálogo (prendas de la marca)
  outfits: Outfit[]     // outfits publicados por la cuenta de la marca
  followersCount: number
}

// Carga todo lo que necesita el perfil público de una marca.
// Nota: outfits y seguidores dependen de marcas.profile_id (la cuenta Auth de la
// marca). Mientras el onboarding de marcas no exista, profile_id es null y ambos
// quedan vacíos — el catálogo (prendas por brand_id) sí tiene datos reales.
export function useBrand(brandId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<BrandData>(
    'useBrand',
    async () => {
      if (!brandId) return { data: { brand: null, garments: [], outfits: [], followersCount: 0 }, error: null }

      const { data: brandRow, error: brandError } = await supabase
        .from('marcas')
        .select('*')
        .eq('id', brandId)
        .single()
      if (brandError) return { data: null, error: brandError }

      // Catálogo (independiente de profile_id) puede pedirse en paralelo con
      // el resto — solo outfits/seguidores dependen del resultado de arriba.
      const profileId = brandRow?.profile_id
      const [prendasRes, outfitsRes, followersRes] = await Promise.all([
        supabase.from('prendas').select('*, brand:marcas(*)').eq('brand_id', brandId).order('created_at', { ascending: false }),
        profileId
          ? supabase.from('outfits').select('*, creator:perfiles(*), garments:outfit_items(*, garment:prendas(*, brand:marcas(*)))').eq('creator_id', profileId).order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        profileId
          ? supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId)
          : Promise.resolve({ count: 0, error: null }),
      ])

      const error = prendasRes.error ?? outfitsRes.error ?? (followersRes as { error: any }).error
      return {
        data: {
          brand: brandRow,
          garments: (prendasRes.data as Garment[]) ?? [],
          outfits: (outfitsRes.data as Outfit[]) ?? [],
          followersCount: (followersRes as { count: number | null }).count ?? 0,
        },
        error,
      }
    },
    [brandId],
  )

  // Ajuste optimista del contador tras Seguir/Siguiendo — evita depender de un
  // refetch completo (mismo patrón que el optimistic update de useLike/useSave).
  // Vive en un estado propio en vez de derivar de `data`, y se resetea cada vez
  // que llega un `data` nuevo (fetch inicial o refetch real) para no arrastrar
  // un ajuste viejo sobre un conteo que la DB ya trae actualizado.
  const [followersAdjustment, setFollowersAdjustment] = useState(0)
  useEffect(() => { setFollowersAdjustment(0) }, [data])
  function adjustFollowersCount(delta: number) {
    setFollowersAdjustment((prev) => prev + delta)
  }

  return {
    brand: data?.brand ?? null,
    garments: data?.garments ?? [],
    outfits: data?.outfits ?? [],
    followersCount: Math.max(0, (data?.followersCount ?? 0) + followersAdjustment),
    adjustFollowersCount,
    loading,
    error,
    refetch,
  }
}
