import React, { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import ColorPicker from 'react-native-wheel-color-picker'
import { colors } from '../../constants/colors'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { BRAND_COLOR_NAME_MAX_LENGTH } from '../../hooks/useBrandColors'

const HEX_RE = /^#[0-9A-F]{6}$/

function normalizeHex(value: string): string {
  const clean = value.trim().toUpperCase()
  return clean.startsWith('#') ? clean : `#${clean}`
}

// Editor de un color propio de marca: rueda de color interactiva
// (react-native-wheel-color-picker — solo usa Animated/PanResponder de RN core,
// sin reanimated, ver CLAUDE.md) + campo hex para pegar un código exacto +
// nombre. Lo usan la hoja de color de Crear prenda ("+ Otro") y la pantalla
// Gestionar (app/brand/colors.tsx), para crear y para editar.
export function ColorEditor({
  initialName = '',
  initialHex = '#EB006B',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string
  initialHex?: string
  submitLabel: string
  onSubmit: (name: string, hex: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [hex, setHex] = useState(initialHex.toUpperCase())
  const [hexDraft, setHexDraft] = useState(initialHex.toUpperCase())
  // Color que se le pasa a la rueda: solo cambia cuando se tipea un hex válido,
  // no en cada movimiento de la propia rueda (si no, la rueda se "pelea" con su
  // propio estado interno mientras se arrastra).
  const [wheelColor, setWheelColor] = useState(initialHex.toUpperCase())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleWheelChange(value: string) {
    const next = normalizeHex(value)
    setHex(next)
    setHexDraft(next)
  }

  function handleHexInput(text: string) {
    const draft = text.toUpperCase().replace(/[^#0-9A-F]/g, '').slice(0, 7)
    setHexDraft(draft)
    const next = normalizeHex(draft)
    if (HEX_RE.test(next)) {
      setHex(next)
      setWheelColor(next)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Ponele un nombre al color.'); return }
    if (!HEX_RE.test(hex)) { setError('El código de color no es válido (ej. #EB006B).'); return }
    setError(null)
    setSaving(true)
    try {
      await onSubmit(name.trim(), hex)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el color.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <View style={styles.wheelWrap}>
        <ColorPicker
          color={wheelColor}
          onColorChange={handleWheelChange}
          onColorChangeComplete={handleWheelChange}
          thumbSize={26}
          sliderSize={26}
          gapSize={16}
          noSnap
          swatches={false}
          row={false}
        />
      </View>

      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: HEX_RE.test(hex) ? hex : colors.grisBorde }]} />
        <TextInput
          style={styles.hexInput}
          value={hexDraft}
          onChangeText={handleHexInput}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#EB006B"
          placeholderTextColor={colors.grisMedio}
        />
      </View>

      <Text style={styles.label}>Nombre del color</Text>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Ej. Verde oliva"
        placeholderTextColor={colors.grisMedio}
        maxLength={BRAND_COLOR_NAME_MAX_LENGTH}
      />
      <Text style={styles.counter}>{name.length}/{BRAND_COLOR_NAME_MAX_LENGTH}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <TouchableOpacity onPress={onCancel} disabled={saving}>
          <Text style={styles.cancel}>‹ Volver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.blanco} size="small" />
            : <Text style={styles.submitText}>{submitLabel}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // La rueda necesita un alto fijo: se dimensiona según el espacio disponible.
  wheelWrap: { height: 260, marginBottom: spacing.md },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  preview: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.grisMedio },
  hexInput: {
    flex: 1, fontSize: 15, color: colors.negro, backgroundColor: colors.grisBorde,
    borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: 'monospace',
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.grisOscuro, marginBottom: 4 },
  nameInput: {
    fontSize: 15, color: colors.negro, backgroundColor: colors.grisBorde,
    borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  counter: { fontSize: 11, color: colors.grisMedio, textAlign: 'right', marginTop: 4 },
  error: { color: colors.rosaOpa, fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  cancel: { fontSize: 13, color: colors.grisOscuro },
  submit: {
    backgroundColor: colors.rosaOpa, borderRadius: radius.chip,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 90, alignItems: 'center',
  },
  submitText: { fontSize: 13, fontWeight: '700', color: colors.blanco },
})
