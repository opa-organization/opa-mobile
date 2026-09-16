import React, { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { colors } from '../../constants/colors'
import { radius } from '../../constants/radius'
import { spacing } from '../../constants/spacing'

interface ToastProps {
  message: string | null
  bottom?: number
}

// Mensaje flotante con fade in/out — antes `app/cart.tsx` y `app/product/[id].tsx`
// tenían cada uno su propio `{toast && <View>...}` que aparecía/desaparecía de
// golpe con el condicional de render. `rendered` guarda el último texto no-nulo
// para poder animar la salida (fade out) antes de desmontar, en vez de que el
// texto desaparezca en el mismo instante en que el padre limpia `message`.
export function Toast({ message, bottom = 24 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const [rendered, setRendered] = useState<string | null>(null)

  useEffect(() => {
    if (message) {
      setRendered(message)
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else if (rendered) {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setRendered(null))
    }
  }, [message])

  if (!rendered) return null

  return (
    <Animated.View style={[styles.toast, { bottom, opacity }]}>
      <Text style={styles.toastText}>{rendered}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.negro, borderRadius: radius.chip,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  toastText: { color: colors.blanco, fontSize: 13, fontWeight: '600' },
})
