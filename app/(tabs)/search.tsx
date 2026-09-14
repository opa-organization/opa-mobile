import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAppWidth } from '../../constants/layout'
import { GARMENT_COLORS } from '../../constants/garmentColors'
import { dedupeCaseInsensitive } from '../../lib/text'
import { Outfit, Garment, Brand, Profile } from '../../types'

const ASSETS_BASE = 'https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/assets/'

type SearchTab = 'outfits' | 'prendas' | 'marcas'

const TAB_LABELS: Record<SearchTab, string> = {
  outfits: 'Outfits',
  prendas: 'Prendas',
  marcas: 'Cuentas',
}

// Resultado combinado de la tab "Cuentas": marcas y usuarios (perfiles no-marca)
// que matchean el texto buscado, cada uno con su tipo para poder distinguirlos
// en el render y navegar a /marca/[id] o /user/[id] según corresponda.
type AccountResult =
  | ({ kind: 'marca' } & Brand)
  | ({ kind: 'usuario' } & Profile)

// Categorías reales de prenda (mismo enum que `prendas.category` / outfit_items.slot,
// ya usado en wardrobe.tsx) — a diferencia de los tags de estilo/ocasión de abajo,
// estos son un vocabulario controlado: siempre van a devolver resultados si existen.
// 'todo' no es una categoría real de la DB: es un chip explícito para ver las 4
// categorías mezcladas (sin filtro de category), va primero en la fila a propósito.
const CATEGORY_TAGS = [
  { key: 'todo', label: 'Todo' },
  { key: 'torso', label: 'Torso' },
  { key: 'piernas', label: 'Piernas' },
  { key: 'calzado', label: 'Calzado' },
  { key: 'extras', label: 'Extras' },
]

type OutfitSort = 'popular' | 'recientes'
type PrendaSort = 'recientes' | 'precio_asc' | 'precio_desc'

const OUTFIT_SORTS: { key: OutfitSort; label: string }[] = [
  { key: 'popular', label: 'Populares' },
  { key: 'recientes', label: 'Recientes' },
]
const PRENDA_SORTS: { key: PrendaSort; label: string }[] = [
  { key: 'recientes', label: 'Recientes' },
  { key: 'precio_asc', label: 'Precio ↑' },
  { key: 'precio_desc', label: 'Precio ↓' },
]

export default function SearchScreen() {
  const router = useRouter()
  const screenWidth = useAppWidth()
  const cardSize = (screenWidth - spacing.lg * 2 - spacing.sm) / 2
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<SearchTab>('outfits')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [outfitSort, setOutfitSort] = useState<OutfitSort>('popular')
  const [prendaSort, setPrendaSort] = useState<PrendaSort>('recientes')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [colorFilters, setColorFilters] = useState<string[]>([])
  const [styleFilters, setStyleFilters] = useState<string[]>([])
  // Color/Estilo van colapsados por default dentro del panel de filtros — a pedido
  // del usuario, no quiere ver los 16 colores + todos los estilos apenas abre
  // "Filtros". Se expanden recién al tocar su propio header.
  const [colorSectionOpen, setColorSectionOpen] = useState(false)
  const [styleSectionOpen, setStyleSectionOpen] = useState(false)
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [garments, setGarments] = useState<(Garment & { brand?: Brand })[]>([])
  const [accounts, setAccounts] = useState<AccountResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Tags de estilo/ocasión de Outfits: en vez de una lista fija adivinada, se traen
  // los valores reales que existen hoy en `outfits.style`/`outfits.occasion` — así
  // nunca hay un chip que devuelva 0 resultados. Con el volumen actual (decenas de
  // outfits) esto es barato; si la tabla crece mucho conviene pasarlo a una query
  // DISTINCT server-side.
  const [outfitTags, setOutfitTags] = useState<string[]>([])
  useEffect(() => {
    async function loadOutfitTags() {
      const [{ data: styles }, { data: occasions }] = await Promise.all([
        supabase.from('outfits').select('style').not('style', 'is', null),
        supabase.from('outfits').select('occasion').not('occasion', 'is', null),
      ])
      const values = [
        ...(styles ?? []).map((r) => r.style as string),
        ...(occasions ?? []).map((r) => r.occasion as string),
      ]
      setOutfitTags(Array.from(new Set(values.filter(Boolean))))
    }
    loadOutfitTags()
  }, [])

  // Color: paleta estandarizada fija (GARMENT_COLORS, mismo set que el CHECK
  // constraint de la DB y los chips de create-garment.tsx) — a diferencia de
  // outfitTags, acá SÍ se muestran las 17 opciones siempre, tenga o no alguna
  // prenda ya cargada con ese color (a pedido explícito del usuario: "aunque no
  // haya ninguna prenda con este color, que aparezcan como opción").
  // Estilo sigue siendo texto libre en la DB, así que sigue trayendo valores reales.
  const [garmentStyles, setGarmentStyles] = useState<string[]>([])
  useEffect(() => {
    async function loadGarmentStyleOptions() {
      const { data: stylesData } = await supabase
        .from('prendas')
        .select('style')
        .eq('descontinuada', false)
        .not('style', 'is', null)
      setGarmentStyles(dedupeCaseInsensitive((stylesData ?? []).map((r) => r.style as string)))
    }
    loadGarmentStyleOptions()
  }, [])

  function toggleColorFilter(value: string) {
    setColorFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }
  function toggleStyleFilter(value: string) {
    setStyleFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }
  function clearGarmentFilters() {
    setMinPrice('')
    setMaxPrice('')
    setPrendaSort('recientes')
    setColorFilters([])
    setStyleFilters([])
  }

  const runSearch = useCallback(async (
    text: string,
    tag: string | null,
    searchTab: SearchTab,
    min: string,
    max: string,
    oSort: OutfitSort,
    pSort: PrendaSort,
    colors: string[],
    stylesArr: string[],
  ) => {
    if (!text.trim() && !tag && !min.trim() && !max.trim() && colors.length === 0 && stylesArr.length === 0) {
      setOutfits([])
      setGarments([])
      setAccounts([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      if (searchTab === 'outfits') {
        let q = supabase
          .from('outfits')
          .select('*, creator:perfiles(id, username, avatar_url)')
          .order(oSort === 'popular' ? 'likes_count' : 'created_at', { ascending: false })
          .limit(30)
        // Full-text search sobre title + description (search_vector, columna generada)
        if (text.trim()) q = q.textSearch('search_vector', text.trim(), { type: 'websearch', config: 'spanish' })
        if (tag) {
          q = q.or(`style.ilike.%${tag}%,occasion.ilike.%${tag}%`)
        }
        const { data } = await q
        setOutfits((data ?? []) as Outfit[])
      } else if (searchTab === 'prendas') {
        let q = supabase
          .from('prendas')
          .select('*, brand:marcas(id, name, logo_url)')
          .eq('descontinuada', false)
          .limit(100)
        if (pSort === 'precio_asc') q = q.order('price', { ascending: true })
        else if (pSort === 'precio_desc') q = q.order('price', { ascending: false })
        else q = q.order('created_at', { ascending: false })
        // Full-text search sobre name + description + nombre de marca (search_vector,
        // mantenida por trigger porque el nombre de marca es de otra tabla)
        if (text.trim()) q = q.textSearch('search_vector', text.trim(), { type: 'websearch', config: 'spanish' })
        if (tag && tag !== 'todo') q = q.eq('category', tag)
        const minVal = parseFloat(min)
        const maxVal = parseFloat(max)
        if (!isNaN(minVal)) q = q.gte('price', minVal)
        if (!isNaN(maxVal)) q = q.lte('price', maxVal)
        const { data } = await q
        // Color/estilo se filtran en el cliente, no con .ilike()/.or() server-side: son
        // texto libre con casing inconsistente (ver dedupeCaseInsensitive arriba) y la
        // tabla es chica (decenas de filas), así que comparar en JS es más simple y
        // evita tener que armar/escapar un string OR de PostgREST a mano.
        let results = (data ?? []) as (Garment & { brand?: Brand })[]
        if (colors.length > 0) {
          const colorSet = new Set(colors.map((c) => c.toLowerCase()))
          results = results.filter((g) => g.color && colorSet.has(g.color.toLowerCase()))
        }
        if (stylesArr.length > 0) {
          const styleSet = new Set(stylesArr.map((s) => s.toLowerCase()))
          results = results.filter((g) => g.style && styleSet.has(g.style.toLowerCase()))
        }
        setGarments(results)
      } else {
        // Tablas chicas (7 marcas, decenas de perfiles hoy) — ilike alcanza, no
        // amerita full-text/migración. Se excluyen perfiles is_brand=true de
        // "usuarios" porque esa misma cuenta ya aparece como marca en `marcas`.
        let brandsQ = supabase.from('marcas').select('*').order('name', { ascending: true }).limit(30)
        let profilesQ = supabase
          .from('perfiles')
          .select('*')
          .eq('is_brand', false)
          .order('username', { ascending: true })
          .limit(30)
        if (text.trim()) {
          brandsQ = brandsQ.or(`name.ilike.%${text.trim()}%,description.ilike.%${text.trim()}%`)
          profilesQ = profilesQ.or(`username.ilike.%${text.trim()}%,display_name.ilike.%${text.trim()}%`)
        }
        const [{ data: brandsData }, { data: profilesData }] = await Promise.all([brandsQ, profilesQ])
        setAccounts([
          ...((brandsData ?? []) as Brand[]).map((b) => ({ kind: 'marca' as const, ...b })),
          ...((profilesData ?? []) as Profile[]).map((p) => ({ kind: 'usuario' as const, ...p })),
        ])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      runSearch(query, activeTag, tab, minPrice, maxPrice, outfitSort, prendaSort, colorFilters, styleFilters)
    }, 350)
    return () => clearTimeout(timeout)
  }, [query, activeTag, tab, minPrice, maxPrice, outfitSort, prendaSort, colorFilters, styleFilters, runSearch])

  const allTags = tab === 'prendas' ? CATEGORY_TAGS.map((c) => c.key) : outfitTags

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Image
            source={{ uri: ASSETS_BASE + 'nav/search.png' }}
            style={styles.searchIcon}
            tintColor={colors.grisClaro}
            contentFit="contain"
          />
          <TextInput
            style={styles.input}
            placeholder="Outfits, prendas, marcas, usuarios..."
            placeholderTextColor={colors.grisClaro}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['outfits', 'prendas', 'marcas'] as SearchTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => {
              setTab(t)
              setActiveTag(null)
              if (t !== 'prendas') {
                setFiltersOpen(false)
                setColorFilters([])
                setStyleFilters([])
                setColorSectionOpen(false)
                setStyleSectionOpen(false)
              }
            }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tag filters — categorías reales para Prendas, style/occasion reales para Outfits.
          En Prendas comparte fila con el ícono plegable de filtros avanzados. */}
      {tab !== 'marcas' && (
        <View style={styles.tagRow}>
          <FlatList
            horizontal
            style={styles.tagListFlatList}
            data={allTags}
            keyExtractor={(t) => t}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
            renderItem={({ item: tag }) => (
              <TouchableOpacity
                style={[styles.tag, activeTag === tag && styles.tagActive]}
                onPress={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                <Text style={[styles.tagText2, activeTag === tag && styles.tagTextActive]}>
                  {tab === 'prendas' ? CATEGORY_TAGS.find((c) => c.key === tag)?.label ?? tag : `#${tag}`}
                </Text>
              </TouchableOpacity>
            )}
          />
          {tab === 'prendas' && (
            <TouchableOpacity
              style={styles.filterIconBtn}
              onPress={() => setFiltersOpen((o) => !o)}
              accessibilityLabel="Filtros avanzados"
            >
              <Image
                source={{ uri: ASSETS_BASE + (filtersOpen ? 'filtro_rosa.png' : 'filtro_negro.png') }}
                style={styles.filterIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Panel plegable de filtros avanzados — precio, orden, color y estilo, todo
          en un solo lugar detrás del ícono (decisión del usuario: consolidar acá en
          vez de dejar precio/orden siempre visibles como antes). */}
      {tab === 'prendas' && filtersOpen && (
        <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            <Text style={styles.filterPanelTitle}>Filtros</Text>
            <TouchableOpacity onPress={clearGarmentFilters}>
              <Text style={styles.filterPanelClear}>Limpiar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterSectionLabel}>Precio</Text>
          <View style={styles.priceInputs}>
            <TextInput
              style={styles.priceInput}
              placeholder="Precio min"
              placeholderTextColor={colors.grisClaro}
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
            />
            <Text style={styles.priceDash}>—</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Precio max"
              placeholderTextColor={colors.grisClaro}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.filterSectionLabel}>Ordenar por</Text>
          <View style={styles.sortPills}>
            {PRENDA_SORTS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortPill, prendaSort === s.key && styles.sortPillActive]}
                onPress={() => setPrendaSort(s.key)}
              >
                <Text style={[styles.sortPillText, prendaSort === s.key && styles.sortPillTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setColorSectionOpen((o) => !o)}
          >
            <Text style={[styles.filterSectionLabel, styles.collapsibleLabel]}>
              Color{colorFilters.length > 0 ? ` (${colorFilters.length})` : ''}
            </Text>
            <Text style={styles.collapsibleChevron}>{colorSectionOpen ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
          {colorSectionOpen && (
            <View style={styles.chipsWrap}>
              {GARMENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.filterChip, styles.colorChip, colorFilters.includes(c.value) && styles.filterChipActive]}
                  onPress={() => toggleColorFilter(c.value)}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                  <Text style={[styles.filterChipText, colorFilters.includes(c.value) && styles.filterChipTextActive]}>{c.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {garmentStyles.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setStyleSectionOpen((o) => !o)}
              >
                <Text style={[styles.filterSectionLabel, styles.collapsibleLabel]}>
                  Estilo{styleFilters.length > 0 ? ` (${styleFilters.length})` : ''}
                </Text>
                <Text style={styles.collapsibleChevron}>{styleSectionOpen ? '⌃' : '⌄'}</Text>
              </TouchableOpacity>
              {styleSectionOpen && (
                <View style={styles.chipsWrap}>
                  {garmentStyles.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.filterChip, styleFilters.includes(s) && styles.filterChipActive]}
                      onPress={() => toggleStyleFilter(s)}
                    >
                      <Text style={[styles.filterChipText, styleFilters.includes(s) && styles.filterChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {tab === 'outfits' && (
        <View style={styles.filterRow}>
          <View style={styles.sortPills}>
            {OUTFIT_SORTS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortPill, outfitSort === s.key && styles.sortPillActive]}
                onPress={() => setOutfitSort(s.key)}
              >
                <Text style={[styles.sortPillText, outfitSort === s.key && styles.sortPillTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results */}
      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 40 }} />
      ) : !searched ? (
        <View style={styles.emptyState}>
          <Image
            source={{ uri: ASSETS_BASE + 'camiseta.png' }}
            style={styles.emptyIcon}
            tintColor={colors.grisMedio}
            contentFit="contain"
          />
          <Text style={styles.emptyText}>Descubrí looks por estilo, ocasión o marca</Text>
        </View>
      ) : tab === 'outfits' ? (
        outfits.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={{ uri: ASSETS_BASE + 'nothing_found.png' }}
              style={styles.notFoundIcon}
              contentFit="contain"
            />
            <Text style={styles.emptyText}>Sin resultados para "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={outfits}
            keyExtractor={(o) => o.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.outfitCard, { width: cardSize }]} onPress={() => router.push(`/outfit/${item.id}`)}>
                <Image
                  source={{ uri: item.cover_image_url ?? undefined }}
                  style={[styles.outfitImage, { width: cardSize, height: cardSize * 1.3 }]}
                  contentFit="cover"
                />
                <View style={styles.outfitMeta}>
                  <Text style={styles.outfitTitle} numberOfLines={1}>{item.title ?? 'Outfit'}</Text>
                  {(item as any).creator && (
                    <TouchableOpacity onPress={() => router.push(`/user/${(item as any).creator.id}`)} hitSlop={4}>
                      <Text style={styles.outfitCreator}>@{(item as any).creator.username}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : tab === 'prendas' ? (
        garments.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={{ uri: ASSETS_BASE + 'nothing_found.png' }}
              style={styles.notFoundIcon}
              contentFit="contain"
            />
            <Text style={styles.emptyText}>Sin resultados para "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={garments}
            keyExtractor={(g) => g.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.outfitCard, { width: cardSize }]} onPress={() => router.push(`/product/${item.id}`)}>
                <Image
                  source={{ uri: item.image_url ?? undefined }}
                  style={[styles.outfitImage, { width: cardSize, height: cardSize * 1.3 }]}
                  contentFit="cover"
                />
                <View style={styles.outfitMeta}>
                  <Text style={styles.outfitTitle} numberOfLines={1}>{item.name}</Text>
                  {item.brand && <Text style={styles.outfitCreator}>{item.brand.name}</Text>}
                  <Text style={styles.garmentPrice}>${item.price.toLocaleString('es-AR')}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={{ uri: ASSETS_BASE + 'nothing_found.png' }}
              style={styles.notFoundIcon}
              contentFit="contain"
            />
            <Text style={styles.emptyText}>Sin resultados para "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={accounts}
            keyExtractor={(a) => `${a.kind}-${a.id}`}
            contentContainerStyle={styles.brandList}
            renderItem={({ item }) => {
              const isBrand = item.kind === 'marca'
              const avatarUrl = isBrand ? item.logo_url : item.avatar_url
              const name = isBrand ? item.name : (item.display_name || item.username)
              const description = isBrand ? item.description : item.bio
              return (
                <TouchableOpacity
                  style={styles.brandRow}
                  onPress={() => router.push(isBrand ? `/marca/${item.id}` : `/user/${item.id}`)}
                >
                  <Image
                    source={{ uri: avatarUrl ?? undefined }}
                    style={styles.brandLogo}
                    contentFit="cover"
                  />
                  <View style={styles.brandInfo}>
                    <View style={styles.brandNameRow}>
                      <Text style={styles.brandName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.accountKindTag}>{isBrand ? 'Marca' : 'Usuario'}</Text>
                      {isBrand && item.verified && (
                        <Image source={{ uri: ASSETS_BASE + 'verificado_ondas.png' }} style={styles.brandVerified} contentFit="contain" />
                      )}
                    </View>
                    {description && (
                      <Text style={styles.brandDescription} numberOfLines={1}>{description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            }}
          />
        )
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },

  searchBarWrapper: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grisBorde,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  searchIcon: { width: 16, height: 16 },
  input: { flex: 1, fontSize: 15, color: colors.negro },
  clearBtn: { fontSize: 14, color: colors.grisClaro, padding: 4 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.grisBorde, marginHorizontal: spacing.lg },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.rosaOpa },
  tabText: { fontSize: 14, color: colors.grisClaro, fontWeight: '500' },
  tabTextActive: { color: colors.rosaOpa, fontWeight: '700' },

  // flexGrow: 0 evita que el FlatList horizontal se estire para llenar el alto
  // disponible del SafeAreaView (flex:1) en react-native-web — mismo fix que ya
  // usa app/(tabs)/outfits.tsx para su FlatList principal. Acá además hace falta
  // height + flexShrink: 0: esta fila es hermana del FlatList de resultados (que
  // sí necesita crecer y scrollear su propio contenido) dentro de un contenedor
  // flex:1 — sin flexShrink:0, apenas los resultados no entran en la pantalla el
  // layout "roba" espacio de esta fila (se encoge a ~16px, el mínimo de una sola
  // línea de texto) para dárselo al FlatList de abajo. Con fondo blanco casi no
  // se nota, pero con el chip activo (fondo negro) el recorte tapa el texto.
  // El fix ahora vive en `tagRow` (el hermano directo del FlatList de resultados);
  // el FlatList de chips adentro solo necesita flex:1 para ocupar el resto de la fila.
  tagRow: { flexDirection: 'row', alignItems: 'center', flexGrow: 0, flexShrink: 0, height: 44 },
  tagListFlatList: { flex: 1 },
  tagList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.tag,
    borderWidth: 1,
    borderColor: colors.bordeTag,
    backgroundColor: colors.blanco,
  },
  tagActive: { backgroundColor: colors.negro, borderColor: colors.negro },
  tagText2: { fontSize: 12, color: colors.grisOscuro },
  tagTextActive: { color: colors.blanco },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  priceInputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priceInput: {
    width: 80,
    fontSize: 12,
    color: colors.negro,
    backgroundColor: colors.grisBorde,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  priceDash: { fontSize: 12, color: colors.grisClaro },
  sortPills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sortPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.grisMedio,
  },
  sortPillActive: { backgroundColor: colors.rosaOpa, borderColor: colors.rosaOpa },
  sortPillText: { fontSize: 11, fontWeight: '600', color: colors.grisOscuro },
  sortPillTextActive: { color: colors.blanco },

  filterIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  filterIcon: { width: 20, height: 20 },

  // flexShrink: 0 por el mismo motivo que tagRow más arriba — este panel es hermano
  // del FlatList de resultados dentro del contenedor flex:1, así que sin esto se
  // podría encoger si los resultados no entran en pantalla.
  filterPanel: {
    flexShrink: 0,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.grisBorde,
  },
  filterPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterPanelTitle: { fontSize: 13, fontWeight: '700', color: colors.negro },
  filterPanelClear: { fontSize: 12, color: colors.rosaOpa, fontWeight: '600' },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.grisOscuro,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: 2,
  },
  collapsibleChevron: { fontSize: 13, color: colors.grisClaro },
  collapsibleLabel: { marginTop: 0, marginBottom: 0 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.bordeTag,
    backgroundColor: colors.blanco,
  },
  filterChipActive: { backgroundColor: colors.rosaOpa, borderColor: colors.rosaOpa },
  filterChipText: { fontSize: 12, color: colors.grisOscuro, textTransform: 'capitalize' },
  filterChipTextActive: { color: colors.blanco, fontWeight: '600' },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorSwatch: { width: 12, height: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.bordeTag },

  brandList: { padding: spacing.lg, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandLogo: { width: 52, height: 52, borderRadius: radius.avatar, backgroundColor: colors.grisBorde },
  brandInfo: { flex: 1 },
  brandNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.negro, flexShrink: 1 },
  accountKindTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.grisClaro,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: colors.bordeTag,
    borderRadius: radius.tag,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  brandVerified: { width: 16, height: 16 },
  brandDescription: { fontSize: 12, color: colors.grisClaro, marginTop: 2 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: { width: 48, height: 48 },
  notFoundIcon: { width: 96, height: 96 },
  emptyText: { fontSize: 14, color: colors.grisClaro, textAlign: 'center', maxWidth: 240 },

  grid: { padding: spacing.lg, gap: spacing.sm },
  row: { gap: spacing.sm },
  outfitCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.grisBorde },
  outfitImage: {},
  outfitMeta: { padding: spacing.sm },
  outfitTitle: { fontSize: 13, fontWeight: '600', color: colors.negro },
  outfitCreator: { fontSize: 11, color: colors.grisClaro, marginTop: 2 },
  garmentPrice: { fontSize: 12, fontWeight: '700', color: colors.rosaOpa, marginTop: 2 },
})
