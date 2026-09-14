import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  FlatList,
  Share,
  Linking,
  TextInput,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useSizeGuide } from '../../hooks/useSizeGuide'
import { useRecommendedSize } from '../../hooks/useRecommendedSize'
import { useSaveGarment } from '../../hooks/useSaveGarment'
import { useCart } from '../../hooks/useCart'
import { useGarmentReviews } from '../../hooks/useGarmentReviews'
import { useAskQuestion } from '../../hooks/useAskQuestion'
import { useGarmentQuestions } from '../../hooks/useGarmentQuestions'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useGarmentImages } from '../../hooks/useGarmentImages'
import { useAuthStore } from '../../store/useAuthStore'
import { timeAgo } from '../../lib/timeAgo'
import { ZoomableImage } from '../../components/product/ZoomableImage'
import { colors } from '../../constants/colors'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { fonts } from '../../constants/fonts'
import { useAppWidth } from '../../constants/layout'
import { GARMENT_COLOR_HEX } from '../../constants/garmentColors'
import { Garment, Brand, SizeGuideEntry } from '../../types'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const screenWidth = useAppWidth()

  const [garment, setGarment] = useState<Garment & { brand?: Brand } | null>(null)
  const [related, setRelated] = useState<Garment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [sizeSheetVisible, setSizeSheetVisible] = useState(false)
  const [zoomVisible, setZoomVisible] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [questionText, setQuestionText] = useState('')

  const { images: galleryImages } = useGarmentImages(garment?.id, garment?.image_url)
  const { guide, entries, loading: guideLoading } = useSizeGuide(garment?.size_guide_id)
  const { recommendation } = useRecommendedSize(garment?.size_guide_id)
  const { saved, toggle: toggleSave, requiresAuth: saveRequiresAuth } = useSaveGarment(garment?.id)
  const { addItem, count: cartCount } = useCart()
  const { reviews, average, loading: reviewsLoading } = useGarmentReviews(garment?.id)
  const { ask, sending: askSending, requiresAuth: askRequiresAuth } = useAskQuestion()
  const { questions, loading: questionsLoading, refetch: refetchQuestions } = useGarmentQuestions(garment?.id)
  const session = useAuthStore((s) => s.session)
  const viewerIsBrand = useAuthStore((s) => !!s.profile?.is_brand)
  const { brand: myBrand } = useMyBrand(viewerIsBrand ? session?.user.id : undefined)

  async function handleAskQuestion() {
    if (!garment?.brand_id || !questionText.trim()) return
    if (askRequiresAuth) { router.push('/auth'); return }
    const { error } = await ask(garment.brand_id, questionText.trim(), garment.id)
    if (!error) {
      setQuestionText('')
      refetchQuestions()
    }
  }

  useEffect(() => {
    if (!id) return
    setActiveImage(0)
    fetchGarment(id)
  }, [id])

  useEffect(() => {
    if (garment?.brand_id) fetchRelated(garment.brand_id, garment.id)
  }, [garment?.brand_id, garment?.id])

  async function fetchGarment(garmentId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('prendas')
      .select('*, brand:marcas(*)')
      .eq('id', garmentId)
      .maybeSingle()
    setGarment(data as (Garment & { brand?: Brand }) | null)
    setSelectedSize(null)
    setQuantity(1)
    setLoading(false)
  }

  async function fetchRelated(brandId: string, excludeId: string) {
    const { data } = await supabase
      .from('prendas')
      .select('*')
      .eq('brand_id', brandId)
      .eq('descontinuada', false)
      .neq('id', excludeId)
      .limit(8)
    setRelated((data ?? []) as Garment[])
  }

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 1800)
  }

  async function handleAddToCart() {
    if (!garment) return
    if (saveRequiresAuth) { router.push('/auth'); return }
    if (hasSizes && !selectedSize) return
    setAdding(true)
    await addItem(garment.id, hasSizes ? selectedSize : null, quantity)
    setAdding(false)
    showToast('Agregado al carrito')
  }

  function handleToggleSave() {
    if (saveRequiresAuth) { router.push('/auth'); return }
    toggleSave()
  }

  async function handleShare() {
    if (!garment) return
    try {
      await Share.share({
        message: `Mirá "${garment.name}" de ${garment.brand?.name ?? 'OPA'} — $${garment.price.toLocaleString('es-AR')}`,
      })
    } catch {}
  }

  function handleOpenStore() {
    if (garment?.external_url) Linking.openURL(garment.external_url)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.rosaOpa} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  if (!garment) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Prenda no encontrada</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isOwnGarment = viewerIsBrand && myBrand?.id === garment.brand_id

  const availableSizes: string[] = garment.available_sizes ?? []
  const hasSizes = availableSizes.length > 0
  const stockMap = garment.stock_por_talle ?? null

  const selectedStock = hasSizes
    ? (selectedSize ? stockMap?.[selectedSize] ?? null : null)
    : (stockMap ? Object.values(stockMap).reduce((s, v) => s + v, 0) : null)

  const outOfStockForSelection = hasSizes
    ? (selectedSize != null && selectedStock === 0)
    : selectedStock === 0

  const canAddToCart = !garment.descontinuada
    && garment.sale_mode === 'direct'
    && (!hasSizes || !!selectedSize)
    && !outOfStockForSelection

  const maxQuantity = selectedStock != null ? Math.max(1, selectedStock) : 10

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header flotante sobre la imagen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.headerIcon} contentFit="contain" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
            <Image
              source={{ uri: `${STORAGE}/compartir.png` }}
              style={styles.headerIcon}
              contentFit="contain"
              tintColor={colors.negro}
            />
          </TouchableOpacity>
          {!viewerIsBrand && (
            <TouchableOpacity onPress={() => router.push('/cart')} style={styles.headerBtn}>
              <Image source={{ uri: `${STORAGE}/bag_negra.png` }} style={styles.headerIcon} contentFit="contain" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Galería de imágenes */}
        <View>
          <FlatList
            data={galleryImages}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth)
              setActiveImage(idx)
            }}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.95} onPress={() => setZoomVisible(true)}>
                <Image
                  source={{ uri: item }}
                  style={[styles.image, { width: screenWidth, height: screenWidth * 1.1 }]}
                  contentFit="cover"
                />
              </TouchableOpacity>
            )}
          />
          {galleryImages.length > 1 && (
            <View style={styles.imageDots}>
              {galleryImages.map((_, i) => (
                <View key={i} style={[styles.imageDot, i === activeImage && styles.imageDotActive]} />
              ))}
            </View>
          )}
        </View>

        {!viewerIsBrand && (
          <TouchableOpacity
            style={[styles.saveFloatBtn, { top: screenWidth * 1.1 - 56 }]}
            onPress={handleToggleSave}
            hitSlop={6}
          >
            <Text style={[styles.saveFloatIcon, saved && styles.saveFloatIconActive]}>{saved ? '★' : '☆'}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.body}>
          {/* Brand */}
          {garment.brand && (
            <TouchableOpacity
              style={styles.brandRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/marca/${garment.brand!.id}`)}
            >
              {garment.brand.logo_url ? (
                <Image source={{ uri: garment.brand.logo_url }} style={styles.brandLogo} contentFit="cover" />
              ) : (
                <View style={[styles.brandLogo, styles.brandLogoPlaceholder]}>
                  <Text style={styles.brandLogoInitial}>{garment.brand.name[0]}</Text>
                </View>
              )}
              <Text style={styles.brandName}>{garment.brand.name}</Text>
            </TouchableOpacity>
          )}

          {garment.descontinuada && (
            <View style={styles.discontinuedBanner}>
              <Text style={styles.discontinuedBannerText}>Esta prenda fue descontinuada por la marca</Text>
            </View>
          )}

          {/* Name + price + color */}
          <Text style={styles.garmentName}>{garment.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>${garment.price.toLocaleString('es-AR')}</Text>
            {garment.color && (
              <View style={styles.colorTag}>
                <View style={[styles.colorDot, { backgroundColor: colorToHex(garment.color) }]} />
                <Text style={styles.colorText}>{garment.color}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {garment.description && (
            <Text style={styles.description}>{garment.description}</Text>
          )}

          {/* Size selector */}
          {hasSizes && (
            <View style={styles.section}>
              <View style={styles.sizeHeader}>
                <Text style={styles.sectionTitle}>TALLE</Text>
                {garment.size_guide_id && (
                  <TouchableOpacity onPress={() => setSizeSheetVisible(true)} style={styles.infoBtn}>
                    <Text style={styles.infoBtnText}>ⓘ Guía de talles</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sizeRow}>
                {availableSizes.map((size) => {
                  const isSelected = selectedSize === size
                  const isRecommended = recommendation?.size_label === size
                  const sizeStock = stockMap?.[size] ?? null
                  const isSoldOut = sizeStock === 0
                  return (
                    <TouchableOpacity
                      key={size}
                      onPress={() => !isSoldOut && setSelectedSize(size)}
                      disabled={isSoldOut}
                      style={[
                        styles.sizeChip,
                        isSelected && styles.sizeChipSelected,
                        isRecommended && !isSelected && styles.sizeChipRecommended,
                        isSoldOut && styles.sizeChipDisabled,
                      ]}
                    >
                      <Text style={[
                        styles.sizeChipText,
                        isSelected && styles.sizeChipTextSelected,
                        isSoldOut && styles.sizeChipTextDisabled,
                      ]}>
                        {size}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {recommendation && (
                <Text style={styles.recommendedHint}>
                  Tu talle recomendado: <Text style={styles.recommendedBold}>{recommendation.size_label}</Text>
                </Text>
              )}
              {selectedSize && selectedStock != null && selectedStock > 0 && selectedStock <= 5 && (
                <Text style={styles.urgencyHint}>¡Últimas {selectedStock} unidades en talle {selectedSize}!</Text>
              )}
              {selectedSize && selectedStock === 0 && (
                <Text style={styles.soldOutHint}>Sin stock en este talle</Text>
              )}
            </View>
          )}

          {/* Quantity — solo para venta directa */}
          {garment.sale_mode === 'direct' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CANTIDAD</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  style={styles.stepperBtn}
                  disabled={quantity <= 1}
                >
                  <Text style={[styles.stepperBtnText, quantity <= 1 && styles.stepperBtnTextDisabled]}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{quantity}</Text>
                <TouchableOpacity
                  onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                  style={styles.stepperBtn}
                  disabled={quantity >= maxQuantity}
                >
                  <Text style={[styles.stepperBtnText, quantity >= maxQuantity && styles.stepperBtnTextDisabled]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tags */}
          {(garment.style || garment.category) && (
            <View style={styles.tagRow}>
              {garment.category && <View style={styles.tag}><Text style={styles.tagText}>{garment.category}</Text></View>}
              {garment.style && <View style={styles.tag}><Text style={styles.tagText}>{garment.style}</Text></View>}
            </View>
          )}

          {/* Más de esta marca */}
          {related.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MÁS DE {garment.brand?.name?.toUpperCase()}</Text>
              <FlatList
                data={related}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.sm }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.relatedCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/product/${item.id}`)}
                  >
                    <Image source={{ uri: item.image_url ?? undefined }} style={styles.relatedImage} contentFit="cover" />
                    <Text style={styles.relatedName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.relatedPrice}>${item.price.toLocaleString('es-AR')}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Reseñas */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>RESEÑAS</Text>
              {reviews.length > 0 && (
                <Text style={styles.reviewsAverage}>★ {average.toFixed(1)} ({reviews.length})</Text>
              )}
            </View>
            {reviewsLoading ? (
              <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: spacing.md }} />
            ) : reviews.length === 0 ? (
              <Text style={styles.reviewsEmpty}>Aún no hay reseñas de esta prenda.</Text>
            ) : (
              <View style={{ gap: spacing.md }}>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewRow}>
                    <View style={styles.reviewHeaderRow}>
                      <Text style={styles.reviewUser}>{r.user?.username ? `@${r.user.username}` : 'Usuario'}</Text>
                      <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                    </View>
                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Preguntas y respuestas — público, estilo Mercado Libre: cualquiera que
              visite la publicación puede leer las preguntas de otros usuarios y sus
              respuestas, no solo quien preguntó */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PREGUNTAS Y RESPUESTAS</Text>

            {!viewerIsBrand && (
              <View style={styles.askBox}>
                <TextInput
                  style={styles.askInput}
                  placeholder={`Preguntale algo a ${garment.brand?.name ?? 'la marca'} sobre esta prenda...`}
                  placeholderTextColor={colors.grisClaro}
                  value={questionText}
                  onChangeText={setQuestionText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.askBtn, !questionText.trim() && styles.askBtnDisabled]}
                  disabled={!questionText.trim() || askSending}
                  onPress={handleAskQuestion}
                  activeOpacity={0.85}
                >
                  {askSending ? (
                    <ActivityIndicator color={colors.blanco} size="small" />
                  ) : (
                    <Text style={styles.askBtnText}>Preguntar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {questionsLoading ? (
              <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: spacing.md }} />
            ) : questions.length === 0 ? (
              <Text style={styles.questionsEmpty}>Todavía no hay preguntas sobre esta prenda. ¡Sé el primero en preguntar!</Text>
            ) : (
              <View style={styles.qaList}>
                {questions.map((q) => (
                  <View key={q.id} style={styles.qaRow}>
                    <Text style={styles.qaQuestion}>P: {q.question}</Text>
                    <Text style={styles.qaMeta}>@{q.user?.username ?? 'usuario'} · {timeAgo(q.created_at)}</Text>
                    {q.answer ? (
                      <Text style={styles.qaAnswer}>R: {q.answer}</Text>
                    ) : (
                      <Text style={styles.qaPending}>Todavía sin responder</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* CTA — una marca no compra ni guarda; en su propia prenda puede editarla en vez de eso */}
      {isOwnGarment ? (
        <View style={styles.cta}>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push(`/brand/create-garment?id=${garment.id}`)}>
            <Text style={styles.ctaBtnText}>Editar prenda</Text>
          </TouchableOpacity>
        </View>
      ) : viewerIsBrand ? null : (
        <View style={styles.cta}>
          {garment.descontinuada ? (
            <View style={[styles.ctaBtn, styles.ctaBtnDisabled]}>
              <Text style={styles.ctaBtnText}>Ya no disponible</Text>
            </View>
          ) : garment.sale_mode === 'redirect' ? (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleOpenStore}>
              <Text style={styles.ctaBtnText}>Ver en tienda →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, (!canAddToCart || adding) && styles.ctaBtnDisabled]}
              disabled={!canAddToCart || adding}
              onPress={handleAddToCart}
            >
              <Text style={styles.ctaBtnText}>
                {outOfStockForSelection ? 'Sin stock' : adding ? 'Agregando…' : 'Agregar al carrito'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Size Guide Sheet */}
      <SizeGuideSheet
        visible={sizeSheetVisible}
        onClose={() => setSizeSheetVisible(false)}
        guide={guide}
        entries={entries}
        loading={guideLoading}
        recommendedSize={recommendation?.size_label ?? null}
        category={garment.category}
      />

      {/* Zoom de imagen */}
      <ZoomableImage uri={galleryImages[activeImage] ?? garment.image_url} visible={zoomVisible} onClose={() => setZoomVisible(false)} />
    </SafeAreaView>
  )
}

// Swatch de color de la prenda: usa la paleta estandarizada compartida con el
// selector de create-garment.tsx/search.tsx. Un color cargado como "Otro"
// (texto libre) no tiene hex conocido y cae al gris genérico.
function colorToHex(colorName: string): string {
  return GARMENT_COLOR_HEX[colorName] ?? colors.grisMedio
}

// ─── SizeGuideSheet ───────────────────────────────────────────────────────────

interface SizeGuideSheetProps {
  visible: boolean
  onClose: () => void
  guide: { name: string; category: string } | null
  entries: SizeGuideEntry[]
  loading: boolean
  recommendedSize: string | null
  category: string | null
}

function SizeGuideSheet({ visible, onClose, guide, entries, loading, recommendedSize, category }: SizeGuideSheetProps) {
  const cols = measurementCols(category)

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.sheetOverlay} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Guía de talles</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.rosaOpa} style={{ marginVertical: 32 }} />
        ) : entries.length === 0 ? (
          <Text style={styles.sheetEmpty}>No hay datos disponibles.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Column headers */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, styles.tableCellHeader, styles.tableCellLabel]}>
                  <Text style={styles.tableHeaderText}>TALLE</Text>
                </View>
                {cols.map((col) => (
                  <View key={col.key} style={[styles.tableCell, styles.tableCellHeader]}>
                    <Text style={styles.tableHeaderText}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {/* Rows */}
              {entries.map((entry) => {
                const isRecommended = entry.size_label === recommendedSize
                return (
                  <View key={entry.id} style={[styles.tableRow, isRecommended && styles.tableRowRecommended]}>
                    <View style={[styles.tableCell, styles.tableCellLabel]}>
                      <Text style={[styles.tableCellText, styles.tableCellLabelText, isRecommended && styles.tableCellTextRecommended]}>
                        {entry.size_label}
                      </Text>
                    </View>
                    {cols.map((col) => {
                      const minKey = `${col.key}_min` as keyof SizeGuideEntry
                      const maxKey = `${col.key}_max` as keyof SizeGuideEntry
                      const min = entry[minKey] as number | null
                      const max = entry[maxKey] as number | null
                      const value = min != null && max != null ? `${min}–${max}` : min != null ? `${min}+` : '—'
                      return (
                        <View key={col.key} style={styles.tableCell}>
                          <Text style={[styles.tableCellText, isRecommended && styles.tableCellTextRecommended]}>
                            {value}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        )}

        {recommendedSize && (
          <View style={styles.sheetRecommendedBanner}>
            <Text style={styles.sheetRecommendedText}>
              Tu talle recomendado: <Text style={{ fontWeight: '700' }}>{recommendedSize}</Text>
            </Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

function measurementCols(category: string | null) {
  if (category === 'calzado') return [{ key: 'foot_length', label: 'Pie (cm)' }]
  if (category === 'piernas' || category === 'bottoms') {
    return [
      { key: 'waist', label: 'Cintura' },
      { key: 'hip', label: 'Cadera' },
      { key: 'thigh', label: 'Muslo' },
    ]
  }
  // default: tops
  return [
    { key: 'chest', label: 'Busto' },
    { key: 'waist', label: 'Cintura' },
    { key: 'hip', label: 'Cadera' },
  ]
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.grisClaro, fontSize: 16 },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: { width: 18, height: 18 },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.rosaOpa, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: colors.blanco, fontSize: 9, fontWeight: '700' },

  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', padding: spacing.md },
  backIcon: { width: 20, height: 20 },

  image: { backgroundColor: colors.grisBorde },
  imageDots: {
    position: 'absolute', bottom: spacing.sm, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  imageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  imageDotActive: { backgroundColor: colors.blanco, width: 8, height: 8, borderRadius: 4 },
  saveFloatBtn: {
    position: 'absolute', right: spacing.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  saveFloatIcon: { fontSize: 22, color: colors.grisOscuro },
  saveFloatIconActive: { color: colors.rosaOpa },

  body: { padding: spacing.lg },
  discontinuedBanner: {
    backgroundColor: colors.grisBorde,
    borderRadius: radius.chip,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  discontinuedBannerText: { fontSize: 12, color: colors.grisOscuro, fontWeight: '600' },

  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  brandLogo: { width: 28, height: 28, borderRadius: radius.avatar, marginRight: spacing.sm, backgroundColor: colors.grisBorde },
  brandLogoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  brandLogoInitial: { fontSize: 12, fontWeight: '700', color: colors.grisClaro },
  brandName: { fontSize: 13, color: colors.grisOscuro, fontWeight: '500' },

  garmentName: { fontSize: 22, fontWeight: '800', color: colors.negro, marginBottom: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  price: { fontSize: 20, fontWeight: '700', color: colors.rosaOpa },
  colorTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.grisBorde },
  colorText: { fontSize: 13, color: colors.grisOscuro },
  description: { fontSize: 14, color: colors.grisOscuro, lineHeight: 20, marginBottom: spacing.lg },

  section: { marginBottom: spacing.lg },
  sizeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.negro, letterSpacing: 1 },
  infoBtn: { flexDirection: 'row', alignItems: 'center' },
  infoBtnText: { fontSize: 12, color: colors.rosaOpa, fontWeight: '500' },

  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sizeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: colors.grisMedio,
    backgroundColor: colors.blanco,
  },
  sizeChipSelected: { borderColor: colors.negro, backgroundColor: colors.negro },
  sizeChipRecommended: { borderColor: colors.rosaOpa, borderWidth: 2 },
  sizeChipDisabled: { backgroundColor: colors.grisBorde, borderColor: colors.grisBorde },
  sizeChipText: { fontSize: 13, fontWeight: '600', color: colors.negro },
  sizeChipTextSelected: { color: colors.blanco },
  sizeChipTextDisabled: { color: colors.grisClaro, textDecorationLine: 'line-through' },

  recommendedHint: { fontSize: 12, color: colors.grisClaro, marginTop: spacing.sm },
  recommendedBold: { color: colors.rosaOpa, fontWeight: '700' },
  urgencyHint: { fontSize: 12, color: colors.rosaOpa, fontWeight: '700', marginTop: spacing.sm },
  soldOutHint: { fontSize: 12, color: colors.grisClaro, marginTop: spacing.sm },

  stepper: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: colors.grisMedio, borderRadius: radius.chip,
  },
  stepperBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 18, color: colors.negro, fontWeight: '600' },
  stepperBtnTextDisabled: { color: colors.grisMedio },
  stepperValue: { minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.negro },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.tag,
    borderWidth: 1,
    borderColor: colors.bordeTag,
  },
  tagText: { fontSize: 12, color: colors.grisOscuro },

  relatedCard: { width: 110 },
  relatedImage: { width: 110, height: 140, borderRadius: radius.card, backgroundColor: colors.grisBorde },
  relatedName: { fontSize: 12, fontWeight: '600', color: colors.negro, marginTop: 6 },
  relatedPrice: { fontSize: 12, fontWeight: '700', color: colors.rosaOpa, marginTop: 2 },

  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  reviewsAverage: { fontSize: 13, fontWeight: '700', color: colors.rosaOpa },
  reviewsEmpty: { fontSize: 13, color: colors.grisClaro },
  reviewRow: { borderBottomWidth: 1, borderBottomColor: colors.grisBorde, paddingBottom: spacing.md },
  reviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUser: { fontSize: 13, fontWeight: '700', color: colors.negro },
  reviewStars: { fontSize: 12, color: colors.rosaOpa },
  reviewComment: { fontSize: 13, color: colors.grisOscuro, marginTop: 4, lineHeight: 18 },

  askBox: { gap: spacing.sm, marginBottom: spacing.md },
  askInput: {
    borderWidth: 1, borderColor: colors.grisMedio, borderRadius: radius.button,
    padding: spacing.sm, fontSize: 13, color: colors.negro, minHeight: 56,
    textAlignVertical: 'top',
  },
  askBtn: {
    backgroundColor: colors.rosaOpa, borderRadius: radius.button,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  questionsEmpty: { fontSize: 13, color: colors.grisClaro },
  qaList: { gap: spacing.md },
  qaRow: { borderBottomWidth: 1, borderBottomColor: colors.grisBorde, paddingBottom: spacing.md },
  qaQuestion: { fontSize: 13, fontWeight: '700', color: colors.negro, lineHeight: 18 },
  qaMeta: { fontSize: 11, color: colors.grisClaro, marginTop: 2 },
  qaAnswer: { fontSize: 13, color: colors.grisOscuro, marginTop: 6, lineHeight: 18 },
  qaPending: { fontSize: 12, color: colors.grisClaro, fontStyle: 'italic', marginTop: 6 },
  askBtnDisabled: { backgroundColor: colors.rosaOpaLight },
  askBtnText: { fontSize: 13, fontWeight: '700', color: colors.blanco, fontFamily: fonts.palanquinDark },

  cta: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
  },
  ctaBtn: {
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: colors.grisMedio },
  ctaBtnText: { color: colors.blanco, fontSize: 15, fontWeight: '700' },

  toast: {
    position: 'absolute', bottom: 90, left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.negro, borderRadius: radius.chip,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  toastText: { color: colors.blanco, fontSize: 13, fontWeight: '600' },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.grisMedio, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.negro },
  sheetClose: { fontSize: 18, color: colors.grisClaro, padding: 4 },
  sheetEmpty: { textAlign: 'center', color: colors.grisClaro, padding: spacing.xl },

  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.grisBorde },
  tableRowRecommended: { backgroundColor: colors.rosaOpaLight },
  tableCell: { width: 80, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, alignItems: 'center' },
  tableCellHeader: { backgroundColor: colors.grisBorde },
  tableCellLabel: { width: 64 },
  tableHeaderText: { fontSize: 10, fontWeight: '700', color: colors.grisOscuro, letterSpacing: 0.5 },
  tableCellText: { fontSize: 13, color: colors.negro },
  tableCellLabelText: { fontWeight: '700' },
  tableCellTextRecommended: { color: colors.rosaOpa, fontWeight: '700' },

  sheetRecommendedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.rosaOpaLight,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  sheetRecommendedText: { fontSize: 14, color: colors.rosaOpa },
})
