import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, StatusBar, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { colors } from '../constants/colors'
import { fonts } from '../constants/fonts'
import { spacing } from '../constants/spacing'
import { radius } from '../constants/radius'
import { STORAGE_BASE_URL as STORAGE } from '../constants/storage'
import { useUserMeasurements } from '../hooks/useUserMeasurements'

const FIELDS: { key: 'height' | 'chest' | 'waist' | 'hip' | 'thigh' | 'foot_length'; label: string }[] = [
  { key: 'height', label: 'Altura (cm)' },
  { key: 'chest', label: 'Pecho (cm)' },
  { key: 'waist', label: 'Cintura (cm)' },
  { key: 'hip', label: 'Cadera (cm)' },
  { key: 'thigh', label: 'Muslo (cm)' },
  { key: 'foot_length', label: 'Largo de pie (cm)' },
]

export default function MeasurementsScreen() {
  const router = useRouter()
  const { measurements, loading, save } = useUserMeasurements()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!measurements) return
    setValues({
      height: measurements.height?.toString() ?? '',
      chest: measurements.chest?.toString() ?? '',
      waist: measurements.waist?.toString() ?? '',
      hip: measurements.hip?.toString() ?? '',
      thigh: measurements.thigh?.toString() ?? '',
      foot_length: measurements.foot_length?.toString() ?? '',
    })
  }, [measurements])

  function updateField(key: string, text: string) {
    setSaved(false)
    setValues(prev => ({ ...prev, [key]: text.replace(/[^0-9.]/g, '') }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const payload = FIELDS.reduce((acc, { key }) => {
      const raw = values[key]
      acc[key] = raw ? Number(raw) : null
      return acc
    }, {} as Record<string, number | null>)

    const error = await save(payload)
    setSaving(false)
    if (!error) setSaved(true)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backArrow} contentFit="contain" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mis medidas</Text>
          <Text style={styles.headerSubtitle}>Para recomendarte mejores talles</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.rosaOpa} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.card}>
              {FIELDS.map(({ key, label }, i) => (
                <View key={key} style={[styles.row, i === FIELDS.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={values[key] ?? ''}
                    onChangeText={text => updateField(key, text)}
                    placeholder="—"
                    placeholderTextColor={colors.grisMedio}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.blanco} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar medidas</Text>
              )}
            </TouchableOpacity>

            {saved && <Text style={styles.savedText}>Medidas guardadas ✓</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.grisBorde },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.grisBorde,
  },
  backBtn: { padding: 4 },
  backArrow: { width: 22, height: 22 },
  headerTitle: { fontSize: 22, fontFamily: fonts.palanquinDark, color: colors.negro },
  headerSubtitle: { fontSize: 12, color: colors.grisClaro, marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.blanco,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grisBorde,
  },
  label: { fontSize: 14, fontFamily: fonts.palanquinDark, color: colors.negro },
  input: {
    fontSize: 15,
    color: colors.negro,
    textAlign: 'right',
    minWidth: 70,
  },

  saveBtn: {
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: fonts.palanquinDark, color: colors.blanco },

  savedText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.rosaOpa,
    marginTop: spacing.md,
  },
})
