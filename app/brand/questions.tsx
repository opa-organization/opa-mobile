import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useAuthStore } from '../../store/useAuthStore'
import { useMyBrand } from '../../hooks/useMyBrand'
import { useBrandQuestions } from '../../hooks/useBrandQuestions'
import { timeAgo } from '../../lib/timeAgo'
import { initials } from '../../lib/text'
import { ErrorState } from '../../components/ui/ErrorState'
import { STORAGE_BASE_URL as STORAGE } from '../../constants/storage'

// Destino del "→" de la sección "Preguntas sin responder" en la Home de marca.
// Muestra TODAS las pendientes (Home solo muestra las primeras 3) y acá vive
// el flujo real de responder: tocar "Responder" abre un textarea inline, sin
// pantalla ni modal aparte.
export default function BrandQuestionsScreen() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const { brand } = useMyBrand(session?.user.id)
  const { questions, totalCount, loading, error, refetch, answer } = useBrandQuestions(brand?.id)

  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  function openAnswer(id: string) {
    setOpenId(id)
    setDraft('')
  }

  async function submitAnswer(id: string) {
    if (!draft.trim() || sending) return
    setSending(true)
    const { error } = await answer(id, draft.trim())
    setSending(false)
    if (!error) {
      setOpenId(null)
      setDraft('')
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backIcon} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preguntas sin responder</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: 40 }} />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : questions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No tenés preguntas pendientes.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.countText}>
              {totalCount} {totalCount === 1 ? 'pregunta espera' : 'preguntas esperan'} tu respuesta
            </Text>

            <View style={{ gap: spacing.sm }}>
              {questions.map((q) => {
                const isOpen = openId === q.id
                return (
                  <View key={q.id} style={styles.card}>
                    <View style={styles.row}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials(q.user?.username)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.topRow}>
                          <Text style={styles.user}>@{q.user?.username ?? 'usuario'}</Text>
                          <Text style={styles.time}>{timeAgo(q.created_at)}</Text>
                        </View>
                        <Text style={styles.question}>{q.question}</Text>
                      </View>
                    </View>

                    <View style={styles.bottomRow}>
                      <Text style={styles.about} numberOfLines={1}>
                        Sobre: {q.garment?.name ?? 'Perfil de la marca'}
                      </Text>
                      {!isOpen && (
                        <TouchableOpacity style={styles.answerPill} onPress={() => openAnswer(q.id)} activeOpacity={0.85}>
                          <Text style={styles.answerPillText}>Responder</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isOpen && (
                      <View style={styles.answerBox}>
                        <TextInput
                          style={styles.input}
                          placeholder="Escribí tu respuesta..."
                          placeholderTextColor={colors.grisClaro}
                          value={draft}
                          onChangeText={setDraft}
                          multiline
                          autoFocus
                        />
                        <View style={styles.answerActions}>
                          <TouchableOpacity onPress={() => setOpenId(null)} style={styles.cancelBtn} activeOpacity={0.7}>
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => submitAnswer(q.id)}
                            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                            disabled={!draft.trim() || sending}
                            activeOpacity={0.85}
                          >
                            {sending ? (
                              <ActivityIndicator color={colors.blanco} size="small" />
                            ) : (
                              <Text style={styles.sendBtnText}>Enviar respuesta</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  emptyText: { fontSize: 14, color: colors.grisClaro, textAlign: 'center' },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  countText: { fontSize: 12, color: colors.grisClaro, marginBottom: spacing.md },

  card: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: radius.card, padding: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 9999, backgroundColor: colors.grisBorde,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: colors.grisOscuro },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  user: { fontSize: 13, fontWeight: '700', color: colors.negro },
  time: { fontSize: 11, color: colors.grisClaro },
  question: { fontSize: 13, color: colors.grisOscuro, marginTop: 2, lineHeight: 17 },

  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.sm,
  },
  about: { fontSize: 11, color: colors.grisClaro, flex: 1, marginRight: spacing.sm },
  answerPill: {
    backgroundColor: colors.rosaOpa, borderRadius: radius.button,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  answerPillText: { fontSize: 12, fontWeight: '700', color: colors.blanco, fontFamily: fonts.palanquinDark },

  answerBox: { marginTop: spacing.sm, gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.grisMedio, borderRadius: radius.button,
    padding: spacing.sm, fontSize: 13, color: colors.negro, minHeight: 64,
    textAlignVertical: 'top',
  },
  answerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: 10, justifyContent: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: colors.grisOscuro },
  sendBtn: {
    backgroundColor: colors.rosaOpa, borderRadius: radius.button,
    paddingHorizontal: spacing.md, paddingVertical: 10, minWidth: 130,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.rosaOpaLight },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: colors.blanco, fontFamily: fonts.palanquinDark },
})
