import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native'
import { Image } from 'expo-image'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { GARMENT_COLORS, GARMENT_COLOR_HEX } from '../../constants/garmentColors'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'
import { ColorEditor } from './ColorEditor'
import type { BrandColor } from '../../types'

export const MAX_GARMENT_COLORS = 2

// Un color elegido para la prenda: estándar (se guarda el nombre en
// prendas.color / color_secundario) o propio de la marca (se guarda el id en
// prendas.color_id / color_secundario_id).
export type ColorChoice = { kind: 'standard'; name: string } | { kind: 'custom'; id: string }

function sameChoice(a: ColorChoice, b: ColorChoice) {
  return a.kind === b.kind && (a.kind === 'standard' ? a.name === (b as typeof a).name : a.id === (b as typeof a).id)
}

export function resolveChoice(choice: ColorChoice, brandColors: BrandColor[]): { label: string; hex: string } | null {
  if (choice.kind === 'standard') return { label: choice.name, hex: GARMENT_COLOR_HEX[choice.name] ?? colors.grisMedio }
  const c = brandColors.find((bc) => bc.id === choice.id)
  return c ? { label: c.name, hex: c.hex } : null
}

const ROLE_LABELS = ['Principal', 'Secundario']

// Campo "Color" de Crear/Editar prenda. Abre una hoja donde se eligen hasta 2
// colores: el primero tocado es el principal, el segundo el secundario. Abajo de
// los estándar aparecen los colores propios de la marca ("Colores de {marca}"),
// "+ Otro" abre el editor con rueda para crear uno nuevo (queda guardado en la
// paleta de la marca y se selecciona solo), y "Gestionar" lleva a
// app/brand/colors.tsx.
export function GarmentColorField({
  value, onChange, brandName, brandColors, onCreateColor, onManage,
}: {
  value: ColorChoice[]
  onChange: (next: ColorChoice[]) => void
  brandName: string
  brandColors: BrandColor[]
  onCreateColor: (name: string, hex: string) => Promise<BrandColor>
  onManage: () => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [limitHint, setLimitHint] = useState(false)

  function openSheet() {
    setCreating(false)
    setLimitHint(false)
    setOpen(true)
  }

  function toggle(choice: ColorChoice) {
    if (value.some((v) => sameChoice(v, choice))) {
      // Sacar el principal deja al secundario como principal (orden del array).
      onChange(value.filter((v) => !sameChoice(v, choice)))
      setLimitHint(false)
      return
    }
    if (value.length >= MAX_GARMENT_COLORS) {
      setLimitHint(true)
      return
    }
    onChange([...value, choice])
  }

  async function handleCreate(name: string, hex: string) {
    const created = await onCreateColor(name, hex)
    if (value.length < MAX_GARMENT_COLORS) onChange([...value, { kind: 'custom', id: created.id }])
    setCreating(false)
  }

  function handleManage() {
    setOpen(false)
    onManage()
  }

  const resolved = value
    .map((v) => resolveChoice(v, brandColors))
    .filter((r): r is { label: string; hex: string } => r !== null)

  function renderRow(choice: ColorChoice, label: string, hex: string, key: string) {
    const index = value.findIndex((v) => sameChoice(v, choice))
    return (
      <TouchableOpacity key={key} style={styles.row} onPress={() => toggle(choice)}>
        <View style={[styles.swatch, { backgroundColor: hex }]} />
        <Text style={styles.rowText}>{label}</Text>
        {index >= 0 && (
          <View style={[styles.roleBadge, index === 1 && styles.roleBadgeSecondary]}>
            <Text style={[styles.roleBadgeText, index === 1 && styles.roleBadgeTextSecondary]}>{ROLE_LABELS[index]}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openSheet} activeOpacity={0.7}>
        <View style={styles.fieldValue}>
          {resolved.length === 0 ? (
            <Text style={[styles.fieldText, styles.placeholder]}>Elegí hasta 2 colores</Text>
          ) : (
            resolved.map((r, i) => (
              <View key={`${r.label}-${i}`} style={styles.fieldChip}>
                <View style={[styles.swatch, { backgroundColor: r.hex }]} />
                <Text style={styles.fieldText} numberOfLines={1}>{r.label}</Text>
                <Text style={styles.fieldRole}>{ROLE_LABELS[i].toLowerCase()}</Text>
              </View>
            ))
          )}
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setOpen(false)} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{creating ? 'Nuevo color' : 'Color'}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.sheetDone}>Listo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {creating ? (
              <ColorEditor submitLabel="Crear color" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
            ) : (
              <>
                <Text style={styles.hint}>
                  El primero que elijas es el principal y el segundo el secundario (máximo {MAX_GARMENT_COLORS}).
                </Text>
                {limitHint && (
                  <Text style={styles.limitHint}>Ya elegiste {MAX_GARMENT_COLORS} colores. Sacá uno para elegir otro.</Text>
                )}

                <Text style={styles.groupTitle}>COLORES ESTÁNDAR</Text>
                {GARMENT_COLORS.map((c) => renderRow({ kind: 'standard', name: c.value }, c.value, c.hex, `std-${c.value}`))}

                {brandColors.length > 0 && (
                  <>
                    <Text style={styles.groupTitle}>COLORES DE {brandName.toUpperCase()}</Text>
                    {brandColors.map((c) => renderRow({ kind: 'custom', id: c.id }, c.name, c.hex, `custom-${c.id}`))}
                  </>
                )}

                <TouchableOpacity style={styles.row} onPress={() => setCreating(true)}>
                  <Text style={[styles.rowText, styles.otherText]}>+ Otro</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.manageBtn} onPress={handleManage}>
                  <Image source={{ uri: `${STORAGE}/configuracion.png` }} style={styles.manageIcon} contentFit="contain" />
                  <Text style={styles.manageText}>Gestionar</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.grisBorde, borderRadius: radius.chip,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  fieldValue: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  fieldChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  fieldText: { fontSize: 15, color: colors.negro, flexShrink: 1 },
  fieldRole: { fontSize: 11, color: colors.grisClaro },
  placeholder: { color: colors.grisClaro },
  chevron: { fontSize: 16, color: colors.grisClaro },
  swatch: { width: 16, height: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.grisMedio },

  // Hoja (Modal) — mismo patrón que SizeGuideSheet en app/product/[id].tsx
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%',
    backgroundColor: colors.blanco, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.grisMedio, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.negro, fontFamily: fonts.mergeOne },
  sheetDone: { fontSize: 14, fontWeight: '700', color: colors.rosaOpa, padding: 4 },
  list: { flexGrow: 0 },

  hint: { fontSize: 12, color: colors.grisClaro, marginBottom: spacing.sm },
  limitHint: { fontSize: 12, color: colors.rosaOpa, fontWeight: '600', marginBottom: spacing.sm },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.grisOscuro, letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grisBorde,
  },
  rowText: { flex: 1, fontSize: 15, color: colors.negro },
  otherText: { color: colors.rosaOpa, fontWeight: '600' },
  roleBadge: { backgroundColor: colors.negro, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeSecondary: { backgroundColor: colors.blanco, borderWidth: 1, borderColor: colors.negro },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: colors.blanco },
  roleBadgeTextSecondary: { color: colors.negro },

  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.grisMedio,
  },
  manageIcon: { width: 18, height: 18 },
  manageText: { fontSize: 14, fontWeight: '600', color: colors.negro },
})
