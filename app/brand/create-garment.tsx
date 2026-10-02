import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { GARMENT_CATEGORIES as CATEGORIES } from '../../constants/garmentCategories'
import { useAuthStore } from '../../store/useAuthStore'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useBrandColors } from '../../hooks/useBrandColors'
import { GarmentColorField, type ColorChoice } from '../../components/garment/GarmentColorField'
import { useSizeGuidesForCategory } from '../../hooks/useSizeGuidesForCategory'
import { uploadGarmentImage } from '../../lib/uploadImage'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'
import { dedupeCaseInsensitive } from '../../lib/text'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const CALZADO_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42']

const MAX_IMAGES = 5

// Imagen de la prenda dentro del form: puede ser un archivo recién elegido
// (local, todavía sin subir) o una ya subida a Storage (viene de editar una
// prenda existente). La primera de la lista es siempre la "portada"
// (prendas.image_url, el campo que ya usa el resto de la app).
type PickedImage = { uri: string; local: boolean }

// Moderación básica: límites de caracteres para evitar texto libre desmedido
// (nombres/descripciones absurdamente largos, URLs rotas, etc.) antes de que
// lleguen a la DB.
const NAME_MAX_LENGTH = 60
const DESCRIPTION_MAX_LENGTH = 500
const PRICE_MAX_LENGTH = 9 // hasta $999.999.999, ya filtrado a solo dígitos
const URL_MAX_LENGTH = 300
const CUSTOM_OPTION_MAX_LENGTH = 30 // "Otro" en el desplegable de Estilo

// Convierte las 4 columnas de color de `prendas` en la lista ordenada que usa el
// selector (índice 0 = principal, 1 = secundario), y al revés al guardar.
function choicesFromRow(row: {
  color: string | null; color_id: string | null
  color_secundario: string | null; color_secundario_id: string | null
}): ColorChoice[] {
  const out: ColorChoice[] = []
  if (row.color) out.push({ kind: 'standard', name: row.color })
  else if (row.color_id) out.push({ kind: 'custom', id: row.color_id })
  if (row.color_secundario) out.push({ kind: 'standard', name: row.color_secundario })
  else if (row.color_secundario_id) out.push({ kind: 'custom', id: row.color_secundario_id })
  return out
}

function columnsFromChoices(choices: ColorChoice[]) {
  const [primary, secondary] = choices
  return {
    color: primary?.kind === 'standard' ? primary.name : null,
    color_id: primary?.kind === 'custom' ? primary.id : null,
    color_secundario: secondary?.kind === 'standard' ? secondary.name : null,
    color_secundario_id: secondary?.kind === 'custom' ? secondary.id : null,
  }
}

function sizeOptionsFor(category: string | null): string[] {
  return category === 'calzado' ? CALZADO_SIZES : STANDARD_SIZES
}

export default function CreateGarmentScreen() {
  const router = useRouter()
  const { id: garmentId } = useLocalSearchParams<{ id?: string }>()
  const isEditing = !!garmentId
  const session = useAuthStore((s) => s.session)
  const { brand } = useMyBrand(session?.user.id)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [colorChoices, setColorChoices] = useState<ColorChoice[]>([])
  const [style, setStyle] = useState('')
  const [sizeStock, setSizeStock] = useState<Record<string, string>>({})
  const [sizeGuideId, setSizeGuideId] = useState<string | null>(null)
  const [saleMode, setSaleMode] = useState<'direct' | 'redirect'>('direct')
  const [externalUrl, setExternalUrl] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])

  const [loadingGarment, setLoadingGarment] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { guides, loading: guidesLoading } = useSizeGuidesForCategory(category, brand?.id)

  // Paleta propia de la marca. Se refresca al volver de "Gestionar"
  // (app/brand/colors.tsx), donde se pueden renombrar/recolorear/borrar colores.
  const { brandColors, loading: brandColorsLoading, refetch: refetchBrandColors, create: createBrandColor } = useBrandColors(brand?.id)
  const hasFocusedOnce = useRef(false)
  useFocusEffect(useCallback(() => {
    if (hasFocusedOnce.current) refetchBrandColors()
    hasFocusedOnce.current = true
  }, [refetchBrandColors]))
  // Si en Gestionar se borró un color que estaba elegido acá (todavía sin
  // guardar, así que la DB no lo protegía), se saca de la selección.
  useEffect(() => {
    if (brandColorsLoading) return
    setColorChoices((prev) => {
      const next = prev.filter((c) => c.kind === 'standard' || brandColors.some((bc) => bc.id === c.id))
      return next.length === prev.length ? prev : next
    })
  }, [brandColors, brandColorsLoading])

  // Opciones del selector de Estilo: valores reales que ya existen en `prendas.style`
  // (no es un enum, sigue siendo texto libre) — mismo criterio que `outfitTags` en
  // app/(tabs)/search.tsx. El selector igual ofrece "Otro" para poder introducir un
  // estilo nuevo que todavía no use ninguna prenda.
  const [styleOptions, setStyleOptions] = useState<string[]>([])
  useEffect(() => {
    supabase.from('prendas').select('style').not('style', 'is', null).then(({ data }) => {
      setStyleOptions(dedupeCaseInsensitive((data ?? []).map((r) => r.style as string)))
    })
  }, [])

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
        setColorChoices(choicesFromRow(data))
        setStyle(data.style ?? '')
        const stock: Record<string, string> = {}
        Object.entries((data.stock_por_talle as Record<string, number>) ?? {}).forEach(([size, qty]) => {
          stock[size] = String(qty)
        })
        setSizeStock(stock)
        setSizeGuideId(data.size_guide_id ?? null)
        setSaleMode((data.sale_mode as 'direct' | 'redirect') ?? 'direct')
        setExternalUrl(data.external_url ?? '')

        supabase
          .from('prenda_imagenes')
          .select('image_url')
          .eq('garment_id', garmentId)
          .order('sort_order', { ascending: true })
          .then(({ data: imgRows }) => {
            if (cancelled) return
            const urls = (imgRows ?? []).map((r) => r.image_url as string)
            setImages((urls.length > 0 ? urls : data.image_url ? [data.image_url] : []).map((uri) => ({ uri, local: false })))
            setLoadingGarment(false)
          })
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

  async function pickImages() {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError('Necesitamos acceso a tus fotos para subir imágenes.')
      return
    }
    // `allowsMultipleSelection` no es compatible con `allowsEditing` en Expo
    // (recortar no tiene sentido eligiendo varias a la vez).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
    })
    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets.slice(0, remaining).map((a) => ({ uri: a.uri, local: true }))
      setImages((prev) => [...prev, ...picked])
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
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
    if (images.length === 0) return 'Agregá al menos una foto de la prenda.'
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
      // Sube las imágenes nuevas (locales) en orden y arma la lista final de
      // URLs — las que ya estaban subidas (modo edición) se dejan como están.
      // La primera de la lista es siempre la portada (prendas.image_url).
      const finalUrls: string[] = []
      let localIndex = 0
      for (const img of images) {
        finalUrls.push(img.local ? await uploadGarmentImage(img.uri, brand.name, name.trim(), localIndex++) : img.uri)
      }
      const imageUrl = finalUrls[0]

      const stockPorTalle: Record<string, number> = {}
      Object.entries(sizeStock).forEach(([size, qty]) => { stockPorTalle[size] = Number(qty) })

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        category,
        style: style.trim() || null,
        image_url: imageUrl,
        available_sizes: Object.keys(sizeStock),
        stock_por_talle: stockPorTalle,
        size_guide_id: sizeGuideId,
        sale_mode: saleMode,
        external_url: saleMode === 'redirect' ? externalUrl.trim() : null,
      }

      let targetId: string | undefined = garmentId
      if (isEditing) {
        await api.updateGarment(garmentId!, payload)
      } else {
        await api.createGarment(payload)
        // La API no nos devuelve el id creado en esta llamada — lo resolvemos
        // por brand_id + image_url de portada, que es prácticamente único
        // (el nombre del archivo subido incluye un timestamp en milisegundos).
        const { data: created } = await supabase
          .from('prendas')
          .select('id')
          .eq('brand_id', brand.id)
          .eq('image_url', imageUrl)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        targetId = created?.id
      }

      if (!targetId) throw new Error('La prenda se guardó pero no se pudo terminar de configurar. Revisala desde tu catálogo.')

      // Colores: las 4 columnas en un solo UPDATE directo a Supabase (RLS
      // brand_owner_update_own_prendas), no por la API — ver nota en
      // CreateGarmentPayload (lib/api.ts).
      const { error: colorError } = await supabase
        .from('prendas')
        .update(columnsFromChoices(colorChoices))
        .eq('id', targetId)
      if (colorError) throw new Error('La prenda se guardó pero no se pudieron guardar los colores. Probá editarla de nuevo.')

      // Sincroniza la galería completa (`prenda_imagenes`): reemplazo total,
      // simple y suficiente dado el límite de 5 imágenes por prenda.
      {
        await supabase.from('prenda_imagenes').delete().eq('garment_id', targetId)
        await supabase.from('prenda_imagenes').insert(
          finalUrls.map((url, i) => ({ garment_id: targetId, image_url: url, sort_order: i }))
        )
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

          {/* Imágenes (hasta MAX_IMAGES; la primera es la portada) */}
          <View style={styles.imagesRow}>
            {images.map((img, i) => (
              <View key={`${img.uri}-${i}`} style={styles.imageThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" />
                {i === 0 && (
                  <View style={styles.imageCoverBadge}>
                    <Text style={styles.imageCoverBadgeText}>Portada</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(i)} hitSlop={6}>
                  <Text style={styles.imageRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.imageAddTile} onPress={pickImages} activeOpacity={0.8}>
                <Text style={styles.imagePlaceholderIcon}>+</Text>
                <Text style={styles.imagePlaceholderText}>Agregar foto</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.imagesHint}>{images.length}/{MAX_IMAGES} fotos — la primera es la portada</Text>

          {/* Info básica */}
          <View style={styles.card}>
            <Field label="Nombre">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej. Trench Camel"
                placeholderTextColor={colors.grisMedio}
                maxLength={NAME_MAX_LENGTH}
              />
              <Text style={styles.charCounter}>{name.length}/{NAME_MAX_LENGTH}</Text>
            </Field>
            <Field label="Descripción">
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Contá algo de la prenda"
                placeholderTextColor={colors.grisMedio}
                multiline
                maxLength={DESCRIPTION_MAX_LENGTH}
              />
              <Text style={styles.charCounter}>{description.length}/{DESCRIPTION_MAX_LENGTH}</Text>
            </Field>
            <Field label="Precio" last>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.grisMedio}
                keyboardType="number-pad"
                maxLength={PRICE_MAX_LENGTH}
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

          {/* Color — hasta 2 (principal + secundario), estándar o propios de la
              marca; "Otro" crea un color propio con rueda. Sigue siendo opcional. */}
          <Section title="COLOR">
            <GarmentColorField
              value={colorChoices}
              onChange={setColorChoices}
              brandName={brand?.name ?? 'tu marca'}
              brandColors={brandColors}
              onCreateColor={createBrandColor}
              onManage={() => router.push('/brand/colors')}
            />
          </Section>

          {/* Estilo — mismo componente desplegable, sin swatches (no es un color).
              Opciones dinámicas (valores reales de prendas.style) + "Otro". */}
          <Section title="ESTILO">
            <DropdownField
              title="Estilo"
              value={style}
              options={styleOptions}
              onChange={setStyle}
              placeholder="Elegí un estilo"
            />
          </Section>

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
              <View>
                <TextInput
                  style={[styles.input, styles.urlInput]}
                  value={externalUrl}
                  onChangeText={setExternalUrl}
                  placeholder="https://mitienda.com/producto"
                  placeholderTextColor={colors.grisMedio}
                  keyboardType="url"
                  autoCapitalize="none"
                  maxLength={URL_MAX_LENGTH}
                />
                <Text style={styles.charCounter}>{externalUrl.length}/{URL_MAX_LENGTH}</Text>
              </View>
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

// Campo desplegable (hoy solo Estilo; Color tiene su propio GarmentColorField):
// toca para abrir una hoja (mismo patrón de Modal que ya usa SizeGuideSheet en
// app/product/[id].tsx) con la lista de `options`. Siempre ofrece "Otro" al final
// para texto libre — el valor elegido puede no estar en `options` (ej. venía de
// "Otro" en una edición anterior).
function DropdownField({
  title, value, options, onChange, placeholder = 'Elegí una opción',
}: {
  title: string
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [otherMode, setOtherMode] = useState(false)
  const [draft, setDraft] = useState('')
  const isCustom = value !== '' && !options.includes(value)

  function openPicker() {
    setOtherMode(isCustom)
    setDraft(isCustom ? value : '')
    setOpen(true)
  }

  function selectOption(opt: string) {
    onChange(value === opt ? '' : opt)
    setOpen(false)
  }

  function confirmOther() {
    onChange(draft.trim())
    setOpen(false)
  }

  return (
    <>
      <TouchableOpacity style={styles.dropdownField} onPress={openPicker} activeOpacity={0.7}>
        <View style={styles.dropdownFieldValue}>
          <Text style={[styles.dropdownFieldText, !value && styles.dropdownFieldPlaceholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <Text style={styles.dropdownChevron}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} onPress={() => setOpen(false)} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {otherMode ? (
            <View style={styles.otherBox}>
              <TextInput
                style={styles.otherInput}
                value={draft}
                onChangeText={setDraft}
                placeholder={`Escribí tu propio ${title.toLowerCase()}`}
                placeholderTextColor={colors.grisMedio}
                autoFocus
                maxLength={CUSTOM_OPTION_MAX_LENGTH}
              />
              <Text style={styles.charCounter}>{draft.length}/{CUSTOM_OPTION_MAX_LENGTH}</Text>
              <View style={styles.otherActions}>
                <TouchableOpacity onPress={() => setOtherMode(false)}>
                  <Text style={styles.otherBack}>‹ Volver a la lista</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.otherConfirm} onPress={confirmOther}>
                  <Text style={styles.otherConfirmText}>Listo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.dropdownList}>
              {options.map((opt) => (
                <TouchableOpacity key={opt} style={styles.dropdownRow} onPress={() => selectOption(opt)}>
                  <Text style={styles.dropdownRowText}>{opt}</Text>
                  {value === opt && <Text style={styles.dropdownRowCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.dropdownRow} onPress={() => setOtherMode(true)}>
                <Text style={[styles.dropdownRowText, styles.dropdownRowOther]}>+ Otro</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
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

  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  imagesHint: { fontSize: 11, color: colors.grisClaro, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  imageThumbWrap: {
    width: 104, height: 116, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisBorde,
  },
  imageThumb: { width: '100%', height: '100%' },
  imageAddTile: {
    width: 104, height: 116, borderRadius: radius.card, backgroundColor: colors.grisBorde,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imagePlaceholderIcon: { fontSize: 32, color: colors.grisClaro, fontWeight: '300' },
  imagePlaceholderText: { fontSize: 12, color: colors.grisClaro },
  imageCoverBadge: {
    position: 'absolute', bottom: 6, left: 6, backgroundColor: colors.rosaOpa,
    borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2,
  },
  imageCoverBadgeText: { fontSize: 9, fontWeight: '700', color: colors.blanco },
  imageRemoveBtn: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  imageRemoveText: { fontSize: 11, color: colors.blanco, fontWeight: '700' },

  card: {
    backgroundColor: colors.grisBorde,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  field: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.grisMedio },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.grisOscuro, marginBottom: 4 },
  input: { fontSize: 15, color: colors.negro, padding: 0 },
  charCounter: { fontSize: 11, color: colors.grisMedio, textAlign: 'right', marginTop: 4 },
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

  // DropdownField (Estilo) — el "campo" en el form que abre la hoja
  dropdownField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.grisBorde, borderRadius: radius.chip,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  dropdownFieldValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dropdownFieldText: { fontSize: 15, color: colors.negro },
  dropdownFieldPlaceholder: { color: colors.grisClaro },
  dropdownChevron: { fontSize: 16, color: colors.grisClaro },

  // Hoja (Modal) — mismo patrón que SizeGuideSheet en app/product/[id].tsx
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%',
    backgroundColor: colors.blanco, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.grisMedio, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.negro, fontFamily: fonts.mergeOne },
  sheetClose: { fontSize: 16, color: colors.grisClaro, padding: 4 },

  dropdownList: { maxHeight: 400 },
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grisBorde,
  },
  dropdownRowText: { flex: 1, fontSize: 15, color: colors.negro },
  dropdownRowCheck: { fontSize: 15, color: colors.rosaOpa, fontWeight: '700' },
  dropdownRowOther: { color: colors.rosaOpa, fontWeight: '600' },

  otherBox: { paddingTop: spacing.sm },
  otherInput: {
    fontSize: 15, color: colors.negro, backgroundColor: colors.grisBorde,
    borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  otherActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  otherBack: { fontSize: 13, color: colors.grisOscuro },
  otherConfirm: { backgroundColor: colors.rosaOpa, borderRadius: radius.chip, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  otherConfirmText: { fontSize: 13, fontWeight: '700', color: colors.blanco },
})
