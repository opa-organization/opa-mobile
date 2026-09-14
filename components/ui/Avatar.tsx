import React from 'react'
import { View, Text, StyleSheet, ViewStyle, ImageStyle, TextStyle, StyleProp } from 'react-native'
import { Image } from 'expo-image'
import { colors } from '../../constants/colors'
import { radius } from '../../constants/radius'

interface AvatarProps {
  uri?: string | null
  // Texto de referencia para el fallback (username/display_name/nombre de
  // marca) — el componente se queda solo con la primera letra en mayúscula.
  label?: string | null
  size?: number
  // Se aplica tanto sobre la Image (uri presente) como sobre el View del
  // fallback — por eso el tipo laxo: los estilos que de verdad se usan
  // (flexShrink, margin, etc.) son válidos en ambos casos.
  style?: StyleProp<ViewStyle | ImageStyle>
  // Cada pantalla venía con su propia combinación de color/tamaño de letra
  // para el círculo de fallback (ver .claude/documents/meta-2026-09-14-code-audit.md,
  // B1) — se exponen como props en vez de forzar un único estilo visual, así
  // este componente unifica el CÓDIGO (la rama imagen-vs-iniciales) sin
  // cambiar cómo se ve cada pantalla.
  fallbackBackgroundColor?: string
  fallbackTextColor?: string
  fallbackFontSize?: number
  fallbackFontFamily?: string
  fallbackFontWeight?: TextStyle['fontWeight']
}

export function Avatar({
  uri,
  label,
  size = 40,
  style,
  fallbackBackgroundColor = colors.rosaOpaLight,
  fallbackTextColor = colors.rosaOpa,
  fallbackFontSize,
  // Sin default: dejarlo sin pasar (undefined) usa la fuente del sistema a
  // propósito (ej. outfit/[id].tsx). Los llamadores que quieren Merge One lo
  // pasan explícito — así no hay ambigüedad entre "no lo pasé" y "quiero
  // explícitamente que no tenga fontFamily".
  fallbackFontFamily,
  fallbackFontWeight,
}: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: radius.avatar }

  if (uri) {
    return <Image source={{ uri }} style={[dimension, style] as StyleProp<ImageStyle>} contentFit="cover" />
  }

  return (
    <View style={[dimension, styles.fallback, { backgroundColor: fallbackBackgroundColor }, style] as StyleProp<ViewStyle>}>
      <Text
        style={{
          fontSize: fallbackFontSize ?? size * 0.4,
          color: fallbackTextColor,
          fontFamily: fallbackFontFamily,
          fontWeight: fallbackFontWeight,
        }}
      >
        {label?.[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
