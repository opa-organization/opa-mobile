import React, { useEffect, useRef } from 'react'
import { Animated, ViewStyle } from 'react-native'
import { colors } from '../../constants/colors'

interface SkeletonProps {
  width: number | `${number}%`
  height: number
  borderRadius?: number
  style?: ViewStyle
}

// Placeholder rectangular con shimmer sutil (loop de opacity) para mostrar
// mientras carga contenido real, en vez de un spinner genérico centrado —
// da una idea de la forma que va a tener el contenido antes de que llegue.
export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.grisBorde, opacity }, style]}
    />
  )
}
