import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../constants/colors'
import { fonts } from '../constants/fonts'
import { spacing } from '../constants/spacing'
import { radius } from '../constants/radius'
import { useAuthStore } from '../store/useAuthStore'
import { useNotifications } from '../hooks/useNotifications'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/timeAgo'
import { AppNotification } from '../types'
import { STORAGE_BASE_URL as STORAGE } from '../constants/storage'

function initials(name?: string | null) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

function messageFor(n: AppNotification): string {
  const actorName = n.actor?.display_name || (n.actor?.username ? `@${n.actor.username}` : 'Alguien')
  const outfitTitle = n.outfit?.title ? `"${n.outfit.title}"` : 'tu outfit'
  const garmentName = n.garment?.name ?? 'una prenda'
  switch (n.type) {
    case 'follow': return `${actorName} empezó a seguirte`
    case 'like': return `${actorName} le dio like a ${outfitTitle}`
    case 'save': return `${actorName} guardó ${outfitTitle}`
    case 'question_asked': return `${actorName} te hizo una pregunta sobre ${garmentName}`
    case 'question_answered': return `${actorName} respondió tu pregunta sobre ${garmentName}`
  }
}

export default function NotificationsScreen() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(session?.user.id)

  // Resuelve el id de `marcas` a partir del profile_id del actor solo cuando
  // hace falta (marcas siguiendo/preguntando a alguien es un caso raro hoy,
  // ver followers/[id].tsx) — no vale la pena embeber este join en la query
  // principal para un caso que casi nunca pasa.
  async function goToActorProfile(actorId: string, actorIsBrand: boolean) {
    if (actorIsBrand) {
      const { data } = await supabase.from('marcas').select('id').eq('profile_id', actorId).maybeSingle()
      if (data) { router.push(`/marca/${data.id}`); return }
    }
    router.push(`/user/${actorId}`)
  }

  async function handlePress(n: AppNotification) {
    if (!n.read) markAsRead(n.id)
    switch (n.type) {
      case 'follow':
        if (n.actor) goToActorProfile(n.actor.id, n.actor.is_brand)
        break
      case 'like':
      case 'save':
        if (n.outfit_id) router.push(`/outfit/${n.outfit_id}`)
        break
      case 'question_asked':
        router.push('/brand/questions')
        break
      case 'question_answered':
        if (n.garment_id) router.push(`/product/${n.garment_id}`)
        else if (n.actor) goToActorProfile(n.actor.id, n.actor.is_brand)
        break
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} hitSlop={8}>
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.rosaOpa} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Image source={{ uri: `${STORAGE}/campana_negra.png` }} style={styles.emptyIcon} contentFit="contain" />
          <Text style={styles.emptyText}>Todavía no tenés notificaciones.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
            >
              {item.actor?.avatar_url ? (
                <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{initials(item.actor?.display_name ?? item.actor?.username)}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.message}>{messageFor(item)}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.grisBorde,
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  backIcon: { width: 20, height: 20 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.negro, fontFamily: fonts.mergeOne },
  markAllText: { fontSize: 12, fontWeight: '600', color: colors.rosaOpa, width: 90, textAlign: 'right' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 40, height: 40, opacity: 0.25 },
  emptyText: { fontSize: 14, color: colors.grisClaro, textAlign: 'center' },

  list: { paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  rowUnread: { backgroundColor: colors.rosaOpaLight },
  avatar: { width: 44, height: 44, borderRadius: radius.avatar, backgroundColor: colors.grisMedio, flexShrink: 0 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grisBorde },
  avatarInitial: { fontSize: 15, fontFamily: fonts.mergeOne, color: colors.rosaOpa },
  info: { flex: 1, gap: 2 },
  message: { fontSize: 13, color: colors.negro, lineHeight: 18 },
  time: { fontSize: 11, color: colors.grisClaro },
  unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.rosaOpa, flexShrink: 0 },
})
