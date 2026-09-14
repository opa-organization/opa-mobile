import React, { useRef, useState } from 'react'
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native'
import { Image } from 'expo-image'
import { colors } from '../../constants/colors'

interface Props {
  uri: string | null
  visible: boolean
  onClose: () => void
}

const { width: SW, height: SH } = Dimensions.get('window')
const DOUBLE_TAP_MS = 280

// Visor full-screen con doble tap para zoom in/out. Nota: se probó primero una
// versión con PanResponder (pellizco + paneo continuo), pero en react-native-web
// dejaba el sistema de responders trabado — una vez abierto el modal, TODOS los
// botones de la pantalla (incluido el propio botón de cerrar) dejaban de
// responder a taps. Esta versión usa solo onPress (mismo mecanismo que el resto
// de la app), sin PanResponder, para evitarlo.
export function ZoomableImage({ uri, visible, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false)
  const scale = useRef(new Animated.Value(1)).current
  const lastTap = useRef(0)

  function handlePress() {
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      const next = !zoomed
      setZoomed(next)
      Animated.spring(scale, { toValue: next ? 2.2 : 1, useNativeDriver: true }).start()
    }
    lastTap.current = now
  }

  function handleClose() {
    setZoomed(false)
    scale.setValue(1)
    lastTap.current = 0
    onClose()
  }

  if (!uri) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose} accessibilityLabel="Cerrar" accessibilityRole="button">
          <View style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </View>
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={handlePress}>
          <Animated.View style={[styles.imageWrap, { transform: [{ scale }] }]}>
            <Image source={{ uri }} style={styles.image} contentFit="contain" />
          </Animated.View>
        </TouchableWithoutFeedback>
        <Text style={styles.hint}>{zoomed ? 'Doble tap para volver al tamaño normal' : 'Doble tap para hacer zoom'}</Text>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: colors.blanco, fontSize: 22 },
  imageWrap: { width: SW, height: SH },
  image: { width: '100%', height: '100%' },
  hint: {
    position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: 12,
  },
})
