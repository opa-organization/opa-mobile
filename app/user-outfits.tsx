import React, { useEffect, useRef, useState } from 'react'
import {
  View, FlatList, StyleSheet, useWindowDimensions,
  TouchableOpacity, Text, StatusBar, ActivityIndicator, ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useOutfits } from '../hooks/useOutfits'
import { OutfitScrollItem } from '../components/outfit/OutfitScrollItem'
import { ErrorState } from '../components/ui/ErrorState'
import { colors } from '../constants/colors'
import { STORAGE_BASE_URL as STORAGE } from '../constants/storage'

export default function UserOutfitsScreen() {
  const router = useRouter()
  const { userId, startIndex } = useLocalSearchParams<{ userId: string; startIndex?: string }>()
  const { height: SH } = useWindowDimensions()
  const { outfits, loading, loadingMore, hasMore, error, loadMore, refetch } = useOutfits(userId)
  const [activeIndex, setActiveIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const didScrollRef = useRef(false)

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
  })

  useEffect(() => {
    if (loading || outfits.length === 0 || didScrollRef.current) return
    const index = parseInt(startIndex ?? '0', 10)
    if (isNaN(index) || index < 0) return
    didScrollRef.current = true
    setActiveIndex(index)
    if (index === 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
    } else {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: false })
      }, 100)
    }
  }, [loading, outfits, startIndex])

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.blanco} size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ErrorState variant="dark" onRetry={refetch} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Minimal back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Image source={{ uri: `${STORAGE}/flecha.png` }} style={styles.backText} contentFit="contain" tintColor={colors.blanco} />
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={outfits}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SH}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
        onEndReached={() => { if (hasMore) loadMore() }}
        onEndReachedThreshold={1}
        ListFooterComponent={loadingMore ? (
          <View style={{ height: SH, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.blanco} size="small" />
          </View>
        ) : null}
        renderItem={({ item, index }) => (
          <OutfitScrollItem outfit={item} isActive={index === activeIndex} height={SH} />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.negro },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { width: 18, height: 18 },
})
