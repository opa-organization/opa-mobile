import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { STORAGE_BASE_URL } from '../../constants/storage'

const BASE = `${STORAGE_BASE_URL}/`
const NAV_BASE = BASE + 'nav/'

const NAV_TABS = [
  { key: 'index', href: '/(tabs)', icon: NAV_BASE + 'home.png', iconActive: NAV_BASE + 'home_rosa.png' },
  { key: 'outfits', href: '/(tabs)/outfits', icon: NAV_BASE + 'outfit_v2.png', iconActive: NAV_BASE + 'outfit_rosa_v2.png' },
  { key: 'search', href: '/(tabs)/search', icon: NAV_BASE + 'search.png', iconActive: NAV_BASE + 'search_rosa.png' },
  { key: 'wardrobe', href: '/(tabs)/wardrobe', icon: NAV_BASE + 'armario.png', iconActive: NAV_BASE + 'armario_rosa.png' },
  { key: 'profile', href: '/(tabs)/profile', icon: NAV_BASE + 'user.png', iconActive: NAV_BASE + 'user_rosa.png' },
] as const

// Cuentas de marca no tienen armario personal — mismo criterio que BottomNavBar.tsx
const CATALOGO_ICONS = { icon: BASE + 'catalogo.png', iconActive: BASE + 'catalogo_rosa.png' }

interface Props {
  viewerIsBrand: boolean
  // Qué tab marcar como activo (ninguno si no aplica, ej. viendo el perfil
  // ajeno de una marca desde marca/[id].tsx).
  activeKey?: string
  // marca/[id].tsx nunca mostró el circulito rosa de fondo detrás del ícono
  // activo (a diferencia de user/[id].tsx) — se preserva esa diferencia tal
  // cual estaba en vez de unificar el look de las dos pantallas de una.
  showActiveHighlight?: boolean
}

// Misma navbar que (tabs)/_layout, pero standalone: para pantallas que viven
// fuera del Tabs navigator y por eso no pueden reusar BottomNavBar (necesita
// props de react-navigation). Antes estaba duplicada literal en
// app/user/[id].tsx y app/marca/[id].tsx — unificada acá (ver
// .claude/documents/meta-2026-09-14-code-audit.md, B4).
export function StandaloneBottomNavBar({ viewerIsBrand, activeKey, showActiveHighlight = true }: Props) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.navBar, { paddingBottom: insets.bottom || 8 }]}>
      {NAV_TABS.filter((tab) => !(viewerIsBrand && tab.key === 'outfits')).map((tab) => {
        const active = tab.key === activeKey
        const icons = tab.key === 'wardrobe' && viewerIsBrand ? CATALOGO_ICONS : tab
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.navTab}
            activeOpacity={0.7}
            onPress={() => router.push(tab.href as any)}
          >
            <View style={[styles.navIconWrap, active && showActiveHighlight && styles.navIconWrapActive]}>
              <Image
                source={{ uri: active ? icons.iconActive : icons.icon }}
                style={styles.navIcon}
                contentFit="contain"
              />
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    backgroundColor: colors.blanco,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: colors.rosaOpaLight },
  navIcon: { width: 28, height: 28 },
})
