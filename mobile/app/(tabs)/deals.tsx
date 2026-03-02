/**
 * Deals Screen - Active deals listing
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, RefreshControl, Dimensions, Pressable, StyleSheet, Linking } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, Percent, Package, Heart, BarChart3, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, EmptyState, SkeletonCard, KeyedProductImage } from '@/src/components/ui';
import { calculateSavingsPercentage } from '@/src/lib/utils';
import { STORE_LOGOS } from '@/src/lib/constants/store-logos';
import { useCompareStore } from '@/src/lib/compare/compare-store';
import { useSavedStore } from '@/src/lib/wishlist/saved-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

export default function DealsScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('product_stores')
        .select('id, current_price, original_price, deal_expires_at, product_url, products(id, name_ar, name_en, slug, image_urls, brand, category), stores(id, name_ar, name_en)')
        .eq('is_deal', true)
        .order('created_at', { ascending: false })
        .limit(50);
      setDeals(data || []);
    } catch (err) {
      console.error('Deals fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals();
    setRefreshing(false);
  }, [fetchDeals]);

  const renderDeal = useCallback(({ item, index }: { item: any; index: number }) => {
    const product = item.products;
    if (!product) return null;

    return (
      <View style={{ flex: 1, paddingRight: index % 2 === 0 ? spacing.sm / 2 : 0, paddingLeft: index % 2 === 1 ? spacing.sm / 2 : 0, marginBottom: spacing.sm }}>
        <DealCard item={item} colors={colors} rtl={rtl} locale={locale} />
      </View>
    );
  }, [locale, colors, rtl]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.dealsHeader, { flexDirection: rtl.row }]}>
        <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm }}>
          <Zap size={28} color={colors.deal} strokeWidth={2} fill={colors.deal} />
          <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', fontSize: 28, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {locale === 'ar' ? 'العروض' : 'Deals'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(stack)/coupons');
          }}
          accessibilityRole="button"
          accessibilityLabel={locale === 'ar' ? 'عرض الكوبونات' : 'View coupons'}
          style={({ pressed }) => [
            styles.couponsBtn,
            {
              flexDirection: rtl.row,
              backgroundColor: colors.secondaryGroupedBackground,
              borderColor: colors.separator,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Percent size={16} color={colors.deal} />
          <Text style={[typography.footnote, { color: colors.deal, fontWeight: '700' }]}>
            {locale === 'ar' ? 'كوبونات' : 'Coupons'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} style={{ width: CARD_WIDTH }} />)}
        </View>
      ) : deals.length === 0 ? (
        <EmptyState
          title={locale === 'ar' ? 'لا توجد عروض حالياً' : 'No deals right now'}
          message={locale === 'ar' ? 'تحقق لاحقاً للعروض الجديدة' : 'Check back later for new deals'}
        />
      ) : (
        <FlashList
          data={deals}
          renderItem={renderDeal}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: spacing.xxl, paddingHorizontal: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={250}
        />
      )}
    </SafeAreaView>
  );
}

function DealCard({ item, colors, rtl, locale }: { item: any; colors: any; rtl: ReturnType<typeof useRTL>; locale: string }) {
  const product = item.products;
  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const storeName = locale === 'ar' ? item.stores?.name_ar : item.stores?.name_en;
  const storeId = item.stores?.id;
  const image = product.image_urls?.[0];
  const savings = item.original_price ? calculateSavingsPercentage(item.original_price, item.current_price) : 0;

  const addToCompare = useCompareStore((s) => s.addProduct);
  const removeFromCompare = useCompareStore((s) => s.removeProduct);
  const isInCompare = useCompareStore((s) => s.isInCompare(product.id));
  const { addProduct: saveProduct, removeProduct: unsaveProduct, isSaved } = useSavedStore();
  const saved = isSaved(product.id);

  const toggleSaved = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (saved) {
      unsaveProduct(product.id);
    } else {
      saveProduct({
        id: product.id,
        title: name,
        price: item.current_price,
        originalPrice: item.original_price,
        imageUrl: image,
        store: storeName || '',
        url: item.product_url || '',
      });
    }
  };

  const toggleCompare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isInCompare) {
      removeFromCompare(product.id);
    } else {
      const added = addToCompare({
        id: product.id,
        name: name,
        slug: product.slug,
        image_url: image,
        brand: product.brand,
        category: product.category,
        product_stores: [{
          id: item.id,
          current_price: item.current_price,
          original_price: item.original_price,
          store_id: storeId,
          stores: { id: storeId, name: storeName },
        }],
      });
      if (!added) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };

  return (
    <Card onPress={() => router.push(`/(stack)/product/${product.slug}`)} style={{ flex: 1 }} padding="xs">
      <View
        style={{
          height: 130,
          backgroundColor: colors.secondaryBackground,
          borderRadius: radii.md,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <KeyedProductImage uri={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={32} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
        {savings > 0 && (
          <View style={[styles.savingsBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.savingsBadgeText}>-{savings}%</Text>
          </View>
        )}
        <View style={styles.cardActions}>
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggleSaved(); }}
            style={[styles.cardActionBtn, { backgroundColor: saved ? '#FEE2E2' : colors.background + 'E6' }]}
            hitSlop={4}
          >
            <Heart size={14} color={saved ? colors.systemRed : colors.secondaryLabel} fill={saved ? colors.systemRed : 'none'} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggleCompare(); }}
            style={[styles.cardActionBtn, { backgroundColor: isInCompare ? colors.primaryContainer : colors.background + 'E6' }]}
            hitSlop={4}
          >
            <BarChart3 size={14} color={isInCompare ? colors.primary : colors.secondaryLabel} strokeWidth={2} />
          </Pressable>
          {item.product_url && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); Linking.openURL(item.product_url); }}
              style={[styles.cardActionBtn, { backgroundColor: colors.background + 'E6' }]}
              hitSlop={4}
            >
              <ExternalLink size={14} color={colors.secondaryLabel} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={{ flex: 1, padding: spacing.sm, justifyContent: 'space-between' }}>
        <Text
          numberOfLines={2}
          style={[typography.footnote, { color: colors.label, lineHeight: 18, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
        >
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
          <Price price={item.current_price} originalPrice={item.original_price} size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {storeId && STORE_LOGOS[storeId] ? (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.secondaryBackground, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Image source={STORE_LOGOS[storeId]} style={{ width: 14, height: 14 }} contentFit="contain" />
              </View>
            ) : null}
            <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '500' }]}>{storeName}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  dealsHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  couponsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
  },
  savingsBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    gap: 4,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
