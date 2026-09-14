import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../constants/colors'
import { fonts } from '../constants/fonts'
import { spacing } from '../constants/spacing'
import { radius } from '../constants/radius'
import { useCart, CartRow } from '../hooks/useCart'
import { STORAGE_BASE_URL as STORAGE } from '../constants/storage'

// Vista de carrito muy básica y temporal: permite ver/editar/sacar items de
// `productos_carrito`. No hay checkout todavía — eso es un pendiente aparte.
export default function CartScreen() {
  const router = useRouter()
  const { items, loading, total, updateQuantity, removeItem } = useCart()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carrito</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ flex: 1 }} />
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🛍️</Text>
          <Text style={styles.emptyText}>Tu carrito está vacío</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CartItemRow
              item={item}
              onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
              onDecrement={() => updateQuantity(item.id, item.quantity - 1)}
              onRemove={() => removeItem(item.id)}
              onPress={() => router.push(`/product/${item.garment_id}`)}
            />
          )}
        />
      )}

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toLocaleString('es-AR')}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} disabled activeOpacity={1}>
            <Text style={styles.checkoutBtnText}>Finalizar compra (próximamente)</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

function CartItemRow({
  item, onIncrement, onDecrement, onRemove, onPress,
}: {
  item: CartRow
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
  onPress: () => void
}) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Image source={{ uri: item.garment?.image_url ?? undefined }} style={styles.rowImage} contentFit="cover" />
      </TouchableOpacity>
      <View style={styles.rowBody}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.rowBrand}>{item.garment?.brand?.name}</Text>
          <Text style={styles.rowName} numberOfLines={1}>{item.garment?.name}</Text>
          {item.size && <Text style={styles.rowSize}>Talle {item.size}</Text>}
        </TouchableOpacity>
        <View style={styles.rowBottom}>
          <Text style={styles.rowPrice}>${(item.garment?.price ?? 0).toLocaleString('es-AR')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={onDecrement} style={styles.stepperBtn}>
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{item.quantity}</Text>
            <TouchableOpacity onPress={onIncrement} style={styles.stepperBtn}>
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.negro, fontFamily: fonts.mergeOne },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.grisClaro, fontSize: 15 },

  list: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grisBorde,
  },
  rowImage: { width: 76, height: 96, borderRadius: radius.chip, backgroundColor: colors.grisBorde },
  rowBody: { flex: 1, justifyContent: 'space-between' },
  rowBrand: { fontSize: 11, color: colors.grisClaro, fontWeight: '600', textTransform: 'uppercase' },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.negro, marginTop: 2 },
  rowSize: { fontSize: 12, color: colors.grisOscuro, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  rowPrice: { fontSize: 15, fontWeight: '700', color: colors.rosaOpa },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.grisMedio, borderRadius: radius.chip,
  },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 16, color: colors.negro, fontWeight: '600' },
  stepperValue: { minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.negro },
  removeBtn: { padding: 4, alignSelf: 'flex-start' },
  removeBtnText: { fontSize: 16, color: colors.grisClaro },

  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { fontSize: 14, color: colors.grisOscuro, fontWeight: '600' },
  totalValue: { fontSize: 18, color: colors.negro, fontWeight: '800' },
  checkoutBtn: {
    backgroundColor: colors.grisMedio,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutBtnText: { color: colors.grisOscuro, fontSize: 14, fontWeight: '700' },
})
