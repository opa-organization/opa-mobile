import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, StatusBar, Modal, TextInput, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { colors } from '../constants/colors'
import { fonts } from '../constants/fonts'
import { spacing } from '../constants/spacing'
import { radius } from '../constants/radius'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import { getRememberedAccounts } from '../lib/rememberedAccounts'
import { STORAGE_BASE_URL } from '../constants/storage'
import { Avatar } from '../components/ui/Avatar'

const BASE = `${STORAGE_BASE_URL}/`

// icon: nombre de archivo en Storage; textIcon: glifo de texto para casos sin
// asset dedicado (no hay ícono de "cambiar cuenta" en el bucket — ver CLAUDE.md).
type SettingsItem = { label: string; desc: string; icon?: string; textIcon?: string; route?: string }

const SECTIONS: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'CUENTA',
    items: [
      { label: 'Cambiar de cuenta', desc: 'Saltá entre las cuentas de este dispositivo', textIcon: '⇄', route: '/switch-account' },
      { label: 'Editar perfil', desc: 'Actualizá tu información personal', icon: 'lapiz_rosa.png' },
      { label: 'Seguridad', desc: 'Contraseña, sesión y verificación en dos pasos', icon: 'candado.png' },
      { label: 'Email y notificaciones', desc: 'Gestioná tus notificaciones y preferencias', icon: 'carta.png' },
    ],
  },
  {
    title: 'PREFERENCIAS',
    items: [
      { label: 'Preferencias de estilo', desc: 'Colores, estilos, temporadas, todo lo que te guste', icon: 'percha_rosa.png' },
      { label: 'Mis medidas', desc: 'Editá tus medidas para mejores recomendaciones', icon: 'cinta-metrica.png', route: '/measurements' },
      { label: 'Talles preferidos', desc: 'Gestioná tus talles ideales por categoría', icon: 'zapatos_rosa.png' },
    ],
  },
  {
    title: 'APLICACIÓN',
    items: [
      { label: 'Notificaciones', desc: 'Administrá las notificaciones de la app', icon: 'campana.png' },
      { label: 'Privacidad', desc: 'Controlá tu privacidad y datos', icon: 'escudo.png' },
      { label: 'Ayuda y soporte', desc: 'Preguntas frecuentes y contacto', icon: 'pregunta_rosa.png' },
    ],
  },
]

export default function SettingsScreen() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const clear = useAuthStore((s) => s.clear)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showBrandModal, setShowBrandModal] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [brandInstagram, setBrandInstagram] = useState('')
  const [brandCategory, setBrandCategory] = useState('')
  const [brandError, setBrandError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandSubmitted, setBrandSubmitted] = useState(false)

  const displayUsername = profile?.username ?? session?.user.email?.split('@')[0] ?? 'usuario'
  const displayName = profile?.display_name ?? ''
  const avatarUrl = profile?.avatar_url

  async function handleLogout() {
    // Snapshot ANTES de signOut(): no depender de la carrera contra el
    // removeRememberedAccount() que dispara el listener de _layout.tsx en
    // paralelo (ver CLAUDE.md, bug del switcher 2026-08-14).
    const currentUserId = session?.user.id
    const otherAccounts = currentUserId
      ? (await getRememberedAccounts()).filter((a) => a.userId !== currentUserId)
      : []
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    clear()
    router.replace(otherAccounts.length > 0 ? '/switch-account' : '/(tabs)')
  }

  function openDeleteModal() {
    setPassword('')
    setPasswordError('')
    setShowDeleteModal(true)
  }

  function closeDeleteModal() {
    setShowDeleteModal(false)
    setPassword('')
    setPasswordError('')
  }

  function openBrandModal() {
    setBrandName('')
    setBrandInstagram('')
    setBrandCategory('')
    setBrandError('')
    setBrandSubmitted(false)
    setShowBrandModal(true)
  }

  function closeBrandModal() {
    setShowBrandModal(false)
  }

  async function handleSubmitBrandApplication() {
    if (!session?.user?.id) return
    if (!brandName.trim()) {
      setBrandError('Ingresá el nombre de tu marca.')
      return
    }
    setBrandLoading(true)
    setBrandError('')

    const { error } = await supabase.from('brand_applications').insert({
      applicant_id: session.user.id,
      brand_name: brandName.trim(),
      instagram_handle: brandInstagram.trim() || null,
      category: brandCategory.trim() || null,
    })

    setBrandLoading(false)
    if (error) {
      setBrandError('Ocurrió un error al enviar la solicitud. Intentá más tarde.')
      return
    }
    setBrandSubmitted(true)
  }

  async function handleDeleteAccount() {
    if (!session?.user?.email) return
    setLoading(true)
    setPasswordError('')

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password,
    })

    if (signInError) {
      setPasswordError('Contraseña incorrecta. Intentá de nuevo.')
      setLoading(false)
      return
    }

    // Delete account via RPC
    const { error: deleteError } = await supabase.rpc('delete_user')
    if (deleteError) {
      setPasswordError('Ocurrió un error al eliminar la cuenta. Intentá más tarde.')
      setLoading(false)
      return
    }

    const currentUserId = session.user.id
    const otherAccounts = (await getRememberedAccounts()).filter((a) => a.userId !== currentUserId)

    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    clear()
    setLoading(false)
    closeDeleteModal()
    router.replace(otherAccounts.length > 0 ? '/switch-account' : '/(tabs)')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Configuración</Text>
            <Text style={styles.headerSubtitle}>Gestioná tu cuenta y tus preferencias</Text>
          </View>
        </View>

        {/* Profile card */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={() => router.back()}>
          <Avatar
            uri={avatarUrl}
            label={displayUsername}
            size={52}
            fallbackBackgroundColor={colors.rosaOpa}
            fallbackTextColor={colors.blanco}
            fallbackFontSize={22}
            fallbackFontFamily={fonts.mergeOne}
          />
          <View style={styles.profileCardInfo}>
            <Text style={styles.profileCardName}>{displayName || displayUsername}</Text>
            <Text style={styles.profileCardUsername}>@{displayUsername}</Text>
          </View>
          <Text style={styles.profileCardLink}>Ver mi perfil {'>'}</Text>
        </TouchableOpacity>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={item.route ? () => router.push(item.route as any) : undefined}
                  >
                    <View style={styles.rowIconWrap}>
                      {item.textIcon ? (
                        <Text style={styles.rowTextIcon}>{item.textIcon}</Text>
                      ) : (
                        <Image
                          source={{ uri: BASE + item.icon }}
                          style={styles.rowIcon}
                          contentFit="contain"
                        />
                      )}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                      <Text style={styles.rowDesc}>{item.desc}</Text>
                    </View>
                    <Text style={styles.rowArrow}>{'>'}</Text>
                  </TouchableOpacity>
                  {i < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Registrar marca */}
        {!profile?.is_brand && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MARCA</Text>
            <View style={styles.sectionCard}>
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={openBrandModal}>
                <View style={styles.rowIconWrap}>
                  <Image
                    source={{ uri: BASE + 'caja_rosa.png' }}
                    style={styles.rowIcon}
                    contentFit="contain"
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Registrar Marca</Text>
                  <Text style={styles.rowDesc}>Sumá tu marca a OPA y vendé tus prendas</Text>
                </View>
                <Text style={styles.rowArrow}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.version}>OPA Versión 1.0</Text>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleLogout}>
              <View style={styles.rowIconWrap}>
                <Image
                  source={{ uri: BASE + 'cerrar-sesion_negro.png' }}
                  style={styles.rowIcon}
                  contentFit="contain"
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, styles.logoutLabel]}>Cerrar sesión</Text>
                <Text style={styles.rowDesc}>Salir de tu cuenta en este dispositivo</Text>
              </View>
              <Text style={styles.rowArrow}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete account */}
        <View style={[styles.section, { marginBottom: spacing.xxl }]}>
          <View style={[styles.sectionCard, styles.deleteCard]}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={openDeleteModal}>
              <View style={styles.rowIconWrap}>
                <Image
                  source={{ uri: BASE + 'trash_rojo.png' }}
                  style={styles.rowIcon}
                  contentFit="contain"
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, styles.deleteLabel]}>Eliminar cuenta</Text>
                <Text style={styles.rowDesc}>Elimina este perfil definitivamente</Text>
              </View>
              <Text style={styles.rowArrow}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Delete account modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Eliminar cuenta</Text>
            <Text style={styles.modalSubtitle}>
              Esta acción es permanente e irreversible. Todos tus datos serán eliminados.
            </Text>
            <Text style={styles.modalSubtitle}>Ingresá tu contraseña para confirmar:</Text>

            <TextInput
              style={[styles.input, passwordError ? styles.inputError : null]}
              placeholder="Contraseña"
              placeholderTextColor={colors.grisMedio}
              value={password}
              onChangeText={text => {
                setPassword(text)
                if (passwordError) setPasswordError('')
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeDeleteModal}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, (!password || loading) && styles.deleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={!password || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.blanco} size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Brand application modal */}
      <Modal
        visible={showBrandModal}
        transparent
        animationType="fade"
        onRequestClose={closeBrandModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {brandSubmitted ? (
              <>
                <Text style={styles.modalTitle}>¡Solicitud enviada!</Text>
                <Text style={styles.modalSubtitle}>
                  Vamos a revisar tu solicitud y te avisamos por email cuando esté aprobada.
                </Text>
                <TouchableOpacity style={[styles.deleteBtn, styles.brandCloseBtn]} onPress={closeBrandModal}>
                  <Text style={styles.deleteBtnText}>Listo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Registrar Marca</Text>
                <Text style={styles.modalSubtitle}>
                  Contanos sobre tu marca. Un admin va a revisar tu solicitud.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Nombre de la marca"
                  placeholderTextColor={colors.grisMedio}
                  value={brandName}
                  onChangeText={setBrandName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Instagram (opcional)"
                  placeholderTextColor={colors.grisMedio}
                  value={brandInstagram}
                  onChangeText={setBrandInstagram}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Categoría (ej: Ropa, Calzado, Accesorios)"
                  placeholderTextColor={colors.grisMedio}
                  value={brandCategory}
                  onChangeText={setBrandCategory}
                />

                {brandError ? <Text style={styles.errorText}>{brandError}</Text> : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeBrandModal} disabled={brandLoading}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBrandBtn, (!brandName.trim() || brandLoading) && styles.deleteBtnDisabled]}
                    onPress={handleSubmitBrandApplication}
                    disabled={!brandName.trim() || brandLoading}
                  >
                    {brandLoading ? (
                      <ActivityIndicator color={colors.blanco} size="small" />
                    ) : (
                      <Text style={styles.deleteBtnText}>Enviar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  backArrow: { fontSize: 22, color: colors.negro },
  headerTitle: { fontSize: 22, fontFamily: fonts.palanquinDark, color: colors.negro },
  headerSubtitle: { fontSize: 12, color: colors.grisClaro, marginTop: 1 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.rosaOpaLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  profileCardInfo: { flex: 1 },
  profileCardName: { fontSize: 15, fontFamily: fonts.palanquinDark, color: colors.negro },
  profileCardUsername: { fontSize: 12, color: colors.grisClaro, marginTop: 1 },
  profileCardLink: { fontSize: 13, color: colors.rosaOpa, fontFamily: fonts.palanquinDark },

  section: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 11,
    color: colors.grisClaro,
    fontFamily: fonts.palanquinDark,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: colors.blanco,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  deleteCard: { backgroundColor: 'rgba(235, 0, 107, 0.08)' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.rosaOpaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { width: 20, height: 20 },
  rowTextIcon: { fontSize: 18, color: colors.rosaOpa, fontWeight: '600' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: fonts.palanquinDark, color: colors.negro },
  rowDesc: { fontSize: 11, color: colors.grisClaro, marginTop: 1 },
  rowArrow: { fontSize: 16, color: colors.grisClaro },
  divider: { height: 1, backgroundColor: colors.grisBorde, marginLeft: 36 + spacing.md * 2 },

  logoutLabel: { color: colors.negro },
  deleteLabel: { color: colors.rosaOpa },

  version: {
    textAlign: 'right',
    fontSize: 11,
    color: colors.grisClaro,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  // Delete modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.blanco,
    borderRadius: radius.card,
    padding: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.mergeOne,
    color: colors.negro,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.grisOscuro,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.grisBorde,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.negro,
    marginTop: spacing.sm,
  },
  inputError: {
    borderColor: '#D00000',
  },
  errorText: {
    fontSize: 12,
    color: '#D00000',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.grisOscuro,
    fontFamily: fonts.palanquinDark,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#D00000',
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: {
    fontSize: 14,
    color: colors.blanco,
    fontFamily: fonts.palanquinDark,
  },

  saveBrandBtn: {
    flex: 1,
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: 'center',
  },
  brandCloseBtn: { backgroundColor: colors.rosaOpa, marginTop: spacing.sm },
})
