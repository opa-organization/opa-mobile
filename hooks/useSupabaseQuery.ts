import { useCallback, useEffect, useState, DependencyList } from 'react'
import { logError } from '../lib/errorLog'

type QueryResult<T> = { data: T | null; error: { message: string } | null }

const GENERIC_ERROR_MESSAGE = 'Uy, algo salió mal. Probá de nuevo.'

// Hook genérico de lectura contra Supabase: data/loading/error/refetch, con
// cancelación (una respuesta vieja no pisa una más nueva si `deps` cambia
// antes de que resuelva) y logging automático a `error_logs` cuando falla de
// verdad (no cuando simplemente no hay datos). Reemplaza el patrón
// "useState + useEffect + try/finally" que estaba copiado en ~15 hooks sin
// que casi ninguno chequeara `error` (ver
// .claude/documents/meta-2026-09-14-code-audit.md, B5).
//
// `queryFn` puede ser una sola query de Supabase, o una función que combine
// varias (ej. useBrand) — solo tiene que devolver `{ data, error }`. Si un
// hook necesita un parámetro que todavía no está listo (ej. `userId`
// undefined), que `queryFn` lo chequee y devuelva `{ data: null, error: null }`
// en ese caso, en vez de intentar la query.
export function useSupabaseQuery<T>(
  source: string,
  queryFn: () => Promise<QueryResult<T>>,
  deps: DependencyList,
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    queryFn().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setError(GENERIC_ERROR_MESSAGE)
        logError(source, error.message)
      } else {
        setData(data)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch }
}
