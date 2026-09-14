import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'

// Galería de una prenda (`prenda_imagenes`, orden por `sort_order`). Si la
// prenda todavía no tiene filas ahí (no debería pasar tras el backfill, pero
// por si una fila vieja se crea fuera de este flujo) cae a `fallbackUrl`
// (`prendas.image_url`, la portada) como única imagen.
export function useGarmentImages(garmentId?: string, fallbackUrl?: string | null) {
  const { data, loading, error, refetch } = useSupabaseQuery<string[]>(
    'useGarmentImages',
    async () => {
      if (!garmentId) return { data: fallbackUrl ? [fallbackUrl] : [], error: null }
      const { data, error } = await supabase
        .from('prenda_imagenes')
        .select('image_url')
        .eq('garment_id', garmentId)
        .order('sort_order', { ascending: true })
      const urls = (data ?? []).map((r) => r.image_url as string)
      return { data: urls.length > 0 ? urls : fallbackUrl ? [fallbackUrl] : [], error }
    },
    [garmentId, fallbackUrl],
  )

  // Si la query real falló, `data` queda null — igual mostramos `fallbackUrl`
  // (la portada) en vez de una galería vacía, la misma degradación graciosa
  // que ya hacía la versión anterior de este hook sin querer (Supabase
  // devuelve `data: null` en error, que el código viejo trataba como "sin
  // filas" y caía al fallback).
  return { images: data ?? (fallbackUrl ? [fallbackUrl] : []), loading, error, refetch }
}
