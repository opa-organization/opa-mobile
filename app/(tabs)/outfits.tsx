import React, { useEffect, useRef, useState } from 'react'
import {
  View, FlatList, StyleSheet, useWindowDimensions, TouchableOpacity, Text,
  StatusBar, SafeAreaView, ActivityIndicator, ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, Redirect } from 'expo-router'
import { useOutfits } from '../../hooks/useOutfits'
import { useFollowedBrandIds } from '../../hooks/useFollowedBrandIds'
import { OutfitScrollItem } from '../../components/outfit/OutfitScrollItem'
import { colors } from '../../constants/colors'
import { useAuthStore } from '../../store/useAuthStore'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'

// Hoisteado a nivel de módulo para que sea una referencia estable entre renders
// (un objeto literal inline en la prop haría que RN piense que la config cambió
// en cada render).
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 }

export default function OutfitsScreen() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [tab, setTab] = useState<'marcas' | 'descubrir'>('descubrir')
  const insets = useSafeAreaInsets()
  // useWindowDimensions (no Dimensions.get a nivel de módulo) para que pageH se
  // recalcule solo ante cualquier cambio de tamaño de ventana (resize en desktop-web,
  // rotación, o la barra de direcciones del navegador mobile apareciendo/desapareciendo)
  // — con un valor congelado al cargar el módulo, un resize posterior desalinea el
  // viewport del FlatList del alto real del item y la barra de precio queda cortada.
  const { height: SH } = useWindowDimensions()
  // La tab bar (BottomNavBar) se dibuja ENCIMA del contenido (no reserva espacio),
  // así que cada página del scroll debe medir la ventana MENOS el alto de la tab bar,
  // si no la barra de precio (bottom:0) queda tapada por la nav. El cálculo replica
  // el alto real de BottomNavBar: paddingTop 8 + iconWrap 48 + paddingBottom + borde 1.
  const tabBarHeight = 8 + 48 + (insets.bottom || 8) + 1
  const pageH = SH - tabBarHeight
  const profile = useAuthStore((s) => s.profile)
  const { outfits, loading, loadingMore, hasMore, loadMore } = useOutfits()
  const { brandIds: followedBrandIds, loading: loadingBrands } = useFollowedBrandIds()
  const { outfitId } = useLocalSearchParams<{ outfitId?: string }>()
  const flatListRef = useRef<FlatList>(null)
  const didScrollRef = useRef(false)

  // "tus marcas": outfits que tienen al menos una prenda de una marca que el usuario sigue
  const marcasOutfits = outfits.filter((o) =>
    o.garments?.some((gi) => gi.garment && followedBrandIds.includes(gi.garment.brand_id))
  )
  const displayedOutfits = tab === 'marcas' ? marcasOutfits : outfits

  // Al cambiar de tab el listado cambia de largo — volver al principio evita
  // quedar con un índice activo que ya no corresponde a ningún item.
  useEffect(() => {
    setActiveIndex(0)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [tab])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
  })

  // Scroll to the requested outfit once data is ready
  useEffect(() => {
    if (!outfitId || loading || outfits.length === 0 || didScrollRef.current) return
    const index = outfits.findIndex((o) => o.id === outfitId)
    if (index < 0) return
    didScrollRef.current = true
    setActiveIndex(index)
    if (index === 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
    } else {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: false })
      }, 100)
    }
  }, [outfitId, loading, outfits])

  // Reset scroll flag when outfitId changes (new navigation)
  useEffect(() => {
    didScrollRef.current = false
  }, [outfitId])

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.blanco} size="large" />
      </View>
    )
  }

  // Las cuentas de marca no tienen acceso a la sección de feed (no pueden
  // like/save/follow — son cuentas de contenido/venta, no de consumo).
  if (profile?.is_brand) {
    return <Redirect href="/(tabs)/profile" />
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Floating header */}
      <SafeAreaView style={[styles.floatingHeader, { pointerEvents: 'box-none' } as any]}>
        <View style={styles.headerInner}>
          <TouchableOpacity>
            <Image
              source={{ uri: `${STORAGE}/camion_blanco.png` }}
              style={styles.truckIcon}
              contentFit="contain"
            />
          </TouchableOpacity>
          <View style={styles.tabs}>
            <TouchableOpacity onPress={() => setTab('marcas')} style={styles.tabItem}>
              <Text style={[styles.tabText, tab === 'marcas' && styles.tabActiveText]}>tus marcas</Text>
              <View style={[styles.tabUnderline, tab === 'marcas' && styles.tabUnderlineActive]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('descubrir')} style={styles.tabItem}>
              <Text style={[styles.tabText, tab === 'descubrir' && styles.tabActiveText]}>Descubrir</Text>
              <View style={[styles.tabUnderline, tab === 'descubrir' && styles.tabUnderlineActive]} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addBtn} hitSlop={10}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {tab === 'marcas' && loadingBrands ? (
        <View style={[styles.emptyState, { height: pageH }]}>
          <ActivityIndicator color={colors.blanco} size="large" />
        </View>
      ) : tab === 'marcas' && displayedOutfits.length === 0 ? (
        <View style={[styles.emptyState, { height: pageH }]}>
          <Text style={styles.emptyStateText}>
            {followedBrandIds.length === 0
              ? 'Todavía no seguís ninguna marca.\nExplorá marcas y seguilas para verlas acá.'
              : 'Todavía no hay outfits con prendas de las marcas que seguís.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayedOutfits}
          keyExtractor={(item) => item.id}
          // El viewport del FlatList debe medir EXACTAMENTE pageH (= alto del item),
          // no el alto completo del contenedor. Si el viewport es más alto que el item,
          // el snap (nativo por pagingEnabled, web por scroll-snap) engancha desalineado
          // y la barra de precio del item queda fuera de vista al pasar de outfit.
          style={{ height: pageH, flexGrow: 0 }}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={VIEWABILITY_CONFIG}
          getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
          onEndReached={() => { if (hasMore) loadMore() }}
          onEndReachedThreshold={1}
          ListFooterComponent={loadingMore ? (
            <View style={[styles.emptyState, { height: pageH, width: undefined }]}>
              <ActivityIndicator color={colors.blanco} size="small" />
            </View>
          ) : null}
          renderItem={({ item, index }) => (
            <OutfitScrollItem outfit={item} isActive={index === activeIndex} height={pageH} />
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.negro },
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  truckIcon: { width: 26, height: 26 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  tabItem: { alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '500' },
  tabActiveText: { color: colors.blanco, fontWeight: '700' },
  tabUnderline: { marginTop: 3, height: 2, width: '70%', borderRadius: 1, backgroundColor: 'transparent' },
  tabUnderlineActive: { backgroundColor: colors.rosaOpa },
  addBtn: { alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.blanco, fontSize: 28, fontWeight: '300', lineHeight: 30 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyStateText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
