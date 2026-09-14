import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, FlatList, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { useProfile } from '../../hooks/useProfile'
import { useOutfits } from '../../hooks/useOutfits'
import { useFollow } from '../../hooks/useFollow'
import { useAuthStore } from '../../store/useAuthStore'
import { STORAGE_BASE_URL } from '../../constants/storage'
import { Avatar } from '../../components/ui/Avatar'
import { ErrorState } from '../../components/ui/ErrorState'
import { StandaloneBottomNavBar } from '../../components/navigation/StandaloneBottomNavBar'

const BASE = `${STORAGE_BASE_URL}/`

export default function UserProfileScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const screenWidth = useAppWidth()
  const cardWidth = Math.floor((screenWidth - spacing.md * 2 - 4 * 2) / 3)
  const session = useAuthStore((s) => s.session)
  const viewerProfile = useAuthStore((s) => s.profile)
  // Las cuentas de marca no pueden seguir a otras cuentas ni acceder al feed.
  const viewerIsBrand = !!viewerProfile?.is_brand
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile(id)
  const { outfits, loading: outfitsLoading, error: outfitsError, refetch: refetchOutfits } = useOutfits(id)
  const { following, toggle: toggleFollow } = useFollow(id ?? '')

  const isOwnProfile = !!session && session.user.id === id

  useEffect(() => {
    if (isOwnProfile) router.replace('/(tabs)/profile')
  }, [isOwnProfile])

  if (isOwnProfile) return null

  if (profileLoading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={colors.rosaOpa} size="large" />
      </SafeAreaView>
    )
  }

  if (profileError || !profile) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ErrorState onRetry={profileError ? refetchProfile : undefined} />
      </SafeAreaView>
    )
  }

  const displayUsername = profile.username
  const displayName = profile.display_name ?? ''
  const bio = profile.bio ?? ''
  const igHandle = profile.instagram_handle
  const tags = profile.tags ?? []
  const avatarUrl = profile.avatar_url

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Image source={{ uri: BASE + 'flecha.png' }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity hitSlop={10}>
            <Image source={{ uri: BASE + 'compartir.png' }} style={styles.topBarIcon} contentFit="contain" />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={10}>
            <Text style={styles.menuIcon}>•••</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + stats */}
        <View style={styles.headerRow}>
          <Avatar uri={avatarUrl} label={displayUsername} size={76} fallbackFontSize={30} fallbackFontFamily={fonts.mergeOne} style={styles.avatar} />
          <View style={styles.statsRow}>
            {[
              { label: 'Seguidores', value: profile.followers_count, onPress: () => router.push(`/followers/${id}?type=followers`) },
              { label: 'Seguidos', value: profile.following_count, onPress: () => router.push(`/followers/${id}?type=following`) },
              { label: 'Outfits', value: profile.outfits_count, onPress: undefined },
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
        </View>

        {/* Name, bio, tags */}
        <View style={styles.infoBlock}>
          <Text style={styles.username}>{displayName || displayUsername}</Text>
          <Text style={styles.handle}>@{displayUsername}</Text>
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

        {/* Follow button — oculto cuando quien mira es una cuenta de marca */}
        {!viewerIsBrand && (
          <View style={styles.followRow}>
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followBtnActive]}
              onPress={toggleFollow}
              activeOpacity={0.85}
            >
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? 'Siguiendo' : 'Seguir'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab bar (solo grid — outfits públicos) */}
        <View style={styles.profileNav}>
          <View style={styles.profileNavItem}>
            <Image source={{ uri: BASE + 'GridFinal_rosa.png' }} style={styles.tabIcon} contentFit="contain" />
            <View style={styles.profileNavIndicator} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Outfits creados</Text>

        {outfitsLoading ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 32 }} />
        ) : outfitsError ? (
          <ErrorState onRetry={refetchOutfits} />
        ) : outfits.length === 0 ? (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabIcon}>🎽</Text>
            <Text style={styles.emptyTabText}>Todavía no publicó outfits</Text>
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
                  params: { userId: id, startIndex: String(outfits.indexOf(item)) },
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
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <StandaloneBottomNavBar viewerIsBrand={viewerIsBrand} activeKey="profile" />
    </SafeAreaView>
  )
}

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
  menuIcon: { fontSize: 16, color: colors.negro },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  avatar: { flexShrink: 0 },

  statsRow: { flex: 1, flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.negro },
  statLabel: { fontSize: 10, color: colors.grisClaro, marginTop: 2 },

  infoBlock: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  username: { fontSize: 17, fontFamily: fonts.palanquinDark, color: colors.negro },
  handle: { fontSize: 13, color: colors.grisClaro },
  bio: { fontSize: 13, color: colors.grisOscuro, lineHeight: 18, marginTop: 2 },
  igHandle: { fontSize: 12, color: colors.grisClaro },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { borderWidth: 1, borderColor: colors.bordeTag, borderRadius: radius.tag, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.grisOscuro },

  followRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  followBtn: {
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  followBtnActive: { backgroundColor: colors.rosaOpaLight },
  followBtnText: { color: colors.blanco, fontSize: 15, fontFamily: fonts.palanquinDark },
  followBtnTextActive: { color: colors.rosaOpa },

  profileNav: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.grisBorde },
  profileNavItem: { paddingHorizontal: spacing.lg, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { width: 24, height: 24 },
  profileNavIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: colors.rosaOpa, borderRadius: 1 },

  sectionTitle: { fontSize: 13, color: colors.grisOscuro, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },

  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  gridRow: { gap: 4, marginBottom: 4 },
  gridCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisMedio },
  gridImage: { width: '100%', height: '100%' },
  likesRow: { position: 'absolute', bottom: 6, left: 6 },
  likesText: { color: colors.blanco, fontSize: 11, fontWeight: '600' },

  emptyTab: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyTabIcon: { fontSize: 36 },
  emptyTabText: { color: colors.grisClaro, fontSize: 14, textAlign: 'center' },

})
