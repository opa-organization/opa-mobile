import React, { useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated, Dimensions, FlatList,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useOutfits } from '../../hooks/useOutfits'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useBrand } from '../../hooks/useBrand'
import { useBrandMetrics } from '../../hooks/useBrandMetrics'
import { useTrendingGarments } from '../../hooks/useTrendingGarments'
import { useBrandQuestions } from '../../hooks/useBrandQuestions'
import { useBrandReviews } from '../../hooks/useBrandReviews'
import { useNotifications } from '../../hooks/useNotifications'
import { useAuthStore } from '../../store/useAuthStore'
import { timeAgo } from '../../lib/timeAgo'
import { SectionHeader } from '../../components/home/SectionHeader'
import { Brand, Garment, Outfit } from '../../types'

import { useAppWidth } from '../../constants/layout'

const STORAGE = 'https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/assets'

// Carousel config
const CARD_W = 220
const CARD_H = 370
const CARD_GAP = 12
const FULL_W = CARD_W + CARD_GAP * 2

// ─── Outfit Carousel with depth effect ───────────────────────────────────────
function OutfitCarousel({ outfits, onPress }: { outfits: Outfit[]; onPress: (id: string) => void }) {
  const scrollX = useRef(new Animated.Value(0)).current
  const sw = useAppWidth()
  const sidePad = (sw - CARD_W) / 2

  return (
    <Animated.FlatList
      data={outfits.slice(0, 5)}
      keyExtractor={item => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={FULL_W}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: sidePad - CARD_GAP }}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => {
        const inputRange = [
          (index - 1) * FULL_W,
          index * FULL_W,
          (index + 1) * FULL_W,
        ]
        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.84, 1, 0.84],
          extrapolate: 'clamp',
        })
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.65, 1, 0.65],
          extrapolate: 'clamp',
        })
        return (
          <TouchableOpacity onPress={() => onPress(item.id)} activeOpacity={0.9}>
            <Animated.View style={[styles.outfitCard, { transform: [{ scale }], opacity }]}>
              <Image
                source={{ uri: item.cover_image_url ?? `https://picsum.photos/seed/${item.id}/220/370` }}
                style={styles.outfitCardImage}
                contentFit="cover"
              />
            </Animated.View>
          </TouchableOpacity>
        )
      }}
    />
  )
}

// ─── Home ────────────────────────────────────────────────────────────────────
// Las cuentas de marca ven un panel de gestión (tráfico, preguntas, sus
// outfits/prendas, opiniones) en vez del feed de descubrimiento — misma idea
// de branch por is_brand que ya usa app/(tabs)/wardrobe.tsx.
export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile)
  return profile?.is_brand ? <BrandHomeView /> : <ConsumerHomeView />
}

// Campanita de notificaciones — común a las dos vistas de Home (usuario y
// marca), arriba a la derecha. `campana_negra`/`campana_rosa` (subidos por el
// usuario) en vez de un badge numérico: rosa cuando hay algo sin leer.
function NotificationBell() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const { unreadCount } = useNotifications(session?.user.id)
  return (
    <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')} hitSlop={8}>
      <Image
        source={{ uri: `${STORAGE}/${unreadCount > 0 ? 'campana_rosa' : 'campana_negra'}.png` }}
        style={styles.bellIcon}
        contentFit="contain"
      />
    </TouchableOpacity>
  )
}

function ConsumerHomeView() {
  const router = useRouter()
  const { outfits, loading } = useOutfits()

  const garments: Garment[] = outfits
    .flatMap(o => o.garments?.map(g => g.garment) ?? [])
    .filter((g, i, a) => g && a.findIndex(x => x?.id === g.id) === i)
    .slice(0, 8) as Garment[]

  const brands: Brand[] = outfits
    .flatMap(o => o.garments?.map(g => g.garment?.brand).filter(Boolean) ?? [])
    .filter((b, i, a) => b && a.findIndex(x => x?.id === (b as Brand).id) === i)
    .slice(0, 6) as Brand[]

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Image
            source={{ uri: `${STORAGE}/logoOPA-transparente.png` }}
            style={styles.logoImg}
            contentFit="contain"
          />
          <View style={styles.headerRight}>
            <NotificationBell />
            <TouchableOpacity style={styles.truckBtn}>
              <Image
                source={{ uri: `${STORAGE}/camion_blanco.png` }}
                style={styles.truckIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Outfits ─────────────────────────────────────────────────── */}
            <SectionHeader title="Outfits" onPress={() => router.push('/(tabs)/outfits')} />
            <OutfitCarousel
              outfits={outfits}
              onPress={(id) => router.push({ pathname: '/(tabs)/outfits', params: { outfitId: id } })}
            />

            {/* ── Últimas prendas ─────────────────────────────────────────── */}
            <SectionHeader title="Últimas Prendas" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {garments.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.garmentCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <View style={styles.garmentImageWrap}>
                    <Image
                      source={{ uri: item.image_url ?? undefined }}
                      style={styles.garmentImage}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={styles.garmentName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.garmentPrice}>${item.price.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Marcas ──────────────────────────────────────────────────── */}
            <SectionHeader title="Las Marcas que la Gente Elige" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {brands.map(brand => (
                <TouchableOpacity
                  key={brand.id}
                  style={styles.brandCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/marca/${brand.id}`)}
                >
                  {brand.logo_url ? (
                    <Image source={{ uri: brand.logo_url }} style={styles.brandLogo} contentFit="contain" />
                  ) : (
                    <Text style={styles.brandName} numberOfLines={2}>{brand.name}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Lo último que viste ─────────────────────────────────────── */}
            <SectionHeader title="Lo Último que Viste" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={styles.recentCard}>
                  <Text style={styles.recentEmpty}>Aún no{'\n'}hay nada{'\n'}que mostrar</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Brand Home ──────────────────────────────────────────────────────────────
// Panel de gestión de la cuenta de marca: tráfico real (likes/guardados/
// seguidores — visitas/clics quedan afuera, no hay tracking de eso todavía),
// preguntas sin responder (primeras 3 + "ver todas" → app/brand/questions.tsx),
// sus outfits publicados, catálogo propio ordenado por tendencia real (más
// guardado en los últimos 7 días vía RPC get_trending_garments), y las últimas
// 3 opiniones recibidas (sin "ver más" a propósito — para ver el resto hay que
// entrar a cada prenda).
function BrandHomeView() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const { brand, loading: loadingBrand } = useMyBrand(session?.user.id)
  const { garments, outfits, loading: loadingBrandData } = useBrand(brand?.id)
  const { likes, saves, followers, loading: loadingMetrics } = useBrandMetrics(brand?.profile_id)
  const { garments: trending, loading: loadingTrending } = useTrendingGarments(brand?.id)
  const { questions, totalCount: questionsTotal, loading: loadingQuestions } = useBrandQuestions(brand?.id, { limit: 3 })
  const garmentIds = garments.map((g) => g.id)
  const { reviews, loading: loadingReviews } = useBrandReviews(garmentIds)

  if (loadingBrand || loadingBrandData || !brand) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={{ uri: `${STORAGE}/logoOPA-transparente.png` }}
            style={styles.logoImg}
            contentFit="contain"
          />
          <View style={styles.headerRight}>
            <NotificationBell />
            <View style={styles.brandAvatarWrap}>
              {brand.logo_url ? (
                <Image source={{ uri: brand.logo_url }} style={styles.brandAvatar} contentFit="cover" />
              ) : (
                <Text style={styles.brandAvatarInitial}>{brand.name[0]?.toUpperCase() ?? '?'}</Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Hola, {brand.name}</Text>
          <Text style={styles.greetingSubtitle}>Este es el resumen de tu cuenta</Text>
        </View>

        {/* ── Tráfico de tu cuenta ──────────────────────────────────────── */}
        <SectionHeader title="Tráfico de tu cuenta" />
        {loadingMetrics ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            <KpiCard label="Me gusta" value={likes} />
            <KpiCard label="Guardados" value={saves} />
            <KpiCard label="Seguidores" value={followers} />
          </ScrollView>
        )}

        {/* ── Preguntas sin responder ───────────────────────────────────── */}
        <View style={styles.questionsHeaderRow}>
          <View style={styles.questionsHeaderLeft}>
            <Text style={styles.questionsHeaderTitle}>Preguntas sin responder</Text>
            {questionsTotal > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{questionsTotal}</Text>
              </View>
            )}
          </View>
          {questionsTotal > 0 && (
            <TouchableOpacity onPress={() => router.push('/brand/questions')} activeOpacity={0.6}>
              <Text style={styles.sectionArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>
        {loadingQuestions ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: 20 }} />
        ) : questions.length === 0 ? (
          <Text style={styles.emptySectionText}>No tenés preguntas pendientes.</Text>
        ) : (
          <View style={styles.questionsList}>
            {questions.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={styles.questionCard}
                activeOpacity={0.8}
                onPress={() => router.push('/brand/questions')}
              >
                <View style={styles.questionRow}>
                  <View style={styles.avatarSm}>
                    <Text style={styles.avatarSmText}>{initials(q.user?.username)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.questionTopRow}>
                      <Text style={styles.questionUser}>@{q.user?.username ?? 'usuario'}</Text>
                      <Text style={styles.questionTime}>{timeAgo(q.created_at)}</Text>
                    </View>
                    <Text style={styles.questionText} numberOfLines={2}>{q.question}</Text>
                  </View>
                </View>
                <View style={styles.questionBottomRow}>
                  <Text style={styles.questionAbout} numberOfLines={1}>
                    Sobre: {q.garment?.name ?? 'Perfil de la marca'}
                  </Text>
                  <View style={styles.answerPill}>
                    <Text style={styles.answerPillText}>Responder</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Tus outfits publicados ────────────────────────────────────── */}
        <SectionHeader title="Tus outfits publicados" onPress={() => router.push('/(tabs)/wardrobe')} />
        {outfits.length === 0 ? (
          <Text style={styles.emptySectionText}>Todavía no publicaste outfits.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {outfits.slice(0, 8).map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.ownOutfitCard}
                activeOpacity={0.85}
                onPress={() => router.push({
                  pathname: '/user-outfits',
                  params: { userId: brand.profile_id ?? '', startIndex: '0' },
                })}
              >
                <Image
                  source={{ uri: o.cover_image_url ?? `https://picsum.photos/seed/${o.id}/140/210` }}
                  style={styles.ownOutfitImage}
                  contentFit="cover"
                />
                <View style={styles.ownOutfitLikes}>
                  <Text style={styles.ownOutfitLikesText}>♥ {o.likes_count}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Prendas en tendencia ──────────────────────────────────────── */}
        <SectionHeader title="Prendas en tendencia" />
        {loadingTrending ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: 20 }} />
        ) : trending.length === 0 ? (
          <Text style={styles.emptySectionText}>Todavía no cargaste prendas.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {trending.map((g, index) => (
              <TouchableOpacity
                key={g.id}
                style={styles.garmentCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/product/${g.id}`)}
              >
                <View style={styles.garmentImageWrap}>
                  <Image
                    source={{ uri: g.image_url ?? undefined }}
                    style={styles.garmentImage}
                    contentFit="cover"
                  />
                  {index < 3 && g.recent_saves > 0 && (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{index + 1}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.garmentName} numberOfLines={2}>{g.name}</Text>
                <Text style={styles.garmentPrice}>${g.price.toLocaleString('es-AR')}</Text>
                <Text style={styles.garmentTrend}>
                  {g.recent_saves > 0 ? `▲ ${g.recent_saves} guardados/sem.` : 'Sin guardados esta semana'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Opiniones recientes (siempre las últimas 3, sin "ver más") ─── */}
        <SectionHeader title="Opiniones recientes" />
        {loadingReviews ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: 20 }} />
        ) : reviews.length === 0 ? (
          <Text style={styles.emptySectionText}>Todavía no tenés reseñas.</Text>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewUserRow}>
                    <View style={styles.avatarSm}>
                      <Text style={styles.avatarSmText}>{initials(r.user?.username)}</Text>
                    </View>
                    <Text style={styles.questionUser}>@{r.user?.username ?? 'usuario'}</Text>
                  </View>
                  <Text style={styles.questionTime}>{timeAgo(r.created_at)}</Text>
                </View>
                <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                <Text style={styles.questionAbout} numberOfLines={1}>Sobre: {r.garment?.name ?? 'una prenda'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value.toLocaleString('es-AR')}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  )
}

function initials(username?: string | null) {
  if (!username) return '?'
  return username.slice(0, 2).toUpperCase()
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  logoImg: {
    width: 90,
    height: 36,
  },
  truckBtn: { padding: 4 },
  truckIcon: { width: 32, height: 32 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellBtn: { padding: 4 },
  bellIcon: { width: 24, height: 24 },

  // Outfit carousel
  outfitCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginHorizontal: CARD_GAP,
    backgroundColor: colors.grisMedio,
    shadowColor: colors.negro,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  outfitCardImage: { width: '100%', height: '100%' },

  // Horizontal scroll base
  hScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  // Garments
  garmentCard: { width: 120 },
  garmentImageWrap: {
    width: 120,
    height: 150,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.grisBorde,
    position: 'relative',
  },
  garmentImage: { width: '100%', height: '100%' },
  garmentName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.negro,
    marginTop: 6,
    lineHeight: 16,
  },
  garmentPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rosaOpa,
    marginTop: 2,
  },
  garmentTrend: {
    fontSize: 10,
    color: colors.grisClaro,
    marginTop: 2,
  },
  rankBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 9999,
    backgroundColor: colors.rosaOpa,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 11, fontWeight: '800', color: colors.blanco },

  // Brands
  brandCard: {
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
  brandLogo: { width: '100%', height: '100%' },
  brandName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.negro,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Recently viewed
  recentCard: {
    width: 110,
    height: 150,
    borderRadius: radius.card,
    backgroundColor: colors.grisBorde,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  recentEmpty: {
    fontSize: 10,
    color: colors.grisClaro,
    textAlign: 'center',
    lineHeight: 15,
  },

  // ── Brand Home ──────────────────────────────────────────────────────────
  brandAvatarWrap: {
    width: 34, height: 34, borderRadius: 9999,
    backgroundColor: colors.grisBorde,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  brandAvatar: { width: '100%', height: '100%' },
  brandAvatarInitial: { fontSize: 15, fontFamily: fonts.mergeOne, color: colors.rosaOpa },

  greeting: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  greetingTitle: { fontSize: 19, fontWeight: '700', color: colors.negro },
  greetingSubtitle: { fontSize: 12, color: colors.grisClaro, marginTop: 2 },

  emptySectionText: {
    fontSize: 13, color: colors.grisClaro,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },

  // KPI cards (Tráfico)
  kpiCard: {
    width: 110, borderRadius: radius.card, borderWidth: 1, borderColor: colors.grisBorde,
    backgroundColor: colors.blanco, padding: spacing.md,
  },
  kpiValue: { fontSize: 19, fontWeight: '800', color: colors.negro },
  kpiLabel: {
    fontSize: 10, color: colors.grisClaro, textTransform: 'uppercase',
    letterSpacing: 0.3, marginTop: 2,
  },

  // Preguntas sin responder
  questionsHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm,
  },
  questionsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  questionsHeaderTitle: {
    fontSize: 13, fontWeight: '800', color: colors.negro,
    letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.mergeOne,
  },
  countBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9999,
    backgroundColor: colors.rosaOpa, alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: colors.blanco },
  sectionArrow: { fontSize: 16, color: colors.rosaOpa, fontWeight: '700', padding: 4 },

  questionsList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  questionCard: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: radius.card, padding: spacing.md },
  questionRow: { flexDirection: 'row', gap: spacing.sm },
  avatarSm: {
    width: 32, height: 32, borderRadius: 9999, backgroundColor: colors.grisBorde,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { fontSize: 12, fontWeight: '700', color: colors.grisOscuro },
  questionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionUser: { fontSize: 13, fontWeight: '700', color: colors.negro },
  questionTime: { fontSize: 11, color: colors.grisClaro },
  questionText: { fontSize: 13, color: colors.grisOscuro, marginTop: 2, lineHeight: 17 },
  questionBottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.sm,
  },
  questionAbout: { fontSize: 11, color: colors.grisClaro, flex: 1, marginRight: spacing.sm },
  answerPill: {
    backgroundColor: colors.rosaOpa, borderRadius: radius.button,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  answerPillText: { fontSize: 12, fontWeight: '700', color: colors.blanco, fontFamily: fonts.palanquinDark },

  // Tus outfits publicados
  ownOutfitCard: {
    width: 140, height: 210, borderRadius: radius.card, overflow: 'hidden',
    backgroundColor: colors.grisMedio, position: 'relative',
  },
  ownOutfitImage: { width: '100%', height: '100%' },
  ownOutfitLikes: {
    position: 'absolute', left: 8, bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.button,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ownOutfitLikesText: { fontSize: 11, color: colors.blanco, fontWeight: '600' },

  // Opiniones recientes
  reviewsList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  reviewCard: { borderBottomWidth: 1, borderBottomColor: colors.grisBorde, paddingBottom: spacing.md },
  reviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewStars: { fontSize: 12, color: colors.rosaOpa, marginTop: 6 },
  reviewComment: { fontSize: 13, color: colors.grisOscuro, marginTop: 4, lineHeight: 18 },
})
