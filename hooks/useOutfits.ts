import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logError } from '../lib/errorLog'
import { Outfit } from '../types'

const GENERIC_ERROR_MESSAGE = 'Uy, algo salió mal. Probá de nuevo.'

const PAGE_SIZE = 10

// Paginación por cursor (keyset), no offset — created_at solo no alcanza como
// cursor porque varios outfits seed comparten el mismo timestamp exacto (mismo
// INSERT); id se usa como desempate para no saltear ni duplicar filas en el
// borde de una página.
type Cursor = { created_at: string; id: string }

export function useOutfits(creatorId?: string) {
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<Cursor | null>(null)

  useEffect(() => {
    fetchPage(null)
  }, [creatorId])

  async function fetchPage(cursor: Cursor | null) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    try {
      let query = supabase
        .from('outfits')
        .select(`
          *,
          creator:perfiles(*),
          garments:outfit_items(*, garment:prendas(*, brand:marcas(*)))
        `)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE)

      if (creatorId) query = query.eq('creator_id', creatorId)
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      }

      const { data, error } = await query
      if (error) throw error
      const page = data ?? []

      setOutfits((prev) => (cursor ? [...prev, ...page] : page))
      setHasMore(page.length === PAGE_SIZE)
      cursorRef.current = page.length > 0
        ? { created_at: page[page.length - 1].created_at, id: page[page.length - 1].id }
        : cursor
    } catch (e: any) {
      setError(GENERIC_ERROR_MESSAGE)
      logError('useOutfits', e.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    fetchPage(cursorRef.current)
  }, [loading, loadingMore, hasMore, creatorId])

  const refetch = useCallback(() => {
    cursorRef.current = null
    setHasMore(true)
    fetchPage(null)
  }, [creatorId])

  return { outfits, loading, loadingMore, hasMore, error, loadMore, refetch }
}
