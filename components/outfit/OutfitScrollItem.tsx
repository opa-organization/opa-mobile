import React, { useRef } from 'react'
import {
  View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, ImageBackground, Animated,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Outfit } from '../../types'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { radius } from '../../constants/radius'
import { useLike } from '../../hooks/useLike'
import { useSave } from '../../hooks/useSave'
import { useFollow } from '../../hooks/useFollow'
import { useAuthStore } from '../../store/useAuthStore'

import { useAppWidth } from '../../constants/layout'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'

const CHIP_W = 118
const CHIP_H = 46
// Ancla aproximada (fracción del ancho/alto del item) de cada prenda sobre la
// figura, según su `slot`. No hay coordenadas por prenda en la DB, así que se
// deriva del slot real (torso/piernas/calzado/extras) para dibujar la línea
// conectora desde el chip hasta esa parte del cuerpo.
const SLOT_ANCHOR: Record<string, { x: number; y: number }> = {
  extras:  { x: 0.56, y: 0.14 },
  torso:   { x: 0.46, y: 0.34 },
  piernas: { x: 0.45, y: 0.60 },
  calzado: { x: 0.43, y: 0.86 },
}
const SLOT_ORDER: Record<string, number> = { extras: 0, torso: 1, piernas: 2, calzado: 3 }

interface Props {
  outfit: Outfit
  isActive: boolean
  height?: number
}

export function OutfitScrollItem({ outfit, isActive, height }: Props) {
  const router = useRouter()
  // Fallback reactivo si el caller no pasa `height` explícito (ver useWindowDimensions
  // en outfits.tsx / user-outfits.tsx / saved-outfits.tsx para el motivo).
  const { height: windowH } = useWindowDimensions()
  const resolvedHeight = height ?? windowH
  const SW = useAppWidth()
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  // Las cuentas de marca no pueden like/save/follow — son cuentas de contenido/venta.
  const viewerIsBrand = !!profile?.is_brand
  const { liked, toggle: toggleLike } = useLike(outfit.id, outfit.likes_count)
  const { saved, toggle: toggleSave } = useSave(outfit.id, outfit.saves_count ?? 0)
  const creatorId = outfit.creator_id ?? ''
  const isOwnOutfit = session?.user.id === creatorId
  const { following, toggle: toggleFollow } = useFollow(creatorId)

  // Spring "pop" en el ícono al togglear like/save (spec de design-2026-06-06-visual-system.md:
  // damping 10, stiffness 200) — se dispara al tocar, no en un useEffect atado a
  // liked/saved, para no re-disparar en la carga inicial del estado.
  const likeScale = useRef(new Animated.Value(1)).current
  const saveScale = useRef(new Animated.Value(1)).current
  function pop(value: Animated.Value) {
    value.setValue(0.7)
    Animated.spring(value, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start()
  }
  function handleToggleLike() {
    pop(likeScale)
    toggleLike()
  }
  function handleToggleSave() {
    pop(saveScale)
    toggleSave()
  }

  const totalPrice = outfit.garments?.reduce((sum, item) => sum + (item.garment?.price ?? 0), 0) ?? 0
  const creator = outfit.creator
  const creatorHandle = creator?.username ? `@${creator.username}` : (creator?.display_name ?? 'OPA')

  // Prendas ordenadas de arriba hacia abajo según su slot, con la geometría de
  // cada conector pre-calculada: chip a la izquierda, punto sobre el cuerpo
  // (ancla por slot) y línea en codo entre ambos. Se evita el solape vertical
  // de chips cuando dos prendas caen a alturas parecidas.
  const sorted = (outfit.garments ?? [])
    .slice(0, 4)
    .map((og, idx) => ({ og, order: SLOT_ORDER[og.slot ?? ''] ?? 90 + idx }))
    .sort((a, b) => a.order - b.order)

  let lastBottom = 0
  const laidOut = sorted.map(({ og }, i) => {
    const anchor = SLOT_ANCHOR[og.slot ?? ''] ?? { x: 0.5, y: 0.22 + i * 0.2 }
    const ax = anchor.x * SW
    const ay = anchor.y * resolvedHeight
    let chipTop = Math.max(78, Math.min(ay - CHIP_H / 2, resolvedHeight - 210))
    if (chipTop < lastBottom + 8) chipTop = lastBottom + 8
    lastBottom = chipTop + CHIP_H
    const chipCY = chipTop + CHIP_H / 2
    const startX = 16 + CHIP_W
    const bendX = startX + Math.min(34, Math.max(16, Math.abs(ax - startX) * 0.4))
    const diagLen = Math.hypot(ax - bendX, ay - chipCY)
    const angle = (Math.atan2(ay - chipCY, ax - bendX) * 180) / Math.PI
    return { og, ax, ay, chipTop, chipCY, startX, bendX, diagLen, angle }
  })

  return (
    <View style={[styles.container, { width: SW, height: resolvedHeight }]}>
      <ImageBackground
        source={{ uri: outfit.cover_image_url ?? `https://picsum.photos/seed/${outfit.id}/400/711` }}
        style={styles.image}
        resizeMode="cover"
      >
        {/* Garment labels + connector lines (codo horizontal + diagonal → punto) */}
        {laidOut.map(({ og, ax, ay, chipTop, chipCY, startX, bendX, diagLen, angle }) => (
          <React.Fragment key={og.garment_id}>
            <View style={[styles.connLine, { left: startX, top: chipCY - 0.75, width: bendX - startX }]} />
            <View
              style={[
                styles.connLine,
                { left: bendX, top: chipCY - 0.75, width: diagLen, transform: [{ rotate: `${angle}deg` }] },
              ]}
            />
            <View style={[styles.connDot, { left: ax - 4, top: ay - 4 }]} />
            <TouchableOpacity
              style={[styles.garmentLabel, { left: 16, top: chipTop, width: CHIP_W }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/product/${og.garment_id}`)}
            >
              <Image
                source={{ uri: og.garment?.image_url ?? `https://picsum.photos/seed/${og.garment_id}/40/40` }}
                style={styles.garmentThumb}
                contentFit="cover"
              />
              <View style={styles.garmentInfo}>
                <Text style={styles.garmentName} numberOfLines={1}>{og.garment?.name}</Text>
                <Text style={styles.garmentPrice}>${og.garment?.price.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}

        {/* Action buttons — círculos blancos, icon only (sin contadores) */}
        <View style={[styles.actions, { top: resolvedHeight * 0.4 }]}>
          {!viewerIsBrand && (
            <>
              <TouchableOpacity
                onPress={handleToggleLike}
                style={styles.actionBtn}
                accessibilityLabel="Me gusta"
                accessibilityRole="button"
              >
                <Animated.Text style={[styles.actionIcon, liked && styles.actionIconLiked, { transform: [{ scale: likeScale }] }]}>{liked ? '♥' : '♡'}</Animated.Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleSave}
                style={styles.actionBtn}
                accessibilityLabel="Guardar"
                accessibilityRole="button"
              >
                <Animated.Text style={[styles.actionIcon, saved && styles.actionIconLiked, { transform: [{ scale: saveScale }] }]}>{saved ? '★' : '☆'}</Animated.Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            accessibilityLabel="Compartir"
            accessibilityRole="button"
          >
            <Image
              source={{ uri: `${STORAGE}/compartir.png` }}
              style={styles.shareIcon}
              contentFit="contain"
              tintColor={colors.blanco}
            />
          </TouchableOpacity>
        </View>

        {/* Creator info */}
        <View style={styles.brandInfo}>
          <View style={styles.brandRow}>
            <TouchableOpacity
              style={styles.brandTapArea}
              activeOpacity={0.85}
              disabled={!creatorId}
              onPress={() => router.push(`/user/${creatorId}`)}
            >
              {creator?.avatar_url ? (
                <Image source={{ uri: creator.avatar_url }} style={styles.creatorAvatar} contentFit="cover" />
              ) : (
                <View style={styles.brandAvatar}>
                  <Text style={styles.brandAvatarText}>{(creator?.username ?? 'O')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.brandName}>{creatorHandle}</Text>
                <Text style={styles.outfitTitle}>{outfit.title}</Text>
              </View>
            </TouchableOpacity>
            {!isOwnOutfit && creatorId && !viewerIsBrand && (
              <TouchableOpacity
                onPress={toggleFollow}
                style={[styles.followBtn, following && styles.followBtnActive]}
              >
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {following ? 'Siguiendo' : 'Seguir'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceRow}>
          <View style={styles.bagIconWrap}>
            <Image
              source={{ uri: `${STORAGE}/bag_rosa.png` }}
              style={styles.bagIcon}
              contentFit="contain"
            />
          </View>
          <View>
            <Text style={styles.totalLabel}>Precio total</Text>
            <Text style={styles.price}>${totalPrice.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaText}>Ver outfit</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  image: { flex: 1, justifyContent: 'flex-end' },
  garmentLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: radius.chip,
    padding: 6,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  garmentThumb: { width: 32, height: 32, borderRadius: 16, marginRight: 6 },
  garmentInfo: { flex: 1 },
  garmentName: { fontSize: 10, fontFamily: fonts.mergeOne, color: colors.negro },
  garmentPrice: { fontSize: 10, fontFamily: fonts.mergeOne, color: colors.rosaOpa },
  connLine: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: colors.blanco,
    opacity: 0.9,
    transformOrigin: '0% 50%',
  },
  connDot: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.blanco,
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  actions: {
    position: 'absolute', right: 16,
    alignItems: 'center', gap: 20,
  },
  actionBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 32, color: colors.blanco,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actionIconLiked: { color: colors.rosaOpa },
  shareIcon: {
    width: 28, height: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 3,
  },
  brandInfo: { position: 'absolute', bottom: 100, left: 16, right: 70 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.negro, alignItems: 'center', justifyContent: 'center',
  },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20 },
  brandAvatarText: { color: colors.blanco, fontWeight: '700', fontSize: 16 },
  brandName: { color: colors.blanco, fontWeight: '700', fontSize: 14 },
  outfitTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  followBtn: {
    borderWidth: 1.5,
    borderColor: colors.blanco,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  followBtnActive: {
    backgroundColor: colors.blanco,
  },
  followBtnText: { color: colors.blanco, fontSize: 12, fontWeight: '600' },
  followBtnTextActive: { color: colors.negro },
  bottomBar: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    backgroundColor: colors.blanco,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bagIconWrap: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: colors.rosaOpaLight,
    alignItems: 'center', justifyContent: 'center',
  },
  bagIcon: { width: 22, height: 22 },
  totalLabel: { fontSize: 11, color: colors.grisClaro, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 20, fontWeight: '800', color: colors.negro, fontFamily: fonts.mergeOne },
  ctaButton: {
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaText: { color: colors.blanco, fontWeight: '700', fontSize: 14, fontFamily: fonts.palanquinDark },
})
