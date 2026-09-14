import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { HorizontalSlider } from './HorizontalSlider'
import { Brand } from '../../types'
import { colors } from '../../constants/colors'
import { radius } from '../../constants/radius'

interface BrandsSliderProps {
  brands: Brand[]
  onPress?: (brand: Brand) => void
}

// Tarjeta cuadrada con logo, o el nombre de la marca en texto si todavía no
// tiene logo_url cargado — nunca una foto de stock externa como placeholder
// (ver CLAUDE.md: usar assets/datos reales, no placeholders de terceros).
export function BrandsSlider({ brands, onPress }: BrandsSliderProps) {
  return (
    <HorizontalSlider>
      {brands.map((brand) => (
        <TouchableOpacity
          key={brand.id}
          style={styles.card}
          onPress={() => onPress?.(brand)}
          activeOpacity={0.85}
        >
          {brand.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.logo} contentFit="contain" />
          ) : (
            <Text style={styles.name} numberOfLines={2}>{brand.name}</Text>
          )}
        </TouchableOpacity>
      ))}
    </HorizontalSlider>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    height: 110,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.negro,
    backgroundColor: colors.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  logo: { width: '100%', height: '100%' },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.negro,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})
