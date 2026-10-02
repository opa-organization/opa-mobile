import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'
import { useAuthStore } from '../../store/useAuthStore'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useBrandColors } from '../../hooks/useBrandColors'
import { ColorEditor } from '../../components/garment/ColorEditor'
import type { BrandColor } from '../../types'

type View_ = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; color: BrandColor }

// "Gestionar" colores propios de la marca (destino del botón con engranaje en la
// hoja de Color de Crear prenda). Crear, renombrar/recolorear, reordenar y
// borrar. Los 16 colores estándar no se tocan acá (decisión del usuario).
// Borrar está bloqueado mientras alguna prenda use el color — la DB lo bloquea
// igual (FK ON DELETE RESTRICT), acá solo se avisa antes.
export default function BrandColorsScreen() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const { brand, loading: brandLoading } = useMyBrand(session?.user.id)
  const { brandColors, usage, loading, create, update, remove, move } = useBrandColors(brand?.id)

  const [view, setView] = useState<View_>({ mode: 'list' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(id: string, action: () => Promise<void>) {
    setError(null)
    setBusyId(id)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal. Probá de nuevo.')
    } finally {
      setBusyId(null)
    }
  }

  function handleDelete(c: BrandColor) {
    setConfirmDeleteId(null)
    run(c.id, () => remove(c.id))
  }

  const title = view.mode === 'create' ? 'Nuevo color' : view.mode === 'edit' ? 'Editar color' : 'Mis colores'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (view.mode === 'list' ? router.back() : setView({ mode: 'list' }))}
          style={styles.backBtn}
        >
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {brandLoading || (loading && brandColors.length === 0) ? (
        <View style={styles.center}><ActivityIndicator color={colors.rosaOpa} size="large" /></View>
      ) : !brand ? (
        <View style={styles.center}><Text style={styles.emptyText}>Esta sección es solo para cuentas de marca.</Text></View>
      ) : view.mode !== 'list' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ColorEditor
            key={view.mode === 'edit' ? view.color.id : 'new'}
            initialName={view.mode === 'edit' ? view.color.name : ''}
            initialHex={view.mode === 'edit' ? view.color.hex : undefined}
            submitLabel={view.mode === 'edit' ? 'Guardar' : 'Crear color'}
            onSubmit={async (name, hex) => {
              if (view.mode === 'edit') await update(view.color.id, name, hex)
              else await create(name, hex)
              setView({ mode: 'list' })
            }}
            onCancel={() => setView({ mode: 'list' })}
          />
          {view.mode === 'edit' && (usage[view.color.id] ?? 0) > 0 && (
            <Text style={styles.editNote}>
              Lo usan {usage[view.color.id]} prenda{usage[view.color.id] === 1 ? '' : 's'}: el cambio se ve en todas.
            </Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Colores de {brand.name}. Aparecen en el selector de color al cargar una prenda, en este orden.
          </Text>

          <TouchableOpacity style={styles.newBtn} onPress={() => { setError(null); setView({ mode: 'create' }) }}>
            <Text style={styles.newBtnText}>+ Nuevo color</Text>
          </TouchableOpacity>

          {error && <Text style={styles.error}>{error}</Text>}

          {brandColors.length === 0 ? (
            <Text style={styles.emptyText}>Todavía no creaste ningún color propio.</Text>
          ) : (
            brandColors.map((c, i) => {
              const used = usage[c.id] ?? 0
              const busy = busyId === c.id
              return (
                <View key={c.id} style={styles.row}>
                  <View style={styles.orderCol}>
                    <TouchableOpacity
                      onPress={() => run(c.id, () => move(c.id, -1))}
                      disabled={i === 0 || busyId !== null}
                      hitSlop={6}
                    >
                      <Text style={[styles.arrow, (i === 0 || busyId !== null) && styles.arrowDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => run(c.id, () => move(c.id, 1))}
                      disabled={i === brandColors.length - 1 || busyId !== null}
                      hitSlop={6}
                    >
                      <Text style={[styles.arrow, (i === brandColors.length - 1 || busyId !== null) && styles.arrowDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.meta}>
                      {c.hex} · {used === 0 ? 'sin usar' : `en ${used} prenda${used === 1 ? '' : 's'}`}
                    </Text>
                  </View>

                  {busy ? (
                    <ActivityIndicator color={colors.rosaOpa} />
                  ) : confirmDeleteId === c.id ? (
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => handleDelete(c)}>
                        <Text style={styles.deleteConfirm}>Borrar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setConfirmDeleteId(null)}>
                        <Text style={styles.action}>No</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => { setError(null); setView({ mode: 'edit', color: c }) }}>
                        <Text style={styles.action}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (used > 0) {
                            setError(`"${c.name}" no se puede borrar: lo usa${used === 1 ? '' : 'n'} ${used} prenda${used === 1 ? '' : 's'}. Cambiale el color a esa${used === 1 ? '' : 's'} prenda${used === 1 ? '' : 's'} primero.`)
                            return
                          }
                          setError(null)
                          setConfirmDeleteId(c.id)
                        }}
                      >
                        <Text style={[styles.action, styles.deleteText, used > 0 && styles.actionDisabled]}>Borrar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontSize: 13, color: colors.grisOscuro, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.grisClaro, textAlign: 'center', marginTop: spacing.lg },
  error: { color: colors.rosaOpa, fontSize: 13, marginBottom: spacing.md },
  editNote: { fontSize: 12, color: colors.grisClaro, marginTop: spacing.md },

  newBtn: {
    borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.rosaOpa,
    paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg,
  },
  newBtnText: { fontSize: 14, fontWeight: '700', color: colors.rosaOpa },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grisBorde,
  },
  orderCol: { alignItems: 'center', gap: 6, width: 22 },
  arrow: { fontSize: 12, color: colors.negro },
  arrowDisabled: { color: colors.grisMedio },
  swatch: { width: 28, height: 28, borderRadius: 999, borderWidth: 1, borderColor: colors.grisMedio },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.negro },
  meta: { fontSize: 12, color: colors.grisClaro, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  action: { fontSize: 13, fontWeight: '600', color: colors.negro },
  actionDisabled: { color: colors.grisMedio },
  deleteText: { color: colors.rosaOpa },
  deleteConfirm: { fontSize: 13, fontWeight: '700', color: colors.blanco, backgroundColor: colors.rosaOpa, borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 4, overflow: 'hidden' },
})
