import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, ScrollView, FlatList, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter, Redirect } from 'expo-router'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { useOutfits } from '../../hooks/useOutfits'
import { useSavedOutfits } from '../../hooks/useSavedOutfits'
import { useSavedGarments } from '../../hooks/useSavedGarments'
import { useAuthStore } from '../../store/useAuthStore'
import { useMyBrand } from '../../hooks/useMyBrand'
import { STORAGE_BASE_URL } from '../../constants/storage'
import { Avatar } from '../../components/ui/Avatar'

const BASE = `${STORAGE_BASE_URL}/`

// Main tabs
const MAIN_TABS = [
  { key: 'grid', icon: BASE + 'GridFinal.png', iconActive: BASE + 'GridFinal_rosa.png' },
  { key: 'favoritos', icon: BASE + 'estrella_gris.png', iconActive: BASE + 'estrella_negra.png' },
  { key: 'pedidos', icon: BASE + 'caja_negra.png', iconActive: BASE + 'caja_rosa.png' },
]

// Sub-tabs within Favoritos
const FAV_SUBTABS = [
  { key: 'outfits', icon: BASE + 'nav/outfit_v2.png', iconActive: BASE + 'nav/outfit_rosa_v2.png' },
  { key: 'prendas', icon: BASE + 'percha_negra.png', iconActive: BASE + 'percha_rosa.png' },
]

export default function ProfileScreen() {
  const router = useRouter()
  const screenWidth = useAppWidth()
  const cardWidth = Math.floor((screenWidth - spacing.md * 2 - 4 * 2) / 3)
  const garmentSize = Math.floor((screenWidth - spacing.md * 2 - 4 * 3) / 4)
  const [activeTab, setActiveTab] = useState<string>('grid')

  function handleTabChange(key: string) {
    if (key === 'favoritos') { refetchSaved(); refetchSavedGarments() }
    setActiveTab(key)
  }
  const [favSubTab, setFavSubTab] = useState<string>('outfits')
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const initialized = useAuthStore((s) => s.initialized)
  // Cuentas de marca (is_brand): su "perfil" es el perfil de marca, no el de usuario.
  const { brand: myBrand, loading: myBrandLoading } = useMyBrand(
    profile?.is_brand ? session?.user.id : undefined
  )
  const { outfits, loading: outfitsLoading } = useOutfits(session?.user.id)
  const { outfits: savedOutfits, loading: savedLoading, refetch: refetchSaved } = useSavedOutfits(session?.user.id)
  const { garments: savedGarments, loading: savedGarmentsLoading, refetch: refetchSavedGarments } = useSavedGarments(session?.user.id)

  if (!initialized) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.rosaOpa} size="large" />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.gateContainer}>
          <Image
            source={{ uri: `${STORAGE_BASE_URL}/logoOPA-transparente.png` }}
            style={styles.gateLogo}
            contentFit="contain"
          />
          <Text style={styles.gateTitle}>Tu perfil te espera</Text>
          <Text style={styles.gateSubtitle}>
            Iniciá sesión para ver tu armario, tus outfits guardados y seguir a tus marcas favoritas.
          </Text>
          <TouchableOpacity style={styles.gateBtn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={styles.gateBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gateSecondaryBtn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Text style={styles.gateSecondaryBtnText}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Si es una cuenta de marca, redirigimos a su perfil de marca (banner, catálogo, etc.)
  if (profile?.is_brand) {
    if (myBrandLoading) {
      return (
        <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={colors.rosaOpa} size="large" />
        </SafeAreaView>
      )
    }
    if (myBrand) return <Redirect href={`/marca/${myBrand.id}`} />
    // Fallback: cuenta marcada is_brand pero sin fila en `marcas` — mostramos el perfil normal
  }

  const displayUsername = profile?.username ?? session.user.email?.split('@')[0] ?? 'usuario'
  const displayName = profile?.display_name ?? ''
  const bio = profile?.bio ?? ''
  const igHandle = profile?.instagram_handle
  const tags = profile?.tags ?? []
  const avatarUrl = profile?.avatar_url

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Settings */}
        <View style={styles.settingsRow}>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Image source={{ uri: BASE + 'configuracion.png' }} style={styles.settingsIcon} contentFit="contain" />
          </TouchableOpacity>
        </View>

        {/* Header: avatar left + info right */}
        <View style={styles.headerRow}>
          <Avatar uri={avatarUrl} label={displayUsername} size={80} fallbackFontSize={32} fallbackFontFamily={fonts.mergeOne} style={styles.avatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.username}>{displayUsername}</Text>
            {displayName ? <Text style={styles.fullName}>{displayName}</Text> : null}
            {bio ? <Text style={styles.bio}>{bio}</Text> : null}
            {igHandle ? <Text style={styles.igHandle}>ig: {igHandle}</Text> : null}
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((tag: string) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats — Seguidores/Seguidos abren la lista de cuentas (estilo IG/TikTok) */}
        <View style={styles.statsRow}>
          {[
            { label: 'Seguidores', value: profile?.followers_count ?? 0, onPress: () => router.push(`/followers/${session!.user.id}?type=followers`) },
            { label: 'Seguidos', value: profile?.following_count ?? 0, onPress: () => router.push(`/followers/${session!.user.id}?type=following`) },
            { label: 'Outfits', value: profile?.outfits_count ?? 0, onPress: undefined },
            { label: 'Guardados', value: savedOutfits.length, onPress: undefined },
          ].map((stat) => (
            <TouchableOpacity
              key={stat.label}
              style={styles.statItem}
              disabled={!stat.onPress}
              activeOpacity={stat.onPress ? 0.6 : 1}
              onPress={stat.onPress}
            >
              <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main tab bar */}
        <View style={styles.profileNav}>
          {MAIN_TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => handleTabChange(tab.key)}
                style={styles.profileNavItem}
              >
                <Image
                  source={{ uri: active ? tab.iconActive : tab.icon }}
                  style={styles.tabIcon}
                  contentFit="contain"
                />
                {active && <View style={styles.profileNavIndicator} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Grid tab ── */}
        {activeTab === 'grid' && (
          outfitsLoading ? (
            <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 32 }} />
          ) : outfits.length === 0 ? (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabIcon}>🎽</Text>
              <Text style={styles.emptyTabText}>Todavía no publicaste outfits</Text>
            </View>
          ) : (
            <FlatList
              data={outfits}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.gridCard, { width: cardWidth, height: cardWidth * (16 / 9) }]}
                  activeOpacity={0.85}
                  onPress={() => router.push({
                    pathname: '/user-outfits',
                    params: { userId: session!.user.id, startIndex: String(outfits.indexOf(item)) },
                  })}
                >
                  <Image
                    source={{ uri: item.cover_image_url ?? `https://picsum.photos/seed/${item.id}/130/231` }}
                    style={styles.gridImage}
                    contentFit="cover"
                  />
                  <View style={styles.likesRow}>
                    <Text style={styles.likesText}>♥ {item.likes_count}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
        )}

        {/* ── Favoritos tab ── */}
        {activeTab === 'favoritos' && (
          <View>
            {/* Sub-tab bar */}
            <View style={styles.subTabBar}>
              {FAV_SUBTABS.map((sub) => {
                const active = favSubTab === sub.key
                return (
                  <TouchableOpacity
                    key={sub.key}
                    onPress={() => setFavSubTab(sub.key)}
                    style={styles.subTabItem}
                  >
                    <Image
                      source={{ uri: active ? sub.iconActive : sub.icon }}
                      style={styles.subTabIcon}
                      contentFit="contain"
                    />
                    {active && <View style={styles.profileNavIndicator} />}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Outfits favoritos */}
            {favSubTab === 'outfits' && (
              savedLoading ? (
                <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 32 }} />
              ) : savedOutfits.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Text style={styles.emptyTabIcon}>★</Text>
                  <Text style={styles.emptyTabText}>Todavía no guardaste outfits</Text>
                </View>
              ) : (
                <FlatList
                  data={savedOutfits}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.grid}
                  columnWrapperStyle={styles.gridRow}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[styles.gridCard, { width: cardWidth, height: cardWidth * (16 / 9) }]}
                      activeOpacity={0.85}
                      onPress={() => router.push({
                        pathname: '/saved-outfits',
                        params: { startIndex: String(index) },
                      })}
                    >
                      <Image
                        source={{ uri: item.cover_image_url ?? `https://picsum.photos/seed/${item.id}/130/231` }}
                        style={styles.gridImage}
                        contentFit="cover"
                      />
                      <View style={styles.likesRow}>
                        <Text style={styles.likesText}>♥ {item.likes_count}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )
            )}

            {/* Prendas guardadas en favoritos */}
            {favSubTab === 'prendas' && (
              savedGarmentsLoading ? (
                <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 32 }} />
              ) : savedGarments.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Text style={styles.emptyTabIcon}>👗</Text>
                  <Text style={styles.emptyTabText}>Todavía no guardaste prendas</Text>
                </View>
              ) : (
                <FlatList
                  data={savedGarments}
                  keyExtractor={(item) => item.garment_id}
                  numColumns={4}
                  scrollEnabled={false}
                  contentContainerStyle={styles.garmentGrid}
                  columnWrapperStyle={styles.garmentRow}
                  renderItem={({ item }) => (
                    <View style={[styles.garmentCard, { width: garmentSize, height: garmentSize }]}>
                      <Image
                        source={{ uri: item.garment?.image_url ?? `https://picsum.photos/seed/${item.garment_id}/100/100` }}
                        style={styles.garmentImage}
                        contentFit="cover"
                      />
                    </View>
                  )}
                />
              )
            )}
          </View>
        )}

        {/* ── Pedidos tab ── */}
        {activeTab === 'pedidos' && (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabIcon}>📦</Text>
            <Text style={styles.emptyTabText}>No tenés pedidos activos</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },

  // Auth gate
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, gap: spacing.md },
  gateLogo: { width: 160, height: 80, marginBottom: spacing.sm },
  gateTitle: { fontSize: 22, fontFamily: fonts.palanquinDark, color: colors.negro, textAlign: 'center' },
  gateSubtitle: { fontSize: 14, color: colors.grisClaro, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  gateBtn: { backgroundColor: colors.rosaOpa, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: spacing.xxl, alignItems: 'center', width: '100%' },
  gateBtnText: { color: colors.blanco, fontSize: 15, fontFamily: fonts.palanquinDark },
  gateSecondaryBtn: { borderWidth: 1, borderColor: colors.rosaOpa, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: spacing.xxl, alignItems: 'center', width: '100%' },
  gateSecondaryBtnText: { color: colors.rosaOpa, fontSize: 15, fontFamily: fonts.palanquinDark },

  // Profile header
  settingsRow: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  settingsIcon: { width: 22, height: 22 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: { flexShrink: 0 },
  headerInfo: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontFamily: fonts.palanquinDark, color: colors.negro },
  fullName: { fontSize: 13, color: colors.grisOscuro },
  bio: { fontSize: 12, color: colors.grisOscuro, lineHeight: 17 },
  igHandle: { fontSize: 12, color: colors.grisClaro },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderWidth: 1, borderColor: colors.bordeTag, borderRadius: radius.tag, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.grisOscuro },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.grisBorde,
    paddingVertical: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.negro },
  statLabel: { fontSize: 10, color: colors.grisClaro, marginTop: 2 },

  // Tab bar
  profileNav: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.grisBorde, marginBottom: spacing.md },
  profileNavItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { width: 24, height: 24 },
  profileNavIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: colors.rosaOpa, borderRadius: 1 },

  // Sub-tab bar
  subTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.grisBorde, marginBottom: spacing.md },
  subTabItem: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  subTabIcon: { width: 22, height: 22 },

  // Outfit grid
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  gridRow: { gap: 4, marginBottom: 4 },
  gridCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisMedio },
  gridImage: { width: '100%', height: '100%' },
  likesRow: { position: 'absolute', bottom: 6, left: 6 },
  likesText: { color: colors.blanco, fontSize: 11, fontWeight: '600' },

  // Garment grid
  garmentGrid: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  garmentRow: { gap: 4, marginBottom: 4 },
  garmentCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisMedio },
  garmentImage: { width: '100%', height: '100%' },

  // Empty states
  emptyTab: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyTabIcon: { fontSize: 36 },
  emptyTabText: { color: colors.grisClaro, fontSize: 14, textAlign: 'center' },
})
