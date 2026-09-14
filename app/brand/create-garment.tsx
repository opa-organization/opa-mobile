import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { GARMENT_COLORS } from '../../constants/garmentColors'
import { useAuthStore } from '../../store/useAuthStore'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useSizeGuidesForCategory } from '../../hooks/useSizeGuidesForCategory'
import { uploadGarmentImage } from '../../lib/uploadImage'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'

const STORAGE = 'https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/assets'

const CATEGORIES = [
  { key: 'torso', label: 'Torso' },
  { key: 'piernas', label: 'Piernas' },
  { key: 'calzado', label: 'Calzado' },
  { key: 'extras', label: 'Extras' },
] as const

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const CALZADO_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42']

function sizeOptionsFor(category: string | null): string[] {
  return category === 'calzado' ? CALZADO_SIZES : STANDARD_SIZES
}

export default function CreateGarmentScreen() {
  const router = useRouter()
  const { id: garmentId } = useLocalSearchParams<{ id?: string }>()
  const isEditing = !!garmentId
  const { session } = useAuthStore()
  const { brand } = useMyBrand(session?.user.id)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [color, setColor] = useState('')
  const [style, setStyle] = useState('')
  const [sizeStock, setSizeStock] = useState<Record<string, string>>({})
  const [sizeGuideId, setSizeGuideId] = useState<string | null>(null)
  const [saleMode, setSaleMode] = useState<'direct' | 'redirect'>('direct')
  const [externalUrl, setExternalUrl] = useState('')
  const [localImageUri, setLocalImageUri] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)

  const [loadingGarment, setLoadingGarment] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { guides, loading: guidesLoading } = useSizeGuidesForCategory(category, brand?.id)

  // Precarga los datos de la prenda cuando se abre en modo edición (?id=...).
  // skipCategoryResetRef evita que el efecto de abajo (que borra talles/guía al
  // cambiar de categoría, pensado para cuando el usuario elige otra categoría a
  // mano) pise los valores recién precargados apenas se setea `category`.
  const skipCategoryResetRef = useRef(false)
  useEffect(() => {
    if (!garmentId || !brand) return
    let cancelled = false
    setLoadingGarment(true)
    supabase
      .from('prendas')
      .select('*')
      .eq('id', garmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data || data.brand_id !== brand.id) {
          setError('No tenés permiso para editar esta prenda.')
          setLoadingGarment(false)
          return
        }
        skipCategoryResetRef.current = true
        setName(data.name ?? '')
        setDescription(data.description ?? '')
        setPrice(data.price != null ? String(Math.round(Number(data.price))) : '')
        setCategory(data.category ?? null)
        setColor(data.color ?? '')
        setStyle(data.style ?? '')
        const stock: Record<string, string> = {}
        Object.entries((data.stock_por_talle as Record<string, number>) ?? {}).forEach(([size, qty]) => {
          stock[size] = String(qty)
        })
        setSizeStock(stock)
        setSizeGuideId(data.size_guide_id ?? null)
        setSaleMode((data.sale_mode as 'direct' | 'redirect') ?? 'direct')
        setExternalUrl(data.external_url ?? '')
        setExistingImageUrl(data.image_url ?? null)
        setLoadingGarment(false)
      })
    return () => { cancelled = true }
  }, [garmentId, brand])

  // Al cambiar de categoría, los talles y la guía elegida ya no son válidos
  // (calzado usa numeración EU, el resto XS–XXL; las guías son por categoría).
  useEffect(() => {
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false
      return
    }
    setSizeStock({})
    setSizeGuideId(null)
  }, [category])

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError('Necesitamos acceso a tus fotos para subir la imagen.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1.1],
    })
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri)
    }
  }

  function toggleSize(size: string) {
    setSizeStock((prev) => {
      if (size in prev) {
        const next = { ...prev }
        delete next[size]
        return next
      }
      return { ...prev, [size]: '10' }
    })
  }

  function updateStock(size: string, text: string) {
    setSizeStock((prev) => ({ ...prev, [size]: text.replace(/[^0-9]/g, '') }))
  }

  function validate(): string | null {
    if (!localImageUri && !existingImageUrl) return 'Agregá una foto de la prenda.'
    if (!name.trim()) return 'Ponele un nombre a la prenda.'
    const priceNum = Number(price)
    if (!price || isNaN(priceNum) || priceNum <= 0) return 'El precio tiene que ser un número mayor a 0.'
    if (!category) return 'Elegí una categoría.'
    const selectedSizes = Object.keys(sizeStock)
    if (selectedSizes.length === 0) return 'Elegí al menos un talle disponible.'
    if (selectedSizes.some((s) => !sizeStock[s] || Number(sizeStock[s]) <= 0)) {
      return 'Cargá el stock de cada talle que elegiste (tiene que ser mayor a 0).'
    }
    if (saleMode === 'redirect' && !externalUrl.trim()) {
      return 'Si vendés por redirección, necesitás la URL de tu tienda.'
    }
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    if (!brand) { setError('No se encontró tu marca.'); return }

    setError(null)
    setSaving(true)
    try {
      let imageUrl: string | null = existingImageUrl
      if (localImageUri) {
        imageUrl = await uploadGarmentImage(localImageUri, brand.name, name.trim())
      }

      const stockPorTalle: Record<string, number> = {}
      Object.entries(sizeStock).forEach(([size, qty]) => { stockPorTalle[size] = Number(qty) })

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        category,
        style: style.trim() || null,
        image_url: imageUrl,
        color: color.trim() || null,
        available_sizes: Object.keys(sizeStock),
        stock_por_talle: stockPorTalle,
        size_guide_id: sizeGuideId,
        sale_mode: saleMode,
        external_url: saleMode === 'redirect' ? externalUrl.trim() : null,
      }

      if (isEditing) {
        await api.updateGarment(garmentId!, payload)
      } else {
        await api.createGarment(payload)
      }

      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo ${isEditing ? 'guardar los cambios' : 'crear la prenda'}. Probá de nuevo.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar prenda' : 'Nueva prenda'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loadingGarment ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.rosaOpa} size="large" />
        </View>
      ) : error && isEditing && !name ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Imagen */}
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
            {localImageUri ? (
              <Image source={{ uri: localImageUri }} style={styles.imagePreview} contentFit="cover" />
            ) : existingImageUrl ? (
              <Image source={{ uri: existingImageUrl }} style={styles.imagePreview} contentFit="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>+</Text>
                <Text style={styles.imagePlaceholderText}>Agregar foto</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Info básica */}
          <View style={styles.card}>
            <Field label="Nombre">
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Trench Camel" placeholderTextColor={colors.grisMedio} />
            </Field>
            <Field label="Descripción">
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Contá algo de la prenda"
                placeholderTextColor={colors.grisMedio}
                multiline
              />
            </Field>
            <Field label="Precio" last>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.grisMedio}
                keyboardType="number-pad"
              />
            </Field>
          </View>

          {/* Categoría */}
          <Section title="CATEGORÍA">
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.chip, category === c.key && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, category === c.key && styles.chipTextSelected]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Color — paleta estandarizada (chips), reemplaza el texto libre de antes.
              Toggle: tocar el color ya elegido lo deselecciona (color es opcional). */}
          <Section title="COLOR">
            <View style={styles.chipRow}>
              {GARMENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(color === c ? '' : c)}
                  style={[styles.chip, color === c && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, color === c && styles.chipTextSelected]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Estilo */}
          <View style={styles.card}>
            <Field label="Estilo" last>
              <TextInput style={styles.input} value={style} onChangeText={setStyle} placeholder="Ej. street, vintage, minimal" placeholderTextColor={colors.grisMedio} />
            </Field>
          </View>

          {/* Talles + stock */}
          {category && (
            <Section title="TALLES Y STOCK" subtitle="Tocá un talle para activarlo y cargá el stock">
              <View style={styles.sizeGrid}>
                {sizeOptionsFor(category).map((size) => {
                  const selected = size in sizeStock
                  return (
                    <View key={size} style={styles.sizeRow}>
                      <TouchableOpacity
                        onPress={() => toggleSize(size)}
                        style={[styles.chip, styles.sizeChip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{size}</Text>
                      </TouchableOpacity>
                      {selected && (
                        <TextInput
                          style={styles.stockInput}
                          value={sizeStock[size]}
                          onChangeText={(t) => updateStock(size, t)}
                          keyboardType="number-pad"
                          placeholder="Stock"
                          placeholderTextColor={colors.grisMedio}
                        />
                      )}
                    </View>
                  )
                })}
              </View>
            </Section>
          )}

          {/* Guía de talles */}
          {category && (
            <Section title="GUÍA DE TALLES (OPCIONAL)">
              {guidesLoading ? (
                <ActivityIndicator color={colors.rosaOpa} />
              ) : (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setSizeGuideId(null)}
                    style={[styles.chip, sizeGuideId === null && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, sizeGuideId === null && styles.chipTextSelected]}>Sin guía</Text>
                  </TouchableOpacity>
                  {guides.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setSizeGuideId(g.id)}
                      style={[styles.chip, sizeGuideId === g.id && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, sizeGuideId === g.id && styles.chipTextSelected]}>{g.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Section>
          )}

          {/* Modo de venta */}
          <Section title="MODO DE VENTA">
            <View style={styles.saleModeRow}>
              <TouchableOpacity
                style={[styles.saleModeBtn, saleMode === 'direct' && styles.saleModeBtnSelected]}
                onPress={() => setSaleMode('direct')}
              >
                <Text style={[styles.saleModeText, saleMode === 'direct' && styles.saleModeTextSelected]}>Directo en OPA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saleModeBtn, saleMode === 'redirect' && styles.saleModeBtnSelected]}
                onPress={() => setSaleMode('redirect')}
              >
                <Text style={[styles.saleModeText, saleMode === 'redirect' && styles.saleModeTextSelected]}>Redirigir a mi tienda</Text>
              </TouchableOpacity>
            </View>
            {saleMode === 'redirect' && (
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={externalUrl}
                onChangeText={setExternalUrl}
                placeholder="https://mitienda.com/producto"
                placeholderTextColor={colors.grisMedio}
                keyboardType="url"
                autoCapitalize="none"
              />
            )}
          </Section>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.blanco} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{isEditing ? 'Guardar cambios' : 'Publicar prenda'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.field, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.grisBorde,
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  backIcon: { width: 20, height: 20 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.negro, fontFamily: fonts.mergeOne },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  imagePicker: {
    width: 160, height: 176, borderRadius: radius.card, overflow: 'hidden',
    alignSelf: 'center', marginBottom: spacing.lg, backgroundColor: colors.grisBorde,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  imagePlaceholderIcon: { fontSize: 32, color: colors.grisClaro, fontWeight: '300' },
  imagePlaceholderText: { fontSize: 12, color: colors.grisClaro },

  card: {
    backgroundColor: colors.grisBorde,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  field: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.grisMedio },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.grisOscuro, marginBottom: 4 },
  input: { fontSize: 15, color: colors.negro, padding: 0 },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  urlInput: { marginTop: spacing.sm, backgroundColor: colors.grisBorde, borderRadius: radius.chip, padding: spacing.md },

  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.negro, letterSpacing: 1, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: 12, color: colors.grisClaro, marginBottom: spacing.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.chip, borderWidth: 1.5, borderColor: colors.grisMedio, backgroundColor: colors.blanco,
  },
  chipSelected: { borderColor: colors.negro, backgroundColor: colors.negro },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.negro },
  chipTextSelected: { color: colors.blanco },

  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sizeChip: { minWidth: 48, alignItems: 'center' },
  stockInput: {
    width: 56, fontSize: 13, color: colors.negro, backgroundColor: colors.grisBorde,
    borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, textAlign: 'center',
  },

  saleModeRow: { flexDirection: 'row', gap: spacing.sm },
  saleModeBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.chip,
    borderWidth: 1.5, borderColor: colors.grisMedio, alignItems: 'center',
  },
  saleModeBtnSelected: { borderColor: colors.negro, backgroundColor: colors.negro },
  saleModeText: { fontSize: 13, fontWeight: '600', color: colors.negro, textAlign: 'center' },
  saleModeTextSelected: { color: colors.blanco },

  errorText: { color: colors.rosaOpa, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },

  submitBtn: { backgroundColor: colors.rosaOpa, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.blanco },
})
