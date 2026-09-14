import { supabase } from './supabase'

const BUCKET = 'assets'

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function extensionFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  }
  return map[mime] ?? null
}

function guessExtension(uri: string): string {
  const match = uri.match(/\.(\w+)(?:\?|#|$)/)
  return match ? match[1].toLowerCase() : 'jpg'
}

// Sube la imagen de una prenda al bucket público `assets`, siguiendo la misma
// convención de naming que ya documenta database-2026-06-06-schema-and-seed.md
// (`prendas/{marca}/{prenda}_{marca}_{coleccion}.png`) — acá "coleccion" es un
// timestamp porque no hay concepto de colección en el formulario.
export async function uploadGarmentImage(localUri: string, brandName: string, garmentName: string, index?: number): Promise<string> {
  const response = await fetch(localUri)
  const blob = await response.blob()

  // En web, `localUri` suele ser un blob: URL sin extensión real en el path —
  // el mimeType del propio blob (que sí viaja con el archivo elegido) es más
  // confiable que parsear la URI para decidir la extensión.
  const ext = extensionFromMime(blob.type) ?? guessExtension(localUri)
  // `index` desambigua cuando se suben varias imágenes de la misma prenda en
  // el mismo submit (el timestamp de `Date.now()` en teoría podría repetirse
  // si dos uploads caen en el mismo milisegundo).
  const suffix = index != null ? `_${index}` : ''
  const path = `prendas/${slugify(brandName)}/${slugify(garmentName)}_${slugify(brandName)}_${Date.now()}${suffix}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || `image/${ext}`,
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
