import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { useRegistration } from '../../hooks/useRegistration'
import AuthFormFields from '../../components/auth/AuthFormFields'
import { AuthFormValues } from '../../components/auth/authFormTypes'

type Mode = 'login' | 'signup'

const DEFAULT_VALUES: AuthFormValues = {
  email: '',
  password: '',
  username: '',
  displayName: '',
  acceptTerms: false,
}

// Componente contenedor (TP 10): administra el estado del formulario con
// React Hook Form (useForm/handleSubmit/formState/errors) y la lógica de
// registro/login con el hook useRegistration (que a su vez habla con
// Supabase). AuthFormFields, más abajo, es el hijo puramente presentacional
// que recibe `control`/`errors` como props y no duplica los datos con
// useState propio.
export default function AuthScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [generalError, setGeneralError] = useState<string | null>(null)
  const { login, signup, loading } = useRegistration()

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<AuthFormValues>({
    mode: 'onChange',
    defaultValues: DEFAULT_VALUES,
  })

  // ── Switch mode ────────────────────────────────────────────────────────────
  function switchMode(next: Mode) {
    setMode(next)
    setGeneralError(null)
    reset(DEFAULT_VALUES)
  }

  // ── Submit (login o signup, ya validado por React Hook Form) ───────────────
  const onSubmit = handleSubmit(async (values) => {
    setGeneralError(null)

    if (mode === 'login') {
      const err = await login(values.email, values.password)
      if (err) {
        setGeneralError(err.message)
        return
      }
      router.replace('/(tabs)')
      return
    }

    const err = await signup({
      email: values.email,
      password: values.password,
      username: values.username,
      displayName: values.displayName,
    })
    if (err) {
      if (err.field === 'general') {
        setGeneralError(err.message)
      } else {
        setError(err.field, { type: 'server', message: err.message })
      }
      return
    }
    router.replace('/(tabs)')
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Image
            source={{ uri: 'https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/assets/logoOPA-transparente.png' }}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>
            {mode === 'login' ? 'Bienvenido/a de vuelta' : 'Creá tu cuenta'}
          </Text>

          {/* Mode switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
              onPress={() => switchMode('login')}
            >
              <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
                Iniciá sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
              onPress={() => switchMode('signup')}
            >
              <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                Registrate
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <AuthFormFields control={control} errors={errors} mode={mode} />

            {generalError && (
              <View style={styles.loginErrorBanner}>
                <Text style={styles.loginErrorText}>{generalError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || Object.keys(errors).length > 0) && styles.primaryBtnDisabled,
              ]}
              onPress={onSubmit}
              disabled={loading || Object.keys(errors).length > 0}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.blanco} />
                : <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            >
              <Text style={styles.switchLinkText}>
                {mode === 'login'
                  ? '¿No tenés cuenta? Registrate'
                  : '¿Ya tenés cuenta? Iniciá sesión'}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blanco },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  closeText: { fontSize: 18, color: colors.grisClaro },
  logo: {
    width: 160,
    height: 80,
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 15,
    color: colors.grisClaro,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.grisBorde,
    borderRadius: radius.button,
    padding: 4,
    marginBottom: spacing.xl,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.button - 2,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: colors.blanco },
  modeTabText: {
    fontSize: 14,
    color: colors.grisClaro,
    fontFamily: fonts.palanquinDark,
  },
  modeTabTextActive: { color: colors.negro },
  form: { gap: spacing.xs },
  loginErrorBanner: {
    backgroundColor: 'rgba(229, 57, 53, 0.08)',
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  loginErrorText: {
    fontSize: 13,
    color: '#E53935',
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.rosaOpa,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: colors.blanco,
    fontSize: 15,
    fontFamily: fonts.palanquinDark,
  },
  switchLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLinkText: {
    fontSize: 13,
    color: colors.rosaOpa,
    fontFamily: fonts.palanquinDark,
  },
})
