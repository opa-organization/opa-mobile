// Paleta estandarizada de colores para `prendas.color` — reemplaza el texto libre
// que permitía valores como "cognac" o "Negro con mucho texto también". Mismo set
// que el CHECK constraint `prendas_color_check` en la DB (ver migración
// standardize_prendas_color_palette, 2026-09-14): si se agrega un color acá, hay
// que agregarlo también al CHECK constraint, o el guardado va a fallar.
export const GARMENT_COLORS = [
  'Negro', 'Blanco', 'Gris', 'Beige', 'Marrón',
  'Rojo', 'Naranja', 'Amarillo', 'Verde', 'Azul',
  'Celeste', 'Violeta', 'Rosa', 'Bordo', 'Dorado',
  'Plateado', 'Multicolor',
] as const
