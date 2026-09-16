import React, { useRef } from 'react'
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors } from '../../constants/colors'
import { useAuthStore } from '../../store/useAuthStore'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'
const NAV = `${STORAGE}/nav`

const TAB_ICONS: Record<string, { default: string; active: string }> = {
  index:    { default: `${NAV}/home.png`,    active: `${NAV}/home_rosa.png` },
  outfits:  { default: `${NAV}/outfit_v2.png`,  active: `${NAV}/outfit_rosa_v2.png` },
  search:   { default: `${NAV}/search.png`,  active: `${NAV}/search_rosa.png` },
  wardrobe: { default: `${NAV}/armario.png`, active: `${NAV}/armario_rosa.png` },
  profile:  { default: `${NAV}/user.png`,    active: `${NAV}/user_rosa.png` },
}

const TAB_LABELS: Record<string, string> = {
  index: 'Inicio',
  outfits: 'Outfits',
  search: 'Buscar',
  wardrobe: 'Armario',
  profile: 'Perfil',
}

// Cuentas de marca no tienen armario personal — en su lugar ven su catálogo
// propio (prendas con stock + outfits de la marca), mismo tab, otro ícono.
const CATALOGO_ICONS = { default: `${STORAGE}/catalogo.png`, active: `${STORAGE}/catalogo_rosa.png` }

export function BottomNavBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const isBrand = useAuthStore((s) => s.profile?.is_brand ?? false)
  // Las cuentas de marca no acceden a la sección de feed (no pueden like/save/follow).
  const routes = isBrand ? state.routes.filter((r) => r.name !== 'outfits') : state.routes

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 8 }]}>
      {routes.map((route) => {
        const index = state.routes.indexOf(route)
        const isFocused = state.index === index
        const icons = route.name === 'wardrobe' && isBrand ? CATALOGO_ICONS : TAB_ICONS[route.name]
        const label = route.name === 'wardrobe' && isBrand ? 'Catálogo' : TAB_LABELS[route.name]

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name)
        }

        return (
          <TabButton
            key={route.key}
            onPress={onPress}
            label={label}
            iconUri={isFocused ? icons?.active : icons?.default}
            isFocused={isFocused}
          />
        )
      })}
    </View>
  )
}

// Bounce sutil al tocar un tab: achica al presionar, rebota de vuelta al soltar.
function TabButton({
  onPress, label, iconUri, isFocused,
}: {
  onPress: () => void
  label?: string
  iconUri?: string
  isFocused: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start()
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.tab}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="tab"
    >
      <Animated.View style={[styles.iconWrap, isFocused && styles.iconWrapActive, { transform: [{ scale }] }]}>
        <Image source={{ uri: iconUri }} style={styles.icon} contentFit="contain" />
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.blanco,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.rosaOpaLight,
  },
  icon: {
    width: 28,
    height: 28,
  },
})
