import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { GARMENT_CATEGORIES } from '../../constants/garmentCategories'
import { Avatar } from '../../components/ui/Avatar'
import { Outfit, OutfitItemWithData, Garment, Brand } from '../../types'

type FullOutfit = Outfit & {
  creator?: { id: string; username: string; avatar_url: string | null }
  garments?: (OutfitItemWithData & { garment: Garment & { brand?: Brand } })[]
}

export default function OutfitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const screenWidth = useAppWidth()
  const [outfit, setOutfit] = useState<FullOutfit | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetchOutfit(id)
  }, [id])

  async function fetchOutfit(outfitId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('outfits')
      .select(`
        *,
        creator:perfiles(id, username, avatar_url),
        garments:outfit_items(*, garment:prendas(*, brand:marcas(*)))
      `)
      .eq('id', outfitId)
      .maybeSingle()
    setOutfit(data as FullOutfit | null)
    setLoading(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.rosaOpa} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (!outfit) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Outfit no encontrado</Text>
        </View>
      </SafeAreaView>
    )
  }

  const garments = outfit.garments ?? []
  const total = garments.reduce((sum, item) => sum + (item.garment?.price ?? 0), 0)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {outfit.title ?? 'Outfit'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover image */}
        <Image
          source={{ uri: outfit.cover_image_url ?? undefined }}
          style={[styles.coverImage, { width: screenWidth, height: screenWidth * 1.25 }]}
          contentFit="cover"
        />

        <View style={styles.body}>
          {/* Creator */}
          {outfit.creator && (
            <TouchableOpacity style={styles.creatorRow} onPress={() => router.push(`/user/${outfit.creator!.id}`)}>
              <Avatar
                uri={outfit.creator.avatar_url}
                label={outfit.creator.username}
                size={32}
                style={styles.avatar}
                fallbackBackgroundColor={colors.grisBorde}
                fallbackTextColor={colors.grisClaro}
                fallbackFontSize={13}
                fallbackFontWeight="700"
              />
              <Text style={styles.creatorUsername}>@{outfit.creator.username}</Text>
            </TouchableOpacity>
          )}

          {/* Title + tags */}
          {outfit.title && <Text style={styles.outfitTitle}>{outfit.title}</Text>}
          <View style={styles.tagRow}>
            {outfit.occasion && <View style={styles.tag}><Text style={styles.tagText}>{outfit.occasion}</Text></View>}
            {outfit.style && <View style={styles.tag}><Text style={styles.tagText}>{outfit.style}</Text></View>}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>♥ {outfit.likes_count}</Text>
            <Text style={styles.statItem}>🔖 {outfit.saves_count}</Text>
          </View>

          {/* Garment list */}
          {garments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRENDAS</Text>
              {garments.map((item) => (
                <GarmentRow key={item.id} item={item} onPress={() => router.push(`/product/${item.garment_id}`)} />
              ))}
            </View>
          )}

          {/* Slot labels */}
          {garments.length > 0 && (
            <View style={styles.slotGrid}>
              {GARMENT_CATEGORIES.map((slot) => {
                const slotItems = garments.filter((g) => g.slot === slot.key)
                if (slotItems.length === 0) return null
                return (
                  <View key={slot.key} style={styles.slotGroup}>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    {slotItems.map((item) => (
                      <TouchableOpacity key={item.id} onPress={() => router.push(`/product/${item.garment_id}`)}>
                        <Image
                          source={{ uri: item.garment?.image_url ?? undefined }}
                          style={styles.slotThumb}
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA Bottom bar */}
      <View style={styles.cta}>
        <View style={styles.ctaTotal}>
          <Text style={styles.ctaTotalLabel}>Total</Text>
          <Text style={styles.ctaTotalPrice}>${total.toLocaleString('es-AR')}</Text>
        </View>
        <TouchableOpacity style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Ver outfit completo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── GarmentRow ───────────────────────────────────────────────────────────────

function GarmentRow({ item, onPress }: { item: OutfitItemWithData & { garment: Garment & { brand?: Brand } }; onPress: () => void }) {
  const g = item.garment
  return (
    <TouchableOpacity style={styles.garmentRow} onPress={onPress} activeOpacity={0.75}>
      <Image
        source={{ uri: g.image_url ?? undefined }}
        style={styles.garmentThumb}
        contentFit="cover"
      />
      <View style={styles.garmentInfo}>
        <Text style={styles.garmentName} numberOfLines={1}>{g.name}</Text>
        {g.brand && <Text style={styles.garmentBrand} numberOfLines={1}>{g.brand.name}</Text>}
        {item.slot && <Text style={styles.garmentSlot}>{slotLabel(item.slot)}</Text>}
      </View>
      <Text style={styles.garmentPrice}>${g.price.toLocaleString('es-AR')}</Text>
    </TouchableOpacity>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slotLabel(slot: string) {
  return GARMENT_CATEGORIES.find((s) => s.key === slot)?.label ?? slot
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.grisClaro, fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grisBorde,
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  backText: { fontSize: 22, color: colors.negro },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.negro },

  coverImage: { backgroundColor: colors.grisBorde },

  body: { padding: spacing.lg },

  creatorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { marginRight: spacing.sm },
  creatorUsername: { fontSize: 13, color: colors.grisOscuro, fontWeight: '600' },

  outfitTitle: { fontSize: 22, fontWeight: '800', color: colors.negro, marginBottom: spacing.sm },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.tag,
    borderWidth: 1,
    borderColor: colors.bordeTag,
  },
  tagText: { fontSize: 12, color: colors.grisOscuro },

  statsRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  statItem: { fontSize: 13, color: colors.grisClaro },

  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.negro, letterSpacing: 1, marginBottom: spacing.sm },

  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grisBorde,
  },
  garmentThumb: { width: 60, height: 60, borderRadius: radius.card, backgroundColor: colors.grisBorde, marginRight: spacing.md },
  garmentInfo: { flex: 1 },
  garmentName: { fontSize: 14, fontWeight: '600', color: colors.negro },
  garmentBrand: { fontSize: 12, color: colors.grisClaro, marginTop: 2 },
  garmentSlot: { fontSize: 11, color: colors.bordeTag, marginTop: 2 },
  garmentPrice: { fontSize: 14, fontWeight: '700', color: colors.rosaOpa },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.lg },
  slotGroup: { alignItems: 'center' },
  slotLabel: { fontSize: 11, color: colors.grisClaro, marginBottom: spacing.xs, fontWeight: '600', letterSpacing: 0.5 },
  slotThumb: { width: 72, height: 90, borderRadius: radius.card, backgroundColor: colors.grisBorde },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
    gap: spacing.md,
  },
  ctaTotal: { flex: 1 },
  ctaTotalLabel: { fontSize: 11, color: colors.grisClaro },
  ctaTotalPrice: { fontSize: 18, fontWeight: '800', color: colors.negro },
  ctaBtn: {
    flex: 2,
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaBtnText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
})
