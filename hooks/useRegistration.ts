import { useState } from 'react'
import { supabase } from '../lib/supabase'

type SignupPayload = {
  email: string
  password: string
  username: string
  displayName: string
}

type SubmitError = {
  field: 'email' | 'username' | 'password' | 'general'
  message: string
}

export function useRegistration() {
  const [loading, setLoading] = useState(false)

  async function login(email: string, password: string): Promise<SubmitError | null> {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      return { field: 'general', message: 'El email o la contraseña son incorrectos' }
    }
    return null
  }

  async function signup(payload: SignupPayload): Promise<SubmitError | null> {
    const cleanUsername = payload.username.toLowerCase()

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          username: cleanUsername,
          display_name: payload.displayName || cleanUsername,
        },
      },
    })

    if (error) {
      setLoading(false)
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('email') || msg.includes('unique')) {
        return { field: 'email', message: 'Ya existe una cuenta con ese mismo mail' }
      }
      if (msg.includes('username') || msg.includes('usuario')) {
        return { field: 'username', message: 'Ya existe una cuenta con ese mismo usuario' }
      }
      return { field: 'general', message: error.message }
    }

    if (!data.session) {
      // signUp no devolvió error, pero tampoco sesión: el trigger handle_new_user
      // corre igual, así que chequeamos si el username ya estaba tomado por otra cuenta.
      const { data: existing } = await supabase
        .from('perfiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle()

      setLoading(false)
      if (existing) {
        return { field: 'username', message: 'Ya existe una cuenta con ese mismo usuario' }
      }
      return null
    }

    setLoading(false)
    return null
  }

  return { login, signup, loading }
}
