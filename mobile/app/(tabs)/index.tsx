/**
 * Home Screen
 *
 * HIG: Use large titles for top-level screens.
 * Content: Search bar, category chips, featured products, deals strip, top stores.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, ChevronLeft, Zap, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale, useLocalizedField } from '@/src/lib/i18n/provider';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Card, Price, Skeleton, SkeletonCard } from '@/src/components/ui';
import { formatCompactNumber } from '@/src/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

// Category chips
const CATEGORIES = [
  { key: 'smartphone', icon: '📱', label_ar: 'هواتف', label_en: 'Phones' },
  { key: 'laptop', icon: '💻', label_ar: 'لابتوب', label_en: 'Laptops' },
  { key: 'audio', icon: '🎧', label_ar: 'سماعات', label_en: 'Audio' },
  { key: 'tv', icon: '📺', label_ar: 'شاشات', label_en: 'TVs' },
  { key: 'gaming', icon: '🎮', label_ar: 'ألعاب', label_en: 'Gaming' },
  { key: 'tablet', icon: '📲', label_ar: 'تابلت', label_en: 'Tablets' },
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const [refreshing, setRefreshing] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Featured products (most viewed)
      const { data: products } = await supabase
        .from('products')
        .select('id, name_ar, name_en, slug, image_urls, brand, category, view_count, product_stores(id, current_price, original_price, store_id, stores(id, name_ar, name_en))')
        .eq('is_active', true)
        .order('view_count', { ascending: false })
        .limit(10);

      // Deals
      const { data: dealProducts } = await supabase
        .from('product_stores')
        .select('id, current_price, original_price, deal_expires_at, products(id, name_ar, name_en, slug, image_urls, brand), stores(id, name_ar, name_en)')
        .eq('is_deal', true)
        .order('created_at', { ascending: false })
        .limit(10);

      setFeaturedProducts(products || []);
      setDeals(dealProducts || []);
    } catch (err) {
      console.error('Home fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderProductCard = useCallback(({ item }: { item: any }) => {
    const name = locale === 'ar' ? item.name_ar : item.name_en;
    const image = item.image_urls?.[0];
    const bestPrice = item.product_stores
      ?.map((ps: any) => ps.current_price)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b)[0];
    const originalPrice = item.product_stores
      ?.map((ps: any) => ps.original_price)
      .filter(Boolean)[0];

    return (
      <Card
        onPress={() => router.push(`/(stack)/product/${item.slug}`)}
        style={{ width: PRODUCT_CARD_WIDTH, marginEnd: spacing.md }}
        padding="xs"
      >
        <View style={{ height: 140, backgroundColor: colors.secondaryBackground, borderRadius: radii.md, overflow: 'hidden' }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.tertiaryLabel, fontSize: 40 }}>📦</Text>
            </View>
          )}
        </View>
        <View style={{ padding: spacing.sm }}>
          <Text
            numberOfLines={2}
            style={[typography.subheadline, { color: colors.label }]}
          >
            {name}
          </Text>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
            {item.brand}
          </Text>
          {bestPrice && (
            <View style={{ marginTop: spacing.xs }}>
              <Price price={bestPrice} originalPrice={originalPrice} size="sm" />
            </View>
          )}
        </View>
      </Card>
    );
  }, [locale, colors]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Search Bar */}
        <Pressable
          onPress={() => router.push('/(tabs)/search')}
          style={[styles.searchBar, { backgroundColor: colors.tertiaryFill, borderRadius: radii.md, marginHorizontal: spacing.md, marginTop: spacing.md }]}
          accessibilityRole="search"
        >
          <Search size={20} color={colors.tertiaryLabel} />
          <Text style={[typography.body, { color: colors.tertiaryLabel, marginStart: spacing.sm, flex: 1 }]}>
            {t('search.placeholder')}
          </Text>
        </Pressable>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: cat.key } })}
              style={({ pressed }) => [
                styles.categoryChip,
                { backgroundColor: pressed ? colors.secondaryFill : colors.secondaryBackground, borderRadius: radii.full },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
              <Text style={[typography.footnote, { color: colors.label, fontWeight: '500', marginStart: spacing.xs }]}>
                {locale === 'ar' ? cat.label_ar : cat.label_en}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Featured Products */}
        <SectionHeader
          title={locale === 'ar' ? 'الأكثر مشاهدة' : 'Trending'}
          icon={<TrendingUp size={18} color={colors.primary} />}
          onSeeAll={() => router.push('/(tabs)/search')}
          colors={colors}
          locale={locale}
        />
        {loading ? (
          <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} style={{ width: PRODUCT_CARD_WIDTH }} />)}
          </ScrollView>
        ) : (
          <FlatList
            data={featuredProducts}
            renderItem={renderProductCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md }}
          />
        )}

        {/* Deals Strip */}
        {deals.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'عروض اليوم' : "Today's Deals"}
              icon={<Zap size={18} color={colors.deal} />}
              onSeeAll={() => router.push('/(tabs)/deals')}
              colors={colors}
              locale={locale}
            />
            <FlatList
              data={deals}
              renderItem={({ item }) => {
                const product = item.products;
                if (!product) return null;
                const name = locale === 'ar' ? product.name_ar : product.name_en;
                const image = product.image_urls?.[0];
                return (
                  <Card
                    onPress={() => router.push(`/(stack)/product/${product.slug}`)}
                    style={{ width: PRODUCT_CARD_WIDTH, marginEnd: spacing.md }}
                    padding="xs"
                  >
                    <View style={{ height: 120, backgroundColor: colors.dealContainer, borderRadius: radii.md, overflow: 'hidden' }}>
                      {image && <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="contain" />}
                    </View>
                    <View style={{ padding: spacing.sm }}>
                      <Text numberOfLines={2} style={[typography.footnote, { color: colors.label }]}>{name}</Text>
                      <Price price={item.current_price} originalPrice={item.original_price} size="sm" />
                    </View>
                  </Card>
                );
              }}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
            />
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, icon, onSeeAll, colors, locale }: {
  title: string; icon: React.ReactNode; onSeeAll: () => void; colors: any; locale: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {icon}
        <Text style={[typography.title3, { color: colors.label, fontWeight: '600' }]}>{title}</Text>
      </View>
      <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[typography.subheadline, { color: colors.primary }]}>
          {locale === 'ar' ? 'عرض الكل' : 'See All'}
        </Text>
        {locale === 'ar' ? <ChevronLeft size={16} color={colors.primary} /> : <ChevronRight size={16} color={colors.primary} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
