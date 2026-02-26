/**
 * Deals Screen - Active deals listing
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, RefreshControl, Dimensions, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, Ticket } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, Badge, EmptyState, SkeletonCard } from '@/src/components/ui';
import { calculateSavingsPercentage } from '@/src/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

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
        .select('id, current_price, original_price, deal_expires_at, products(id, name_ar, name_en, slug, image_urls, brand, category), stores(id, name_ar, name_en)')
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

  const renderDeal = useCallback(({ item }: { item: any }) => {
    const product = item.products;
    if (!product) return null;
    const name = locale === 'ar' ? product.name_ar : product.name_en;
    const store = locale === 'ar' ? item.stores?.name_ar : item.stores?.name_en;
    const image = product.image_urls?.[0];
    const savings = item.original_price ? calculateSavingsPercentage(item.original_price, item.current_price) : 0;

    return (
      <Card
        onPress={() => router.push(`/(stack)/product/${product.slug}`)}
        style={{ flex: 1, margin: spacing.sm / 2 }}
        padding="xs"
      >
        {savings > 0 && (
          <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, zIndex: 1 }}>
            <Badge text={`-${savings}%`} color="error" />
          </View>
        )}
        <View style={{ height: 130, backgroundColor: colors.secondaryBackground, borderRadius: radii.md, overflow: 'hidden' }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={32} color={colors.deal} />
            </View>
          )}
        </View>
        <View style={{ padding: spacing.sm }}>
          <Text numberOfLines={2} style={[typography.footnote, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>{name}</Text>
          {store && (
            <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 2, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>{store}</Text>
          )}
          <View style={{ marginTop: spacing.xs }}>
            <Price price={item.current_price} originalPrice={item.original_price} size="sm" />
          </View>
        </View>
      </Card>
    );
  }, [locale, colors, rtl]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: rtl.row, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm }}>
        <Zap size={24} color={colors.deal} />
        <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', flex: 1, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {locale === 'ar' ? 'العروض' : 'Deals'}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(stack)/coupons');
          }}
          accessibilityRole="button"
          accessibilityLabel={locale === 'ar' ? 'عرض الكوبونات' : 'View coupons'}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.tertiary + '15',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 20,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ticket size={14} color={colors.tertiary} />
          <Text style={[typography.footnote, { color: colors.tertiary, fontWeight: '600' }]}>
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

        />
      )}
    </SafeAreaView>
  );
}
