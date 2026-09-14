import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

// Preguntarle algo a una marca — sobre una prenda puntual (garmentId) o la
// marca en general (garmentId undefined). Mismo patrón de requiresAuth que
// useSaveGarment/useFollow. Cuentas de marca no preguntan (mismo criterio que
// bloquea like/save/follow para is_brand) — el caller debe ocultar el botón.
export function useAskQuestion() {
  const session = useAuthStore((s) => s.session)
  const [sending, setSending] = useState(false)

  async function ask(brandId: string, question: string, garmentId?: string) {
    if (!session || !question.trim()) return { error: new Error('missing session or question') }
    setSending(true)
    const { error } = await supabase.from('preguntas').insert({
      user_id: session.user.id,
      brand_id: brandId,
      garment_id: garmentId ?? null,
      question: question.trim(),
    })
    setSending(false)
    return { error }
  }

  return { ask, sending, requiresAuth: !session }
}
