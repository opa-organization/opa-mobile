import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'

interface Props {
  title: string
  onPress?: () => void
}

export function SectionHeader({ title, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onPress && (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.6}
          style={styles.arrow}
          accessibilityLabel="Ver más"
          accessibilityRole="button"
        >
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.negro,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.mergeOne,
  },
  arrow: {
    padding: 4,
  },
  arrowText: {
    fontSize: 16,
    color: colors.rosaOpa,
    fontWeight: '700',
  },
})
