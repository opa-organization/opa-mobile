import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, FlatList, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { useBrand } from '../../hooks/useBrand'
import { useWardrobe } from '../../hooks/useWardrobe'
import { useFollow } from '../../hooks/useFollow'
import { useAuthStore } from '../../store/useAuthStore'
import { STORAGE_BASE_URL } from '../../constants/storage'
import { Avatar } from '../../components/ui/Avatar'

const BASE = `${STORAGE_BASE_URL}/`
const NAV_BASE = BASE + 'nav/'

// Misma navbar que (tabs)/_layout, pero standalone: esta pantalla vive fuera del
// Tabs navigator, así que no puede reusar BottomNavBar (necesita props de react-navigation).
const NAV_TABS = [
  { key: 'index', href: '/(tabs)', icon: NAV_BASE + 'home.png', iconActive: NAV_BASE + 'home_rosa.png' },
  { key: 'outfits', href: '/(tabs)/outfits', icon: NAV_BASE + 'outfit_v2.png', iconActive: NAV_BASE + 'outfit_rosa_v2.png' },
  { key: 'search', href: '/(tabs)/search', icon: NAV_BASE + 'search.png', iconActive: NAV_BASE + 'search_rosa.png' },
  { key: 'wardrobe', href: '/(tabs)/wardrobe', icon: NAV_BASE + 'armario.png', iconActive: NAV_BASE + 'armario_rosa.png' },
  { key: 'profile', href: '/(tabs)/profile', icon: NAV_BASE + 'user.png', iconActive: NAV_BASE + 'user_rosa.png' },
] as const

// Tabs propias del perfil de marca (icon-only, sin labels)
const BRAND_TABS = [
  { key: 'outfits', icon: BASE + 'GridFinal.png', iconActive: BASE + 'GridFinal_rosa.png' },
  { key: 'catalogo', icon: BASE + 'catalogo.png', iconActive: BASE + 'catalogo_rosa.png' },
] as const

// Cuentas de marca no tienen armario personal — mismo criterio que BottomNavBar.tsx
const CATALOGO_ICONS = { icon: BASE + 'catalogo.png', iconActive: BASE + 'catalogo_rosa.png' }

// 12,4K estilo screenshot
function formatCount(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'K'
  return n.toLocaleString('es-AR')
}

export default function BrandProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const screenWidth = useAppWidth()
  const cardWidth = Math.floor((screenWidth - spacing.md * 2 - 4 * 2) / 3)
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  // Las cuentas de marca no pueden seguir a otras cuentas ni acceder al feed.
  const viewerIsBrand = !!profile?.is_brand

  const { brand, garments, outfits, followersCount, adjustFollowersCount, loading } = useBrand(id)
  const { items: wardrobe } = useWardrobe(session?.user.id)
  const { following, toggle: toggleFollow } = useFollow(brand?.profile_id ?? '')

  function handleToggleFollow() {
    adjustFollowersCount(following ? -1 : 1)
    toggleFollow()
  }

  const [activeTab, setActiveTab] = useState<'outfits' | 'catalogo'>('outfits')

  // Prendas descontinuadas no se muestran en el perfil público (ni siquiera al
  // dueño viendo su propio perfil) — la gestión/reactivación vive en el tab
  // Catálogo de wardrobe.tsx, no acá.
  const visibleGarments = garments.filter((g) => !g.descontinuada)

  if (loading || !brand) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={colors.rosaOpa} size="large" />
      </SafeAreaView>
    )
  }

  const igHandle = brand.instagram_handle?.replace(/^@/, '')
  const tags = brand.tags ?? []
  const ownedCount = wardrobe.filter((w) => w.garment?.brand_id === id).length
  // ¿La marca está viendo su propio perfil? (llegó acá vía el tab Perfil)
  const isOwn = !!session?.user.id && brand.profile_id === session.user.id

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar — en modo propio: engranaje de configuración; ajeno: back + compartir */}
      <View style={styles.topBar}>
        {isOwn ? (
          <View style={styles.backIcon} />
        ) : (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Image source={{ uri: BASE + 'flecha.png' }} style={styles.backIcon} contentFit="contain" />
          </TouchableOpacity>
        )}
        <View style={styles.topBarRight}>
          {isOwn ? (
            <TouchableOpacity hitSlop={10} onPress={() => router.push('/settings')}>
              <Image source={{ uri: BASE + 'configuracion.png' }} style={styles.settingsIcon} contentFit="contain" />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity hitSlop={10}>
                <Image source={{ uri: BASE + 'compartir.png' }} style={styles.topBarIcon} contentFit="contain" />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10}>
                <Text style={styles.menuIcon}>•••</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner (no hay columna de cover dedicada — se reusa el logo como portada) */}
        <View style={styles.banner}>
          {brand.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.bannerImage} contentFit="cover" />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]} />
          )}
        </View>

        {/* Avatar-logo circular que pisa el banner */}
        <View style={styles.avatarWrap}>
          <Avatar
            uri={brand.logo_url}
            label={brand.name}
            size={AVATAR_SIZE - 6}
            fallbackFontSize={34}
            fallbackFontFamily={fonts.mergeOne}
          />
        </View>

        {/* Nombre + verificada */}
        <View style={styles.infoBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.brandName}>{brand.name.toUpperCase()}</Text>
            {brand.verified && (
              <Image source={{ uri: BASE + 'verificado_ondas.png' }} style={styles.verifiedBadge} contentFit="contain" />
            )}
          </View>
          <Text style={styles.handle}>{igHandle ? `@${igHandle} · ` : ''}Marca</Text>
          {brand.description ? <Text style={styles.bio}>{brand.description}</Text> : null}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Banner contextual "Ya lo tenés" — solo si el usuario tiene prendas de esta marca */}
        {ownedCount > 0 && (
          <TouchableOpacity
            style={styles.ownedBanner}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/wardrobe')}
          >
            <Image source={{ uri: BASE + 'percha_rosa.png' }} style={styles.ownedIcon} contentFit="contain" />
            <Text style={styles.ownedText}>
              Tenés <Text style={styles.ownedTextBold}>{ownedCount} {ownedCount === 1 ? 'prenda' : 'prendas'} de {brand.name}</Text> en tu armario
            </Text>
            <Text style={styles.ownedArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Stats de marca: Seguidores / Outfits / Prendas (sin "Seguidos") — Seguidores
            abre la lista de cuentas, solo si la marca ya tiene profile_id (onboarding) */}
        <View style={styles.statsRow}>
          {[
            {
              label: 'Seguidores',
              value: followersCount,
              onPress: brand.profile_id ? () => router.push(`/followers/${brand.profile_id}?type=followers`) : undefined,
            },
            { label: 'Outfits', value: outfits.length, onPress: undefined },
            { label: 'Prendas', value: visibleGarments.length, onPress: undefined },
          ].map((stat) => (
            <TouchableOpacity
              key={stat.label}
              style={styles.statItem}
              disabled={!stat.onPress}
              activeOpacity={stat.onPress ? 0.6 : 1}
              onPress={stat.onPress}
            >
              <Text style={styles.statValue}>{formatCount(stat.value)}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Follow button — oculto cuando la marca ve su propio perfil, o cuando quien mira es una cuenta de marca */}
        {!isOwn && !viewerIsBrand && (
          <View style={styles.followRow}>
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followBtnActive]}
              onPress={handleToggleFollow}
              activeOpacity={0.85}
            >
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? 'Siguiendo' : 'Seguir'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab bar: Outfits (grid) + Catálogo (bag) */}
        <View style={styles.tabBar}>
          {BRAND_TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: active ? tab.iconActive : tab.icon }} style={styles.tabIcon} contentFit="contain" />
                {active && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Tab Outfits ── */}
        {activeTab === 'outfits' && (
          outfits.length === 0 ? (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabIcon}>🎽</Text>
              <Text style={styles.emptyTabText}>Esta marca todavía no publicó outfits</Text>
            </View>
          ) : (
            <FlatList
              data={outfits}
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
                    pathname: '/user-outfits',
                    params: { userId: brand.profile_id ?? '', startIndex: String(index) },
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

        {/* ── Tab Catálogo ── */}
        {activeTab === 'catalogo' && (
          visibleGarments.length === 0 ? (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabIcon}>🛍️</Text>
              <Text style={styles.emptyTabText}>Esta marca todavía no cargó prendas</Text>
            </View>
          ) : (
            <FlatList
              data={visibleGarments}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.catalogCard, { width: cardWidth }]}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <Image
                    source={{ uri: item.image_url ?? `https://picsum.photos/seed/${item.id}/130/130` }}
                    style={[styles.catalogImage, { width: cardWidth, height: cardWidth }]}
                    contentFit="cover"
                  />
                  <Text style={styles.catalogName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.catalogPrice}>${item.price.toLocaleString('es-AR')}</Text>
                </TouchableOpacity>
              )}
            />
          )
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom navbar — pantalla fuera del Tabs navigator, se arma standalone */}
      <View style={[styles.navBar, { paddingBottom: insets.bottom || 8 }]}>
        {NAV_TABS.filter((tab) => !(viewerIsBrand && tab.key === 'outfits')).map((tab) => {
          // En el perfil propio de la marca, el tab "perfil" queda activo (rosa)
          const active = isOwn && tab.key === 'profile'
          const icons = tab.key === 'wardrobe' && viewerIsBrand ? CATALOGO_ICONS : tab
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navTab}
              activeOpacity={0.7}
              onPress={() => router.push(tab.href as any)}
            >
              <View style={styles.navIconWrap}>
                <Image source={{ uri: active ? icons.iconActive : icons.icon }} style={styles.navIcon} contentFit="contain" />
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const BANNER_HEIGHT = 150
const AVATAR_SIZE = 92

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backIcon: { width: 20, height: 20 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  topBarIcon: { width: 18, height: 18 },
  settingsIcon: { width: 22, height: 22 },
  menuIcon: { fontSize: 16, color: colors.negro },

  // Banner + avatar
  banner: { width: '100%', height: BANNER_HEIGHT, backgroundColor: colors.grisBorde },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { backgroundColor: colors.rosaOpaLight },
  avatarWrap: {
    marginTop: -AVATAR_SIZE / 2,
    marginLeft: spacing.lg,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.blanco,
    backgroundColor: colors.blanco,
    overflow: 'hidden',
  },

  // Info
  infoBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 22, fontFamily: fonts.palanquinDark, color: colors.negro, letterSpacing: 0.5 },
  verifiedBadge: { width: 20, height: 20 },
  handle: { fontSize: 13, color: colors.grisClaro },
  bio: { fontSize: 13, color: colors.grisOscuro, lineHeight: 18, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { borderWidth: 1, borderColor: colors.bordeTag, borderRadius: radius.tag, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.grisOscuro },

  // "Ya lo tenés"
  ownedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rosaOpaLight,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  ownedIcon: { width: 20, height: 20 },
  ownedText: { flex: 1, fontSize: 13, color: colors.grisOscuro },
  ownedTextBold: { fontFamily: fonts.palanquinDark, color: colors.rosaOpa },
  ownedArrow: { fontSize: 20, color: colors.rosaOpa },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.grisBorde,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.negro },
  statLabel: { fontSize: 11, color: colors.grisClaro, marginTop: 2 },

  // Follow
  followRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  followBtn: { backgroundColor: colors.rosaOpa, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' },
  followBtnActive: { backgroundColor: colors.rosaOpaLight },
  followBtnText: { color: colors.blanco, fontSize: 15, fontFamily: fonts.palanquinDark },
  followBtnTextActive: { color: colors.rosaOpa },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.grisBorde },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { width: 24, height: 24 },
  tabIndicator: { position: 'absolute', bottom: 0, left: '35%', right: '35%', height: 2, backgroundColor: colors.rosaOpa, borderRadius: 1 },

  // Grids
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  gridRow: { gap: 4, marginBottom: 4 },
  gridCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisMedio },
  gridImage: { width: '100%', height: '100%' },
  likesRow: { position: 'absolute', bottom: 6, left: 6 },
  likesText: { color: colors.blanco, fontSize: 11, fontWeight: '600' },

  // Catálogo
  catalogCard: {},
  catalogImage: { borderRadius: radius.card, backgroundColor: colors.grisBorde },
  catalogName: { fontSize: 11, color: colors.negro, marginTop: 4 },
  catalogPrice: { fontSize: 11, fontWeight: '700', color: colors.rosaOpa, marginTop: 1 },

  // Empty
  emptyTab: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyTabIcon: { fontSize: 36 },
  emptyTabText: { color: colors.grisClaro, fontSize: 14, textAlign: 'center' },

  // Bottom navbar (calcado de components/navigation/BottomNavBar.tsx)
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
  navIcon: { width: 28, height: 28 },
})
