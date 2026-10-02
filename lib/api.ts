import { supabase } from './supabase'

// Cliente para la API Hono en opa-backend (Edge Function `api`). Antes de
// esto, opa-mobile nunca llamaba a la API — todo iba directo a Supabase vía
// RLS. Los endpoints de like/save la usan para tener rate limiting server-side
// (imposible de garantizar solo con RLS) y bloquear cuentas de marca en un
// solo lugar en vez de confiar en que el cliente oculte los botones.
const API_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api`

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status)
  return body
}

export interface CreateGarmentPayload {
  name: string
  description: string | null
  price: number
  category: string | null
  style: string | null
  image_url: string | null
  // Opcional: create-garment.tsx ya no lo manda por acá — los 4 campos de color
  // (color/color_id/color_secundario/color_secundario_id) se escriben juntos
  // directo a Supabase, porque la whitelist del PATCH de la API no conoce las
  // columnas nuevas y escribirlos por separado podría violar el CHECK de
  // "estándar O propio" a mitad de camino.
  color?: string | null
  available_sizes: string[]
  stock_por_talle: Record<string, number> | null
  size_guide_id: string | null
  sale_mode: 'direct' | 'redirect'
  external_url: string | null
}

export interface BrandMetrics {
  likes: number
  saves: number
  outfits_with_brand_garments: number
  note: string
}

export const api = {
  likeOutfit: (outfitId: string) => apiFetch(`/outfits/${outfitId}/like`, { method: 'POST' }),
  unlikeOutfit: (outfitId: string) => apiFetch(`/outfits/${outfitId}/like`, { method: 'DELETE' }),
  saveOutfit: (outfitId: string) => apiFetch(`/outfits/${outfitId}/save`, { method: 'POST' }),
  unsaveOutfit: (outfitId: string) => apiFetch(`/outfits/${outfitId}/save`, { method: 'DELETE' }),
  // Likes + saves agregados sobre outfits que contienen prendas de la marca.
  // Visitas/clics todavía no están: no hay tabla de tracking para eso (ver `note`).
  getBrandMetrics: (): Promise<BrandMetrics> => apiFetch('/brands/me/metrics'),
  // Crea una prenda para la marca autenticada. El endpoint ya vive en
  // opa-backend (pensado originalmente "para opa-web"), pero es un REST
  // genérico gateado por auth+ownership — nada impide llamarlo desde acá.
  createGarment: (payload: CreateGarmentPayload) =>
    apiFetch('/brands/me/prendas', { method: 'POST', body: JSON.stringify(payload) }),
  // Editar prenda (2026-09-07): mismo payload que crear, el endpoint ya soporta
  // los 12 campos (confirmado en vivo antes de construir el form de edición).
  updateGarment: (id: string, payload: CreateGarmentPayload) =>
    apiFetch(`/brands/me/prendas/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
}
