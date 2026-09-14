import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useWardrobe } from '../../hooks/useWardrobe'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useBrand } from '../../hooks/useBrand'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { GARMENT_CATEGORIES } from '../../constants/garmentCategories'
import { ErrorState } from '../../components/ui/ErrorState'
import { WardrobeItem, Garment, Brand, Outfit } from '../../types'

const NUM_COLS = 3

// Compartido por WardrobeCard/GarmentStockCard/OutfitCard — cada uno necesita
// su propio ancho de card, reactivo al ancho real de la app.
function useCardSize() {
  const appWidth = useAppWidth()
  return (appWidth - spacing.lg * 2 - spacing.sm * (NUM_COLS - 1)) / NUM_COLS
}

const SLOTS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todo' },
  ...GARMENT_CATEGORIES,
]

export default function WardrobeScreen() {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const initialized = useAuthStore((s) => s.initialized)

  if (!initialized) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.rosaOpa} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👚</Text>
          <Text style={styles.emptyText}>Iniciá sesión para ver tu armario</Text>
        </View>
      </SafeAreaView>
    )
  }

  return profile?.is_brand ? <BrandCatalogView userId={session.user.id} /> : <PersonalWardrobeView userId={session.user.id} />
}

// ─── Armario personal (usuarios) ───────────────────────────────────────────────

function PersonalWardrobeView({ userId }: { userId: string }) {
  const router = useRouter()
  const { items, loading, error, refetch } = useWardrobe(userId)
  const [activeSlot, setActiveSlot] = useState('all')

  const filtered = activeSlot === 'all'
    ? items
    : items.filter((item) => item.garment?.category === activeSlot)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Mi Armario</Text>
        <Text style={styles.count}>{items.length} {items.length === 1 ? 'prenda' : 'prendas'}</Text>
      </View>

      {/* Slot filter */}
      <FlatList
        horizontal
        data={SLOTS}
        keyExtractor={(s) => s.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotList}
        renderItem={({ item: slot }) => (
          <TouchableOpacity
            style={[styles.slotChip, activeSlot === slot.key && styles.slotChipActive]}
            onPress={() => setActiveSlot(slot.key)}
          >
            <Text style={[styles.slotChipText, activeSlot === slot.key && styles.slotChipTextActive]}>
              {slot.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 40 }} />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👚</Text>
          <Text style={styles.emptyText}>
            {items.length === 0
              ? 'Tu armario está vacío.\nAgregá prendas desde el detalle de cada prenda.'
              : `Nada en ${SLOTS.find((s) => s.key === activeSlot)?.label ?? activeSlot}.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <WardrobeCard
              item={item as WardrobeItem & { garment?: Garment & { brand?: Brand } }}
              onPress={() => router.push(`/product/${item.garment_id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

type WardrobeCardItem = WardrobeItem & { garment?: Garment & { brand?: Brand } }

function WardrobeCard({ item, onPress }: { item: WardrobeCardItem; onPress: () => void }) {
  const g = item.garment
  const cardSize = useCardSize()
  return (
    <TouchableOpacity style={[styles.card, { width: cardSize }]} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: g?.image_url ?? undefined }}
        style={[styles.cardImage, { width: cardSize, height: cardSize * 1.25 }]}
        contentFit="cover"
      />
      {g && (
        <View style={styles.cardMeta}>
          <Text style={styles.cardName} numberOfLines={1}>{g.name}</Text>
          {g.brand && <Text style={styles.cardBrand} numberOfLines={1}>{g.brand.name}</Text>}
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Catálogo (cuentas de marca) ────────────────────────────────────────────────
// Reemplaza al armario para is_brand=true: vista propia de inventario (con stock,
// dato privado que no se muestra en el perfil público /marca/[id]) + outfits
// publicados por la marca. Reusa useMyBrand (resuelve la marca de la cuenta
// logueada) + useBrand (mismo fetch de garments/outfits que ya usa el perfil
// público). Solo lectura: no hay pantalla de edición de prendas en esta app
// todavía (eso vive en opa-web, sin iniciar).

function totalStock(g: Garment): number {
  if (!g.stock_por_talle) return 0
  return Object.values(g.stock_por_talle).reduce((sum, n) => sum + (n ?? 0), 0)
}

function BrandCatalogView({ userId }: { userId: string }) {
  const router = useRouter()
  const { brand, loading: loadingBrand } = useMyBrand(userId)
  const { garments, outfits, loading: loadingBrandData, error, refetch } = useBrand(brand?.id)
  const [activeTab, setActiveTab] = useState<'prendas' | 'outfits'>('prendas')

  const loading = loadingBrand || loadingBrandData

  // Refresca el catálogo cada vez que la pantalla vuelve a estar en foco —
  // así una prenda recién creada en app/brand/create-garment.tsx aparece sin
  // tener que hacer nada especial al volver.
  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  // Marcar como descontinuada (o reactivar) es la única forma de "borrar" una
  // prenda: un DELETE real cascadea sobre outfit_items/armario/guardados de
  // cualquier usuario que la tenga, así que se optó por ocultarla del catálogo
  // público y bloquear la compra en su lugar (ver database-2026-06-06-schema-and-seed.md).
  // El PATCH de la API tiene una whitelist de campos que no incluye
  // `descontinuada` (columna nueva), así que esto escribe directo a Supabase
  // vía una policy RLS de owner-update en vez de pasar por la API.
  async function handleToggleDescontinuada(garmentId: string, next: boolean) {
    await supabase.from('prendas').update({ descontinuada: next }).eq('id', garmentId)
    refetch()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Catálogo</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>
            {activeTab === 'prendas'
              ? `${garments.length} ${garments.length === 1 ? 'prenda' : 'prendas'}`
              : `${outfits.length} ${outfits.length === 1 ? 'outfit' : 'outfits'}`}
          </Text>
          {activeTab === 'prendas' && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/brand/create-garment')}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Agregar prenda</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.brandTabBar}>
        {(['prendas', 'outfits'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.brandTabItem}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.brandTabText, activeTab === tab && styles.brandTabTextActive]}>
              {tab === 'prendas' ? 'Prendas' : 'Outfits'}
            </Text>
            {activeTab === tab && <View style={styles.brandTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 40 }} />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : activeTab === 'prendas' ? (
        garments.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🛍️</Text>
            <Text style={styles.emptyText}>Todavía no cargaste prendas.</Text>
          </View>
        ) : (
          <FlatList
            data={garments}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <GarmentStockCard
                item={item}
                onPress={() => router.push(`/product/${item.id}`)}
                onToggleDescontinuada={() => handleToggleDescontinuada(item.id, !item.descontinuada)}
              />
            )}
          />
        )
      ) : outfits.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎽</Text>
          <Text style={styles.emptyText}>Todavía no publicaste outfits.</Text>
        </View>
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item, index }) => (
            <OutfitCard
              item={item}
              onPress={() => router.push({
                pathname: '/user-outfits',
                params: { userId: brand?.profile_id ?? '', startIndex: String(index) },
              })}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

function GarmentStockCard({
  item,
  onPress,
  onToggleDescontinuada,
}: {
  item: Garment
  onPress: () => void
  onToggleDescontinuada: () => void
}) {
  const stock = totalStock(item)
  const cardSize = useCardSize()
  return (
    <TouchableOpacity style={[styles.card, { width: cardSize }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.image_url ?? undefined }}
          style={[styles.cardImage, { width: cardSize, height: cardSize * 1.25 }, item.descontinuada && styles.cardImageDimmed]}
          contentFit="cover"
        />
        {item.descontinuada && (
          <View style={styles.discontinuedBadge}>
            <Text style={styles.discontinuedBadgeText}>Descontinuada</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={(e) => { e.stopPropagation(); onToggleDescontinuada() }}
          hitSlop={4}
        >
          <Text style={styles.toggleBtnText}>{item.descontinuada ? 'Reactivar' : 'Descontinuar'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        {!item.descontinuada && (
          <Text style={[styles.stockText, stock === 0 && styles.stockTextEmpty]}>
            {stock === 0 ? 'Sin stock' : `${stock} en stock`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

function OutfitCard({ item, onPress }: { item: Outfit; onPress: () => void }) {
  const cardSize = useCardSize()
  return (
    <TouchableOpacity style={[styles.card, { width: cardSize }]} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: item.cover_image_url ?? undefined }}
        style={[styles.cardImage, { width: cardSize, height: cardSize * 1.4 }]}
        contentFit="cover"
      />
      <View style={styles.cardMeta}>
        <Text style={styles.cardName} numberOfLines={1}>♥ {item.likes_count}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, color: colors.grisClaro, textAlign: 'center', lineHeight: 20, maxWidth: 240 },

  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.negro },
  count: { fontSize: 13, color: colors.grisClaro },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn: { backgroundColor: colors.rosaOpa, borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  addBtnText: { fontSize: 12, fontWeight: '700', color: colors.blanco },

  slotList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.grisMedio,
  },
  slotChipActive: { backgroundColor: colors.negro, borderColor: colors.negro },
  slotChipText: { fontSize: 13, fontWeight: '600', color: colors.grisOscuro },
  slotChipTextActive: { color: colors.blanco },

  brandTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.grisBorde, marginBottom: spacing.sm },
  brandTabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  brandTabText: { fontSize: 14, fontWeight: '600', color: colors.grisClaro },
  brandTabTextActive: { color: colors.negro },
  brandTabIndicator: { position: 'absolute', bottom: 0, left: '35%', right: '35%', height: 2, backgroundColor: colors.rosaOpa, borderRadius: 1 },

  grid: { padding: spacing.lg, gap: spacing.sm },
  row: { gap: spacing.sm },
  card: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisBorde },
  cardImage: {},
  cardMeta: { padding: spacing.xs },
  cardName: { fontSize: 11, fontWeight: '600', color: colors.negro },
  cardBrand: { fontSize: 10, color: colors.grisClaro, marginTop: 1 },
  stockText: { fontSize: 10, color: colors.grisOscuro, marginTop: 1, fontWeight: '600' },
  stockTextEmpty: { color: colors.rosaOpa },

  imageWrapper: { position: 'relative' },
  cardImageDimmed: { opacity: 0.4 },
  discontinuedBadge: {
    position: 'absolute', top: spacing.xs, left: spacing.xs,
    backgroundColor: colors.negro, borderRadius: radius.tag,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  discontinuedBadgeText: { fontSize: 9, fontWeight: '700', color: colors.blanco },
  toggleBtn: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4, alignItems: 'center',
  },
  toggleBtnText: { fontSize: 10, fontWeight: '700', color: colors.blanco },
})
