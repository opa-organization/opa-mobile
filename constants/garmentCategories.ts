// Categorías de prenda (columna `prendas.category`, mismo dominio que
// `outfit_items.slot`) — vocabulario controlado, no texto libre. Antes estaba
// redefinido de forma independiente en 4 archivos (app/outfit/[id].tsx,
// app/(tabs)/wardrobe.tsx, app/(tabs)/search.tsx, app/brand/create-garment.tsx);
// unificado acá para que no puedan divergir. Los consumidores que necesitan un
// chip extra de "ver todas" (wardrobe, search) lo agregan ellos mismos con su
// propia key ('all'/'todo') porque no es una categoría real de la DB.
export const GARMENT_CATEGORIES: { key: 'torso' | 'piernas' | 'calzado' | 'extras'; label: string }[] = [
  { key: 'torso', label: 'Torso' },
  { key: 'piernas', label: 'Piernas' },
  { key: 'calzado', label: 'Calzado' },
  { key: 'extras', label: 'Extras' },
]
