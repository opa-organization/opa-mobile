import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { PalanquinDark_400Regular } from '@expo-google-fonts/palanquin-dark'
import * as SplashScreen from 'expo-splash-screen'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { MobileFrame } from '../components/layout/MobileFrame'
import { upsertRememberedAccount, removeRememberedAccount } from '../lib/rememberedAccounts'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PalanquinDark_400Regular,
    MergeOne_400Regular: require('../assets/fonts/MergeOne-Regular.ttf'),
  })

  const setSession = useAuthStore((s) => s.setSession)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setInitialized = useAuthStore((s) => s.setInitialized)

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id, session)
      else setInitialized(true)
    })

    // Listen for auth changes — skip INITIAL_SESSION, already handled by getSession() above
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        // "Cerrar sesión" (en cualquiera de sus dos implementaciones, local o
        // global) significa "salí de esta cuenta en este dispositivo" — se
        // borra del switcher para no ofrecer un re-ingreso sin contraseña.
        const prevUserId = useAuthStore.getState().session?.user.id
        if (prevUserId) removeRememberedAccount(prevUserId)
      }
      setSession(session)
      if (session?.user) fetchProfile(session.user.id, session)
      else {
        setProfile(null)
        setInitialized(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string, session: Session) {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)
    setInitialized(true)

    // Recuerda/actualiza la cuenta para el switcher multi-cuenta. Se re-escribe
    // en cada llamada (incluido TOKEN_REFRESHED) porque el refresh_token rota.
    if (data && session.user.email) {
      upsertRememberedAccount({
        userId,
        email: session.user.email,
        username: data.username ?? null,
        displayName: data.display_name ?? null,
        avatarUrl: data.avatar_url ?? null,
        isBrand: !!data.is_brand,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <MobileFrame>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="outfit/[id]" />
        <Stack.Screen name="product/[id]" />
      </Stack>
    </MobileFrame>
  )
}
