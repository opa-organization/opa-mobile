import { Platform } from 'react-native'
import { supabase } from './supabase'

// Manda un error real (fallo de una query, no "no hay datos") a
// `error_logs` en Supabase — le da a opa-dev un lugar donde ver los fallos
// de producción sin depender de que el usuario lo reporte (ver
// .claude/documents/meta-2026-09-14-code-audit.md, B5). Best-effort: si el
// propio insert de logging falla (sin red, etc.), no hace nada más — nunca
// debe tirar abajo el flujo que la llamó.
export async function logError(source: string, message: string, details?: Record<string, unknown>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('error_logs').insert({
      source,
      message,
      details: details ?? null,
      user_id: user?.id ?? null,
      platform: Platform.OS,
    })
  } catch {
    // best-effort — un log que falla no debe generar un error nuevo
  }
}
