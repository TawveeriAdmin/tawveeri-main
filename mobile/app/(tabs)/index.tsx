/**
 * Home Screen
 *
 * HIG: Large titles for top-level screens.
 * Sections: Greeting → Search → Categories → Deals → Trending → Trust bar.
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
import * as Haptics from 'expo-haptics';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Zap,
  TrendingUp,
  Bell,
  Settings,
  Smartphone,
  Laptop,
  Headphones,
  Monitor,
  Gamepad2,
  Tablet,
  Package,
  ShieldCheck,
  Store as StoreIcon,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, SkeletonCard } from '@/src/components/ui';
import { calculateSavingsPercentage } from '@/src/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;
const DEAL_CARD_WIDTH = SCREEN_WIDTH * 0.72;
const ICON_CIRCLE_SIZE = 56;

// RTL is handled via useRTL() hook, not I18nManager

// ─── Static Data ─────────────────────────────────────────────

const CATEGORIES = [
  { key: 'smartphone', Icon: Smartphone, label_ar: 'هواتف', label_en: 'Phones', lightBg: '#EFF6FF', darkBg: '#172554', lightIcon: '#2563EB', darkIcon: '#60A5FA' },
  { key: 'laptop', Icon: Laptop, label_ar: 'لابتوب', label_en: 'Laptops', lightBg: '#EEF2FF', darkBg: '#1E1B4B', lightIcon: '#4F46E5', darkIcon: '#A5B4FC' },
  { key: 'audio', Icon: Headphones, label_ar: 'سماعات', label_en: 'Audio', lightBg: '#FAF5FF', darkBg: '#2E1065', lightIcon: '#9333EA', darkIcon: '#C084FC' },
  { key: 'tv', Icon: Monitor, label_ar: 'شاشات', label_en: 'TVs', lightBg: '#ECFDF5', darkBg: '#022C22', lightIcon: '#059669', darkIcon: '#34D399' },
  { key: 'gaming', Icon: Gamepad2, label_ar: 'ألعاب', label_en: 'Gaming', lightBg: '#FEF2F2', darkBg: '#450A0A', lightIcon: '#DC2626', darkIcon: '#F87171' },
  { key: 'tablet', Icon: Tablet, label_ar: 'تابلت', label_en: 'Tablets', lightBg: '#FFF7ED', darkBg: '#431407', lightIcon: '#EA580C', darkIcon: '#FB923C' },
];

const TRUSTED_STORES = [
  { name_ar: 'أمازون', name_en: 'Amazon' },
  { name_ar: 'نون', name_en: 'Noon' },
  { name_ar: 'جرير', name_en: 'Jarir' },
  { name_ar: 'اكسترا', name_en: 'Extra' },
  { name_ar: 'المنيع', name_en: 'Almanea' },
];

// ─── Helpers ─────────────────────────────────────────────────

function getGreeting(locale: string): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  if (locale === 'ar') {
    const greeting = hour >= 5 && hour < 12 ? 'صباح الخير' : 'مساء الخير';
    return { greeting, subtitle: 'اعثر على أفضل الأسعار' };
  }
  let greeting = 'Good evening';
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  return { greeting, subtitle: 'Find the best prices' };
}

// ─── Main Component ──────────────────────────────────────────

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const { user } = useAuth();
  const rtl = useRTL();
  const [refreshing, setRefreshing] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { greeting, subtitle } = getGreeting(locale);
  const firstName = user?.full_name?.split(' ')[0];

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, dealsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name_ar, name_en, slug, image_urls, brand, category, view_count, product_stores(id, current_price, original_price, store_id, stores(id, name_ar, name_en))')
          .eq('is_active', true)
          .order('view_count', { ascending: false })
          .limit(10),
        supabase
          .from('product_stores')
          .select('id, current_price, original_price, deal_expires_at, products(id, name_ar, name_en, slug, image_urls, brand), stores(id, name_ar, name_en)')
          .eq('is_deal', true)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setFeaturedProducts(productsRes.data || []);
      setDeals(dealsRes.data || []);
    } catch (err) {
      console.error('Home fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load personalized recommendations for authenticated users
  useEffect(() => {
    if (!user) { setRecommendations([]); return; }
    (async () => {
      try {
        const { data } = await supabase.rpc('get_recommendations', {
          p_user_id: user.id,
          p_product_id: null,
          p_type: 'auto',
          p_limit: 8,
        });
        if (data && data.length > 0) {
          const ids = data.map((r: any) => r.id);
          const { data: enriched } = await supabase
            .from('products')
            .select('id, name_ar, name_en, slug, image_urls, brand, category, view_count, product_stores(id, current_price, original_price, store_id, stores(id, name_ar, name_en))')
            .in('id', ids)
            .eq('is_active', true);
          setRecommendations(enriched || []);
        }
      } catch {
        // Silently fail — section just won't show
      }
    })();
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { flexDirection: rtl.row }]}>
          <View style={{ flex: 1, alignItems: rtl.alignStart }}>
            <Text style={[typography.title2, { color: colors.label, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginTop: 2, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {subtitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
              accessibilityLabel={locale === 'ar' ? 'الإعدادات' : 'Settings'}
            >
              <Settings size={20} color={colors.label} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(stack)/notifications')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
              accessibilityLabel={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
            >
              <Bell size={20} color={colors.label} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {/* ── Search Bar ── */}
        <Pressable
          onPress={() => router.push('/(tabs)/search')}
          style={({ pressed }) => [
            styles.searchBar,
            {
              backgroundColor: colors.secondaryBackground,
              marginHorizontal: spacing.md,
              borderWidth: 1,
              borderColor: pressed ? colors.primary : colors.separator,
              flexDirection: rtl.row,
            },
            pressed && { transform: [{ scale: 0.99 }] },
          ]}
          accessibilityRole="search"
        >
          <View style={[styles.searchIconCircle, { backgroundColor: colors.primary }]}>
            <Search size={16} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text
            style={[
              typography.body,
              { color: colors.tertiaryLabel, marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0, flex: 1, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection },
            ]}
          >
            {t('search.searchPlaceholder')}
          </Text>
        </Pressable>

        {/* ── Category Grid ── */}
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const bg = isDark ? cat.darkBg : cat.lightBg;
            const iconColor = isDark ? cat.darkIcon : cat.lightIcon;
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/(tabs)/search', params: { category: cat.key } });
                }}
                style={({ pressed }) => [
                  styles.categoryItem,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <View style={[styles.categoryCircle, { backgroundColor: bg }]}>
                  <cat.Icon size={24} color={iconColor} strokeWidth={1.8} />
                </View>
                <Text
                  style={[
                    typography.caption1,
                    { color: colors.label, fontWeight: '500', marginTop: spacing.xs },
                  ]}
                >
                  {locale === 'ar' ? cat.label_ar : cat.label_en}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Deals ── */}
        {deals.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'عروض اليوم' : "Today's Deals"}
              icon={<Zap size={18} color={colors.deal} />}
              onSeeAll={() => router.push('/(tabs)/deals')}
              colors={colors}
              rtl={rtl}
            />
            <FlatList
              data={deals}
              renderItem={({ item }) => (
                <DealCard item={item} locale={locale} colors={colors} rtl={rtl} />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
              snapToInterval={DEAL_CARD_WIDTH + spacing.md}
              decelerationRate="fast"
            />
          </>
        )}

        {/* ── Trending ── */}
        <SectionHeader
          title={locale === 'ar' ? 'الأكثر مشاهدة' : 'Trending'}
          icon={<TrendingUp size={18} color={colors.primary} />}
          onSeeAll={() => router.push('/(tabs)/search')}
          colors={colors}
          rtl={rtl}
        />
        {loading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
          >
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} style={{ width: PRODUCT_CARD_WIDTH }} />
            ))}
          </ScrollView>
        ) : (
          <FlatList
            data={featuredProducts}
            renderItem={({ item }) => (
              <ProductCard item={item} locale={locale} colors={colors} rtl={rtl} />
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
          />
        )}

        {/* ── Recommended For You ── */}
        {user && recommendations.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'مقترحات لك' : 'Recommended For You'}
              icon={<Sparkles size={18} color={colors.tertiary} />}
              onSeeAll={() => router.push('/(tabs)/search')}
              colors={colors}
              rtl={rtl}
            />
            <FlatList
              data={recommendations}
              renderItem={({ item }) => (
                <ProductCard item={item} locale={locale} colors={colors} rtl={rtl} />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
            />
          </>
        )}

        {/* ── Trust Bar ── */}
        <TrustBar locale={locale} colors={colors} isDark={isDark} rtl={rtl} />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  onSeeAll,
  colors,
  rtl,
}: {
  title: string;
  icon: React.ReactNode;
  onSeeAll: () => void;
  colors: any;
  rtl: ReturnType<typeof useRTL>;
}) {
  const ChevronIcon = rtl.isRTL ? ChevronLeft : ChevronRight;
  return (
    <View style={[styles.sectionHeader, { flexDirection: rtl.row }]}>
      <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
        {icon}
        <Text style={[typography.title3, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {title}
        </Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        hitSlop={8}
        style={{ flexDirection: rtl.row, alignItems: 'center' }}
      >
        <Text style={[typography.subheadline, { color: colors.primary, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {rtl.isRTL ? 'عرض الكل' : 'See All'}
        </Text>
        <ChevronIcon size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function DealCard({
  item,
  locale,
  colors,
  rtl,
}: {
  item: any;
  locale: string;
  colors: any;
  rtl: ReturnType<typeof useRTL>;
}) {
  const product = item.products;
  if (!product) return null;

  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const storeName = locale === 'ar' ? item.stores?.name_ar : item.stores?.name_en;
  const image = product.image_urls?.[0];
  const savings = calculateSavingsPercentage(item.original_price, item.current_price);

  return (
    <Card
      onPress={() => router.push(`/(stack)/product/${product.slug}`)}
      style={{ width: DEAL_CARD_WIDTH }}
      padding="xs"
    >
      <View
        style={{
          height: 160,
          backgroundColor: colors.secondaryBackground,
          borderRadius: radii.md,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={40} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
        {savings > 0 && (
          <View style={[styles.savingsBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.savingsBadgeText}>-{savings}%</Text>
          </View>
        )}
      </View>
      <View style={{ padding: spacing.sm }}>
        <Text
          numberOfLines={2}
          style={[typography.subheadline, { color: colors.label, fontWeight: '500', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
        >
          {name}
        </Text>
        {storeName && (
          <View style={{ flexDirection: rtl.row, alignItems: 'center', marginTop: 4, gap: 4 }}>
            <StoreIcon size={12} color={colors.secondaryLabel} strokeWidth={1.5} />
            <Text style={[typography.caption1, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {storeName}
            </Text>
          </View>
        )}
        <View style={{ marginTop: spacing.sm }}>
          <Price price={item.current_price} originalPrice={item.original_price} size="sm" />
        </View>
      </View>
    </Card>
  );
}

function ProductCard({
  item,
  locale,
  colors,
  rtl,
}: {
  item: any;
  locale: string;
  colors: any;
  rtl: ReturnType<typeof useRTL>;
}) {
  const name = locale === 'ar' ? item.name_ar : item.name_en;
  const image = item.image_urls?.[0];
  const stores = item.product_stores || [];
  const bestPrice = stores
    .map((ps: any) => ps.current_price)
    .filter(Boolean)
    .sort((a: number, b: number) => a - b)[0];
  const originalPrice = stores.map((ps: any) => ps.original_price).filter(Boolean)[0];
  const storeCount = stores.length;

  return (
    <Card
      onPress={() => router.push(`/(stack)/product/${item.slug}`)}
      style={{ width: PRODUCT_CARD_WIDTH }}
      padding="xs"
    >
      <View
        style={{
          height: 140,
          backgroundColor: colors.secondaryBackground,
          borderRadius: radii.md,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={36} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
      </View>
      <View style={{ padding: spacing.sm }}>
        <Text numberOfLines={2} style={[typography.subheadline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {name}
        </Text>
        <View style={{ flexDirection: rtl.row, alignItems: 'center', marginTop: 4, gap: 6 }}>
          {item.brand && (
            <Text style={[typography.caption1, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {item.brand}
            </Text>
          )}
          {storeCount > 0 && (
            <View style={[styles.storeCountPill, { backgroundColor: colors.primaryContainer }]}>
              <Text
                style={[
                  typography.caption2,
                  { color: colors.onPrimaryContainer, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection },
                ]}
              >
                {storeCount}{' '}
                {locale === 'ar'
                  ? storeCount > 1
                    ? 'متاجر'
                    : 'متجر'
                  : storeCount > 1
                    ? 'stores'
                    : 'store'}
              </Text>
            </View>
          )}
        </View>
        {bestPrice && (
          <View style={{ marginTop: spacing.xs }}>
            <Price price={bestPrice} originalPrice={originalPrice} size="sm" />
          </View>
        )}
      </View>
    </Card>
  );
}

function TrustBar({
  locale,
  colors,
  isDark,
  rtl,
}: {
  locale: string;
  colors: any;
  isDark: boolean;
  rtl: ReturnType<typeof useRTL>;
}) {
  return (
    <View
      style={[
        styles.trustBar,
        { backgroundColor: colors.secondaryBackground, marginHorizontal: spacing.md },
      ]}
    >
      <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm }}>
        <View
          style={[
            styles.trustIconCircle,
            { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' },
          ]}
        >
          <ShieldCheck size={18} color={isDark ? '#34D399' : '#059669'} strokeWidth={2} />
        </View>
        <Text
          style={[
            typography.subheadline,
            { color: colors.label, fontWeight: '600', flex: 1, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection },
          ]}
        >
          {locale === 'ar'
            ? 'نقارن الأسعار من أفضل المتاجر'
            : 'Comparing prices from top stores'}
        </Text>
      </View>
      <View style={styles.storeChips}>
        {TRUSTED_STORES.map((store, i) => (
          <View key={i} style={[styles.storeChip, { backgroundColor: colors.tertiaryFill }]}>
            <Text
              style={[typography.caption1, { color: colors.secondaryLabel, fontWeight: '500', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
            >
              {locale === 'ar' ? store.name_ar : store.name_en}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    alignItems: 'center',
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  searchIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  categoryItem: {
    width: '33.33%' as any,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  categoryCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  storeCountPill: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  trustBar: {
    marginTop: spacing.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radii.lg,
  },
  trustIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  storeChip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
