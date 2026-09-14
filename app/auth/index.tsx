import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { STORAGE_BASE_URL } from '../../constants/storage'

type Mode = 'login' | 'signup'

const USERNAME_REGEX = /^[a-z0-9._]+$/

export default function AuthScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  // Field-level errors
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  // ── Derived state ──────────────────────────────────────────────────────────
  const signupBlocked = !!(usernameError || emailError || passwordError)
  const loginBlocked = !!loginError

  // ── Username validation on change ──────────────────────────────────────────
  function handleUsernameChange(value: string) {
    setUsername(value)
    if (!value) { setUsernameError(null); return }
    const clean = value.toLowerCase()
    if (!USERNAME_REGEX.test(clean)) {
      setUsernameError('Solo se permiten letras, números, puntos y guiones bajos')
    } else {
      setUsernameError(null)
    }
  }

  // ── Clear password error on change ────────────────────────────────────────
  function handlePasswordChange(value: string) {
    setPassword(value)
    if (passwordError) setPasswordError(null)
  }

  // ── Clear login error as soon as user edits either field ───────────────────
  function handleLoginEmailChange(value: string) {
    setEmail(value)
    if (loginError) setLoginError(null)
  }

  function handleLoginPasswordChange(value: string) {
    setPassword(value)
    if (loginError) setLoginError(null)
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email || !password) {
      setLoginError('Completá el email y la contraseña')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setLoginError('El email o la contraseña son incorrectos')
    } else {
      router.replace('/(tabs)')
    }
  }

  // ── Signup ─────────────────────────────────────────────────────────────────
  async function handleSignup() {
    // Re-validate before submit
    let hasError = false
    const cleanUsername = username.toLowerCase()
    if (!cleanUsername || !USERNAME_REGEX.test(cleanUsername)) {
      setUsernameError('Solo se permiten letras, números, puntos y guiones bajos')
      hasError = true
    }
    if (!email) {
      setEmailError('Ingresá un email válido')
      hasError = true
    }
    if (hasError || signupBlocked) return

    if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
          display_name: displayName || cleanUsername,
        },
      },
    })
    setLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('email') || msg.includes('unique')) {
        setEmailError('Ya existe una cuenta con ese mismo mail')
      } else if (msg.includes('username') || msg.includes('usuario')) {
        setUsernameError('Ya existe una cuenta con ese mismo usuario')
      } else {
        setEmailError(error.message)
      }
    } else if (!data.session) {
      // Check if the username already exists in perfiles
      const { data: existing } = await supabase
        .from('perfiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle()

      if (existing) {
        setUsernameError('Ya existe una cuenta con ese mismo usuario')
        return
      }

      router.replace('/(tabs)')
    } else {
      router.replace('/(tabs)')
    }
  }

  // ── Switch mode ────────────────────────────────────────────────────────────
  function switchMode(next: Mode) {
    setMode(next)
    setUsernameError(null)
    setEmailError(null)
    setPasswordError(null)
    setLoginError(null)
    setEmail('')
    setPassword('')
    setUsername('')
    setDisplayName('')
  }

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
            source={{ uri: `${STORAGE_BASE_URL}/logoOPA-transparente.png` }}
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
            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Usuario</Text>
                <TextInput
                  style={[styles.input, !!usernameError && styles.inputError]}
                  placeholder="tu_usuario"
                  placeholderTextColor={colors.grisMedio}
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameError && <Text style={styles.fieldError}>{usernameError}</Text>}

                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre (opcional)"
                  placeholderTextColor={colors.grisMedio}
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, !!emailError && styles.inputError]}
              placeholder="tu@email.com"
              placeholderTextColor={colors.grisMedio}
              value={email}
              onChangeText={mode === 'login' ? handleLoginEmailChange : (v) => { setEmail(v); if (emailError) setEmailError(null) }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {mode === 'signup' && emailError && <Text style={styles.fieldError}>{emailError}</Text>}

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={[styles.input, !!passwordError && styles.inputError]}
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
              placeholderTextColor={colors.grisMedio}
              value={password}
              onChangeText={mode === 'login' ? handleLoginPasswordChange : handlePasswordChange}
              secureTextEntry
            />
            {mode === 'signup' && passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}

            {/* Login error banner */}
            {mode === 'login' && loginError && (
              <View style={styles.loginErrorBanner}>
                <Text style={styles.loginErrorText}>{loginError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || (mode === 'login' ? loginBlocked : signupBlocked)) && styles.primaryBtnDisabled,
              ]}
              onPress={mode === 'login' ? handleLogin : handleSignup}
              disabled={loading || (mode === 'login' ? loginBlocked : signupBlocked)}
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
  label: {
    fontSize: 12,
    color: colors.grisOscuro,
    fontFamily: fonts.mergeOne,
    marginTop: spacing.md,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.grisBorde,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.negro,
    backgroundColor: colors.blanco,
  },
  inputError: {
    borderColor: '#E53935',
  },
  fieldError: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 2,
    marginLeft: 4,
  },
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
