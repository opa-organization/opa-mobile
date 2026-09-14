// Deduplica una lista de strings ignorando mayúsculas, quedándose con la primera
// variante de casing que aparece. Para listas de valores reales de texto libre en
// la DB (ej. `prendas.style`, `outfits.style`/`occasion`) que no tienen enum ni
// CHECK constraint — usado en `app/(tabs)/search.tsx` y `app/brand/create-garment.tsx`.
export function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of values) {
    const v = raw?.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (!seen.has(key)) seen.set(key, v)
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'))
}

// Iniciales para el fallback de un avatar (2 letras) cuando no hay foto —
// antes copiada igual en app/(tabs)/index.tsx, app/notifications.tsx y
// app/brand/questions.tsx.
export function initials(name?: string | null): string {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}
