import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Galería de una prenda (`prenda_imagenes`, orden por `sort_order`). Si la
// prenda todavía no tiene filas ahí (no debería pasar tras el backfill, pero
// por si una fila vieja se crea fuera de este flujo) cae a `fallbackUrl`
// (`prendas.image_url`, la portada) como única imagen.
export function useGarmentImages(garmentId?: string, fallbackUrl?: string | null) {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!garmentId) { setImages(fallbackUrl ? [fallbackUrl] : []); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('prenda_imagenes')
      .select('image_url')
      .eq('garment_id', garmentId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const urls = (data ?? []).map((r) => r.image_url as string)
        setImages(urls.length > 0 ? urls : fallbackUrl ? [fallbackUrl] : [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [garmentId, fallbackUrl])

  return { images, loading }
}
