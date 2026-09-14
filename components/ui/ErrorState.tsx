import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { radius } from '../../constants/radius'
import { spacing } from '../../constants/spacing'

interface ErrorStateProps {
  onRetry?: () => void
  style?: object
  // 'dark' es para los 3 scrolls full-bleed de outfits (fondo negro:
  // app/(tabs)/outfits.tsx, app/user-outfits.tsx, app/saved-outfits.tsx) — el
  // texto gris oscuro del default sería casi invisible ahí.
  variant?: 'light' | 'dark'
}

// Mensaje de error genérico para cuando una query de Supabase falla de
// verdad (no cuando simplemente no hay datos) — pareja de `useSupabaseQuery`.
// Mismo mensaje en toda la app a propósito, para no tener que redactar un
// texto distinto por pantalla.
export function ErrorState({ onRetry, style, variant = 'light' }: ErrorStateProps) {
  const dark = variant === 'dark'
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, dark && styles.textDark]}>Uy, algo salió mal. Probá de nuevo.</Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.retryBtn, dark && styles.retryBtnDark]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={[styles.retryText, dark && styles.retryTextDark]}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  text: {
    fontSize: 14,
    color: colors.grisOscuro,
    textAlign: 'center',
  },
  textDark: { color: colors.blanco },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnDark: { borderColor: colors.blanco },
  retryText: {
    color: colors.rosaOpa,
    fontSize: 13,
    fontFamily: fonts.palanquinDark,
  },
  retryTextDark: { color: colors.blanco },
})
