import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { Garment } from '../types'

export interface CartRow {
  id: string
  garment_id: string
  quantity: number
  size: string | null
  garment?: Garment & { brand?: { name: string } }
}

// Carrito muy básico y temporal: no hay checkout todavía (ver app/cart.tsx),
// esto solo permite agregar/editar/sacar items de `productos_carrito`.
export function useCart() {
  const session = useAuthStore((s) => s.session)
  const userId = session?.user.id
  const [items, setItems] = useState<CartRow[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('productos_carrito')
      .select('id, garment_id, quantity, size, garment:prendas(*, brand:marcas(name))')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
    setItems((data ?? []) as unknown as CartRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { refetch() }, [refetch])

  const addItem = useCallback(async (garmentId: string, size: string | null, quantity: number) => {
    if (!userId || loading) return false
    setLoading(true)
    try {
      const existingQuery = supabase
        .from('productos_carrito')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('garment_id', garmentId)
      const { data: existing } = await (size == null ? existingQuery.is('size', null) : existingQuery.eq('size', size)).maybeSingle()

      if (existing) {
        await supabase.from('productos_carrito').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
      } else {
        await supabase.from('productos_carrito').insert({ user_id: userId, garment_id: garmentId, size, quantity })
      }
      await refetch()
      return true
    } finally {
      setLoading(false)
    }
  }, [userId, loading, refetch])

  async function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) return removeItem(id)
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)))
    await supabase.from('productos_carrito').update({ quantity }).eq('id', id)
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('productos_carrito').delete().eq('id', id)
  }

  const total = items.reduce((sum, i) => sum + (i.garment?.price ?? 0) * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return { items, loading, total, count, addItem, refetch, updateQuantity, removeItem }
}
