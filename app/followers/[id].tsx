import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, FlatList, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { useProfile } from '../../hooks/useProfile'
import { useFollowList, FollowListType } from '../../hooks/useFollowList'
import { FollowListRow } from '../../components/profile/FollowListRow'
import { ErrorState } from '../../components/ui/ErrorState'
import { STORAGE_BASE_URL } from '../../constants/storage'

export default function FollowersScreen() {
  const router = useRouter()
  const { id, type } = useLocalSearchParams<{ id: string; type?: FollowListType }>()
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile(id)
  const [activeTab, setActiveTab] = useState<FollowListType>(type === 'following' ? 'following' : 'followers')
  const [search, setSearch] = useState('')

  // Las marcas no siguen a nadie hoy — si el perfil es de marca, no tiene sentido
  // ofrecer el tab "Siguiendo".
  const isBrand = !!profile?.is_brand
  useEffect(() => {
    if (isBrand) setActiveTab('followers')
  }, [isBrand])

  const { items, loading: listLoading } = useFollowList(id, activeTab)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) =>
      p.username.toLowerCase().includes(q) || (p.display_name ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  const loading = profileLoading || listLoading

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Image source={{ uri: `${STORAGE_BASE_URL}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {profile?.username ? `@${profile.username}` : ''}
        </Text>
        <View style={styles.backIcon} />
      </View>

      {/* Tabs — ocultos para perfiles de marca (no tienen "Siguiendo") */}
      {!isBrand && (
        <View style={styles.tabBar}>
          {(['followers', 'following'] as FollowListType[]).map((t) => {
            const active = activeTab === t
            return (
              <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setActiveTab(t)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === 'followers' ? 'Seguidores' : 'Siguiendo'}
                </Text>
                {active && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Buscador */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar"
            placeholderTextColor={colors.grisClaro}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 32 }} />
      ) : profileError ? (
        <ErrorState onRetry={refetchProfile} />
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {items.length === 0
              ? (activeTab === 'followers' ? 'Todavía no tiene seguidores.' : 'Todavía no sigue a nadie.')
              : 'No encontramos a nadie con ese nombre.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FollowListRow item={item} />}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
        />
      )}
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
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: fonts.palanquinDark, color: colors.negro },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.grisBorde },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 14, color: colors.grisClaro, fontFamily: fonts.palanquinDark },
  tabTextActive: { color: colors.negro },
  tabIndicator: { position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, backgroundColor: colors.rosaOpa, borderRadius: 1 },

  searchWrapper: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grisBorde,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 38,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 13, color: colors.negro, height: '100%' },

  emptyState: { padding: spacing.xxl, alignItems: 'center' },
  emptyStateText: { color: colors.grisClaro, fontSize: 14, textAlign: 'center' },
})
