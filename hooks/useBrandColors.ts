import { useSupabaseQuery } from './useSupabaseQuery'
import { supabase } from '../lib/supabase'
import { logError } from '../lib/errorLog'
import { GARMENT_COLORS } from '../constants/garmentColors'
import type { BrandColor } from '../types'

export const BRAND_COLOR_NAME_MAX_LENGTH = 30

type BrandColorsData = { colors: BrandColor[]; usage: Record<string, number> }

// Paleta propia de una marca (`marca_colores`) + cuántas prendas usan cada color
// (como principal o secundario). El uso hace falta para bloquear el borrado en la
// UI antes de intentarlo — la DB igual lo bloquea por su cuenta (FK con
// ON DELETE RESTRICT), así que el chequeo de acá es solo para avisar mejor.
// Las escrituras van directo a Supabase por RLS (owner-scoped), no por la API
// Hono — mismo patrón que `prenda_imagenes`/`descontinuada`.
export function useBrandColors(brandId?: string) {
  const { data, loading, error, refetch } = useSupabaseQuery<BrandColorsData>(
    'useBrandColors',
    async () => {
      if (!brandId) return { data: { colors: [], usage: {} }, error: null }
      const [colorsRes, usageRes] = await Promise.all([
        supabase.from('marca_colores').select('*').eq('brand_id', brandId)
          .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('prendas').select('color_id, color_secundario_id').eq('brand_id', brandId)
          .or('color_id.not.is.null,color_secundario_id.not.is.null'),
      ])
      const usage: Record<string, number> = {}
      for (const row of usageRes.data ?? []) {
        for (const id of [row.color_id, row.color_secundario_id]) {
          if (id) usage[id] = (usage[id] ?? 0) + 1
        }
      }
      return {
        data: { colors: (colorsRes.data ?? []) as BrandColor[], usage },
        error: colorsRes.error ?? usageRes.error,
      }
    },
    [brandId],
  )

  const brandColors = data?.colors ?? []
  const usage = data?.usage ?? {}

  function validateName(name: string, exceptId?: string): string | null {
    const clean = name.trim()
    if (!clean) return 'Ponele un nombre al color.'
    if (clean.length > BRAND_COLOR_NAME_MAX_LENGTH) return `El nombre puede tener hasta ${BRAND_COLOR_NAME_MAX_LENGTH} caracteres.`
    const lower = clean.toLowerCase()
    if (GARMENT_COLORS.some((c) => c.value.toLowerCase() === lower)) {
      return `"${clean}" ya es un color estándar, elegilo de la lista.`
    }
    if (brandColors.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === lower)) {
      return `Ya tenés un color llamado "${clean}".`
    }
    return null
  }

  function friendlyError(source: string, err: { code?: string; message: string }): Error {
    if (err.code === '23505') return new Error('Ya tenés un color con ese nombre.')
    if (err.code === '23503') return new Error('No se puede borrar: hay prendas que usan este color.')
    logError(source, err.message)
    return new Error('No se pudo guardar el color. Probá de nuevo.')
  }

  async function create(name: string, hex: string): Promise<BrandColor> {
    if (!brandId) throw new Error('No se encontró tu marca.')
    const nameError = validateName(name)
    if (nameError) throw new Error(nameError)
    const nextOrder = brandColors.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1
    const { data: created, error: err } = await supabase
      .from('marca_colores')
      .insert({ brand_id: brandId, name: name.trim(), hex: hex.toUpperCase(), sort_order: nextOrder })
      .select('*')
      .single()
    if (err || !created) throw friendlyError('useBrandColors.create', err ?? { message: 'sin fila' })
    refetch()
    return created as BrandColor
  }

  async function update(id: string, name: string, hex: string) {
    const nameError = validateName(name, id)
    if (nameError) throw new Error(nameError)
    const { error: err } = await supabase
      .from('marca_colores')
      .update({ name: name.trim(), hex: hex.toUpperCase() })
      .eq('id', id)
    if (err) throw friendlyError('useBrandColors.update', err)
    refetch()
  }

  async function remove(id: string) {
    if ((usage[id] ?? 0) > 0) throw new Error('No se puede borrar: hay prendas que usan este color.')
    const { error: err } = await supabase.from('marca_colores').delete().eq('id', id)
    if (err) throw friendlyError('useBrandColors.remove', err)
    refetch()
  }

  // Sube/baja un color un lugar en la lista. Reescribe el sort_order de toda la
  // lista (0..n-1) en vez de intercambiar solo dos valores, así se autocorrige si
  // alguna vez quedaron órdenes repetidos o con huecos.
  async function move(id: string, direction: -1 | 1) {
    const index = brandColors.findIndex((c) => c.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= brandColors.length) return
    const reordered = [...brandColors]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const results = await Promise.all(
      reordered.map((c, i) =>
        c.sort_order === i ? null : supabase.from('marca_colores').update({ sort_order: i }).eq('id', c.id)
      )
    )
    const failed = results.find((r) => r?.error)
    refetch()
    if (failed?.error) throw friendlyError('useBrandColors.move', failed.error)
  }

  return { brandColors, usage, loading, error, refetch, validateName, create, update, remove, move }
}
