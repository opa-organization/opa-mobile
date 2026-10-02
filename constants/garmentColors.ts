// Paleta estandarizada de colores para `prendas.color` — reemplaza el texto libre
// que permitía valores como "cognac" o "Negro con mucho texto también". El `hex`
// es solo para el circulito de swatch en el selector (`app/brand/create-garment.tsx`,
// `app/(tabs)/search.tsx`) — no se guarda en la DB, ahí se guarda `value`.
//
// Desde 2026-10-02 "Otro" ya no es texto libre: crea un color propio de la marca
// (tabla `marca_colores`, con nombre + hex) que se referencia por id en
// `prendas.color_id`/`color_secundario_id`. Por eso `prendas.color` y
// `prendas.color_secundario` vuelven a ser una lista cerrada en la DB (CHECK
// `prendas_color_check`/`prendas_color_secundario_check`, migración
// `brand_custom_colors_and_secondary_color`). Si se agrega o saca un color de
// acá, hay que actualizar también esos dos CHECK.
export const GARMENT_COLORS: { value: string; hex: string }[] = [
  { value: 'Negro', hex: '#000000' },
  { value: 'Blanco', hex: '#FFFFFF' },
  { value: 'Gris', hex: '#9E9E9E' },
  { value: 'Beige', hex: '#D8C3A5' },
  { value: 'Marrón', hex: '#6B4226' },
  { value: 'Rojo', hex: '#E53935' },
  { value: 'Naranja', hex: '#FB8C00' },
  { value: 'Amarillo', hex: '#FDD835' },
  { value: 'Verde', hex: '#43A047' },
  { value: 'Azul', hex: '#1E88E5' },
  { value: 'Celeste', hex: '#4FC3F7' },
  { value: 'Violeta', hex: '#8E24AA' },
  { value: 'Rosa', hex: '#EC407A' },
  { value: 'Bordo', hex: '#7B1E3A' },
  { value: 'Dorado', hex: '#D4AF37' },
  { value: 'Plateado', hex: '#C0C0C0' },
]

// Mismo set de arriba, como mapa value→hex — conveniente para pintar el circulito
// de swatch en un selector cuando ya se tiene el nombre del color a mano.
export const GARMENT_COLOR_HEX: Record<string, string> = Object.fromEntries(
  GARMENT_COLORS.map((c) => [c.value, c.hex])
)
