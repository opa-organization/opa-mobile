import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { colors } from '../constants/colors'
import { fonts } from '../constants/fonts'
import { spacing } from '../constants/spacing'
import { radius } from '../constants/radius'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import { getRememberedAccounts, removeRememberedAccount, RememberedAccount } from '../lib/rememberedAccounts'
import { STORAGE_BASE_URL as STORAGE } from '../constants/storage'
import { Avatar } from '../components/ui/Avatar'

export default function SwitchAccountScreen() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const [accounts, setAccounts] = useState<RememberedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  useEffect(() => {
    getRememberedAccounts().then((list) => {
      setAccounts(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      setLoading(false)
    })
  }, [])

  async function handleSwitch(account: RememberedAccount) {
    if (account.userId === session?.user.id || switchingId) return
    setSwitchingId(account.userId)
    const { error } = await supabase.auth.setSession({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    })
    if (error) {
      await removeRememberedAccount(account.userId)
      setAccounts((prev) => prev.filter((a) => a.userId !== account.userId))
      setSwitchingId(null)
      Alert.alert(
        'Sesión vencida',
        `Tu sesión en ${account.email} venció. Iniciá sesión de nuevo con esa cuenta.`
      )
      return
    }
    setSwitchingId(null)
    router.replace('/(tabs)/profile')
  }

  const displayLabel = (a: RememberedAccount) => a.displayName || a.username || a.email

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        {session && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backArrow} contentFit="contain" />
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.headerTitle}>Cambiar de cuenta</Text>
          <Text style={styles.headerSubtitle}>
            {session
              ? 'Saltá entre las cuentas de este dispositivo'
              : 'Elegí una cuenta para continuar'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.rosaOpa} style={{ marginTop: spacing.xxl }} />
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            {accounts.map((account, i) => {
              const isActive = account.userId === session?.user.id
              return (
                <View key={account.userId}>
                  <TouchableOpacity
                    style={[styles.row, isActive && styles.rowActive]}
                    activeOpacity={isActive ? 1 : 0.7}
                    onPress={() => handleSwitch(account)}
                    disabled={!!switchingId}
                  >
                    <Avatar
                      uri={account.avatarUrl}
                      label={displayLabel(account)}
                      size={44}
                      fallbackBackgroundColor={colors.rosaOpa}
                      fallbackTextColor={colors.blanco}
                      fallbackFontSize={18}
                      fallbackFontFamily={fonts.mergeOne}
                    />
                    <View style={styles.rowText}>
                      <View style={styles.rowNameLine}>
                        <Text style={styles.rowLabel} numberOfLines={1}>{displayLabel(account)}</Text>
                        {account.isBrand && (
                          <View style={styles.brandBadge}>
                            <Text style={styles.brandBadgeText}>Marca</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rowDesc} numberOfLines={1}>{account.email}</Text>
                    </View>
                    {switchingId === account.userId ? (
                      <ActivityIndicator color={colors.rosaOpa} size="small" />
                    ) : isActive ? (
                      <Text style={styles.activeLabel}>Cuenta actual</Text>
                    ) : null}
                  </TouchableOpacity>
                  {i < accounts.length - 1 && <View style={styles.divider} />}
                </View>
              )
            })}

            {accounts.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.rowDesc}>No hay otras cuentas guardadas en este dispositivo.</Text>
              </View>
            )}

            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => router.push('/auth')}
              disabled={!!switchingId}
            >
              <View style={[styles.avatar, styles.addAvatar]}>
                <Text style={styles.addIcon}>+</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Agregar cuenta</Text>
                <Text style={styles.rowDesc}>Iniciar sesión con otra cuenta</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
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

  section: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  sectionCard: {
    backgroundColor: colors.blanco,
    borderRadius: radius.card,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
  },
  rowActive: { backgroundColor: colors.rosaOpaLight },
  divider: { height: 1, backgroundColor: colors.grisBorde, marginLeft: 44 + spacing.md * 2 },

  avatar: { width: 44, height: 44, borderRadius: radius.avatar },
  addAvatar: {
    backgroundColor: colors.rosaOpaLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.rosaOpa,
    borderStyle: 'dashed',
  },
  addIcon: { fontSize: 22, color: colors.rosaOpa, fontWeight: '300', lineHeight: 24 },

  rowText: { flex: 1 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 14, fontFamily: fonts.palanquinDark, color: colors.negro, flexShrink: 1 },
  rowDesc: { fontSize: 11, color: colors.grisClaro, marginTop: 1 },

  brandBadge: {
    backgroundColor: colors.rosaOpaLight,
    borderRadius: radius.tag,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  brandBadgeText: { fontSize: 9, color: colors.rosaOpa, fontFamily: fonts.palanquinDark },

  activeLabel: { fontSize: 11, color: colors.rosaOpa, fontFamily: fonts.palanquinDark },

  emptyRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
})
