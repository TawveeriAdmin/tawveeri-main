/**
 * Home Screen — Redesigned
 *
 * Rich, content-dense home page for a price comparison app.
 * Sections: Header → Search → Categories → Deals → Savings → Trending → Stores → Coupons → Recommendations.
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
  Heart,
  Smartphone,
  Laptop,
  Headphones,
  Monitor,
  Gamepad2,
  Tablet,
  Package,
  Sparkles,
  Flame,
  Ticket,
  Store as StoreIcon,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, Badge, SkeletonCard, Skeleton } from '@/src/components/ui';
import { calculateSavingsPercentage } from '@/src/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEAL_CARD_WIDTH = SCREEN_WIDTH * 0.72;
const PRODUCT_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;
const SMALL_CARD_WIDTH = SCREEN_WIDTH * 0.38;
const STORE_CARD_WIDTH = 100;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// ─── Static Data ─────────────────────────────────────────────

const CATEGORIES = [
  { key: 'smartphone', Icon: Smartphone, label_ar: 'هواتف', label_en: 'Phones', lightBg: '#EFF6FF', darkBg: '#172554', lightIcon: '#2563EB', darkIcon: '#60A5FA' },
  { key: 'laptop', Icon: Laptop, label_ar: 'لابتوب', label_en: 'Laptops', lightBg: '#EEF2FF', darkBg: '#1E1B4B', lightIcon: '#4F46E5', darkIcon: '#A5B4FC' },
  { key: 'audio', Icon: Headphones, label_ar: 'سماعات', label_en: 'Audio', lightBg: '#FAF5FF', darkBg: '#2E1065', lightIcon: '#9333EA', darkIcon: '#C084FC' },
  { key: 'tv', Icon: Monitor, label_ar: 'شاشات', label_en: 'TVs', lightBg: '#ECFDF5', darkBg: '#022C22', lightIcon: '#059669', darkIcon: '#34D399' },
  { key: 'gaming', Icon: Gamepad2, label_ar: 'ألعاب', label_en: 'Gaming', lightBg: '#FEF2F2', darkBg: '#450A0A', lightIcon: '#DC2626', darkIcon: '#F87171' },
  { key: 'tablet', Icon: Tablet, label_ar: 'تابلت', label_en: 'Tablets', lightBg: '#FFF7ED', darkBg: '#431407', lightIcon: '#EA580C', darkIcon: '#FB923C' },
];

const STORE_BRAND_COLORS: Record<string, { color: string; lightBg: string; darkBg: string }> = {
  amazon: { color: '#FF9900', lightBg: '#FFF7ED', darkBg: '#431407' },
  noon: { color: '#FEEE00', lightBg: '#FEFCE8', darkBg: '#422006' },
  jarir: { color: '#003DA5', lightBg: '#EFF6FF', darkBg: '#172554' },
  extra: { color: '#E41B23', lightBg: '#FEF2F2', darkBg: '#450A0A' },
  almanea: { color: '#1A7D35', lightBg: '#ECFDF5', darkBg: '#022C22' },
};

function getStoreBrandKey(nameEn: string): string | null {
  const lower = nameEn?.toLowerCase() || '';
  for (const key of Object.keys(STORE_BRAND_COLORS)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

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
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [biggestSavings, setBiggestSavings] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [couponsCount, setCouponsCount] = useState(0);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { greeting, subtitle } = getGreeting(locale);
  const firstName = user?.full_name?.split(' ')[0];

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, dealsRes, storesRes, couponsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name_ar, name_en, slug, image_urls, brand, category, view_count, product_stores(id, current_price, original_price, store_id, stores(id, name_ar, name_en))')
          .eq('is_active', true)
          .order('view_count', { ascending: false })
          .limit(12),
        supabase
          .from('product_stores')
          .select('id, current_price, original_price, deal_expires_at, products(id, name_ar, name_en, slug, image_urls, brand), stores(id, name_ar, name_en)')
          .eq('is_deal', true)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('stores')
          .select('id, name_ar, name_en, slug, logo_url')
          .order('name'),
        supabase
          .from('coupons')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ]);

      setTrendingProducts(productsRes.data || []);
      const allDeals = dealsRes.data || [];
      setDeals(allDeals.slice(0, 10));

      // Compute biggest savings from deals
      const sorted = [...allDeals]
        .filter((d) => d.original_price && d.original_price > d.current_price)
        .sort((a, b) => {
          const savA = (a.original_price - a.current_price) / a.original_price;
          const savB = (b.original_price - b.current_price) / b.original_price;
          return savB - savA;
        })
        .slice(0, 6);
      setBiggestSavings(sorted);

      setStores(storesRes.data || []);
      setCouponsCount(couponsRes.count || 0);
    } catch (err) {
      console.error('Home fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Personalized recommendations
  useEffect(() => {
    if (!user) {
      setRecommendations([]);
      return;
    }
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
        // Silently fail
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
            <Text
              style={[
                typography.title2,
                {
                  color: colors.label,
                  fontWeight: '700',
                  textAlign: rtl.textAlign,
                  writingDirection: rtl.writingDirection,
                },
              ]}
            >
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text
              style={[
                typography.subheadline,
                {
                  color: colors.secondaryLabel,
                  marginTop: 2,
                  textAlign: rtl.textAlign,
                  writingDirection: rtl.writingDirection,
                },
              ]}
            >
              {subtitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/(stack)/settings')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Settings size={20} color={colors.label} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(stack)/wishlist')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Heart size={20} color={colors.label} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(stack)/notifications')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
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
              {
                color: colors.tertiaryLabel,
                marginLeft: rtl.isRTL ? 0 : spacing.sm,
                marginRight: rtl.isRTL ? spacing.sm : 0,
                flex: 1,
                textAlign: rtl.textAlign,
                writingDirection: rtl.writingDirection,
              },
            ]}
          >
            {t('search.searchPlaceholder')}
          </Text>
        </Pressable>

        {/* ── Category Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipRow}
        >
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
                  styles.categoryChip,
                  { backgroundColor: bg, flexDirection: rtl.row },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <cat.Icon size={16} color={iconColor} strokeWidth={2} />
                <Text
                  style={[
                    typography.footnote,
                    {
                      color: iconColor,
                      fontWeight: '600',
                      marginLeft: rtl.isRTL ? 0 : 6,
                      marginRight: rtl.isRTL ? 6 : 0,
                    },
                  ]}
                >
                  {locale === 'ar' ? cat.label_ar : cat.label_en}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Hot Deals ── */}
        {deals.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'عروض اليوم' : 'Hot Deals'}
              icon={<Zap size={18} color={colors.deal} />}
              onSeeAll={() => router.push('/(tabs)/deals')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            <FlatList
              data={deals}
              renderItem={({ item }) => (
                <DealCard item={item} locale={locale} colors={colors} rtl={rtl} isDark={isDark} />
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

        {/* ── Biggest Savings ── */}
        {biggestSavings.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'أكبر التخفيضات' : 'Biggest Savings'}
              icon={<Flame size={18} color={colors.error} />}
              onSeeAll={() => router.push('/(tabs)/deals')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            <View style={styles.savingsGrid}>
              {biggestSavings.slice(0, 4).map((item) => (
                <SavingsCard key={item.id} item={item} locale={locale} colors={colors} rtl={rtl} />
              ))}
            </View>
          </>
        )}

        {/* ── Trending ── */}
        {(loading || trendingProducts.length > 0) && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'الأكثر مشاهدة' : 'Trending Now'}
              icon={<TrendingUp size={18} color={colors.primary} />}
              onSeeAll={() => router.push('/(tabs)/search')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            {loading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
              >
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} style={{ width: SMALL_CARD_WIDTH }} />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={trendingProducts}
                renderItem={({ item }) => (
                  <ProductCard item={item} locale={locale} colors={colors} rtl={rtl} />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
              />
            )}
          </>
        )}

        {/* ── Browse by Store ── */}
        {stores.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'تصفح المتاجر' : 'Browse by Store'}
              icon={<StoreIcon size={18} color={colors.secondary} />}
              onSeeAll={() => router.push('/(stack)/stores')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
            >
              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  locale={locale}
                  colors={colors}
                  isDark={isDark}
                  rtl={rtl}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Coupons Banner ── */}
        {couponsCount > 0 && (
          <Pressable
            onPress={() => router.push('/(stack)/coupons')}
            style={({ pressed }) => [
              styles.couponsBanner,
              {
                backgroundColor: isDark ? colors.tertiaryContainer : colors.tertiaryContainer,
                marginHorizontal: spacing.md,
                flexDirection: rtl.row,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={[styles.couponIconCircle, { backgroundColor: colors.tertiary }]}>
              <Ticket size={18} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View
              style={{
                flex: 1,
                marginLeft: rtl.isRTL ? 0 : spacing.md,
                marginRight: rtl.isRTL ? spacing.md : 0,
              }}
            >
              <Text
                style={[
                  typography.headline,
                  {
                    color: colors.onTertiaryContainer,
                    textAlign: rtl.textAlign,
                    writingDirection: rtl.writingDirection,
                  },
                ]}
              >
                {locale === 'ar'
                  ? `${couponsCount} كوبون متاح`
                  : `${couponsCount} Coupon${couponsCount > 1 ? 's' : ''} Available`}
              </Text>
              <Text
                style={[
                  typography.caption1,
                  {
                    color: colors.onTertiaryContainer,
                    opacity: 0.7,
                    marginTop: 2,
                    textAlign: rtl.textAlign,
                    writingDirection: rtl.writingDirection,
                  },
                ]}
              >
                {locale === 'ar' ? 'وفّر أكثر مع أكواد الخصم' : 'Save more with discount codes'}
              </Text>
            </View>
            {rtl.isRTL ? (
              <ArrowLeft size={20} color={colors.onTertiaryContainer} />
            ) : (
              <ArrowRight size={20} color={colors.onTertiaryContainer} />
            )}
          </Pressable>
        )}

        {/* ── Recommended For You ── */}
        {user && recommendations.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'مقترحات لك' : 'For You'}
              icon={<Sparkles size={18} color={colors.tertiary} />}
              onSeeAll={() => router.push('/(tabs)/search')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            <FlatList
              data={recommendations}
              renderItem={({ item }) => (
                <ProductCard item={item} locale={locale} colors={colors} rtl={rtl} />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
            />
          </>
        )}

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
  locale,
}: {
  title: string;
  icon: React.ReactNode;
  onSeeAll: () => void;
  colors: any;
  rtl: ReturnType<typeof useRTL>;
  locale: string;
}) {
  const ChevronIcon = rtl.isRTL ? ChevronLeft : ChevronRight;
  return (
    <View style={[styles.sectionHeader, { flexDirection: rtl.row }]}>
      <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
        {icon}
        <Text
          style={[
            typography.title3,
            {
              color: colors.label,
              fontWeight: '600',
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {title}
        </Text>
      </View>
      <Pressable
        onPress={onSeeAll}
        hitSlop={8}
        style={{ flexDirection: rtl.row, alignItems: 'center' }}
      >
        <Text
          style={[
            typography.subheadline,
            {
              color: colors.primary,
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {locale === 'ar' ? 'عرض الكل' : 'See All'}
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
  isDark,
}: {
  item: any;
  locale: string;
  colors: any;
  rtl: ReturnType<typeof useRTL>;
  isDark: boolean;
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
      <View style={styles.dealImageContainer}>
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
          style={[
            typography.subheadline,
            {
              color: colors.label,
              fontWeight: '500',
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {name}
        </Text>
        {storeName && (
          <View style={{ flexDirection: rtl.row, alignItems: 'center', marginTop: 4, gap: 4 }}>
            <StoreIcon size={12} color={colors.secondaryLabel} strokeWidth={1.5} />
            <Text
              style={[
                typography.caption1,
                {
                  color: colors.secondaryLabel,
                  textAlign: rtl.textAlign,
                  writingDirection: rtl.writingDirection,
                },
              ]}
            >
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

function SavingsCard({
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
      style={styles.savingsCardContainer}
      padding="xs"
    >
      <View style={styles.savingsImageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={28} color={colors.tertiaryLabel} strokeWidth={1.2} />
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
          style={[
            typography.footnote,
            {
              color: colors.label,
              fontWeight: '500',
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {name}
        </Text>
        {storeName && (
          <Text
            style={[
              typography.caption2,
              {
                color: colors.secondaryLabel,
                marginTop: 2,
                textAlign: rtl.textAlign,
                writingDirection: rtl.writingDirection,
              },
            ]}
          >
            {storeName}
          </Text>
        )}
        <View style={{ marginTop: spacing.xs }}>
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
      style={{ width: SMALL_CARD_WIDTH }}
      padding="xs"
    >
      <View style={styles.productImageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={32} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
      </View>
      <View style={{ padding: spacing.sm }}>
        <Text
          numberOfLines={2}
          style={[
            typography.footnote,
            {
              color: colors.label,
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {name}
        </Text>
        {storeCount > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text
              style={[
                typography.caption2,
                {
                  color: colors.primary,
                  fontWeight: '600',
                  textAlign: rtl.textAlign,
                  writingDirection: rtl.writingDirection,
                },
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
        {bestPrice && (
          <View style={{ marginTop: spacing.xs }}>
            <Price price={bestPrice} originalPrice={originalPrice} size="sm" />
          </View>
        )}
      </View>
    </Card>
  );
}

function StoreCard({
  store,
  locale,
  colors,
  isDark,
  rtl,
}: {
  store: any;
  locale: string;
  colors: any;
  isDark: boolean;
  rtl: ReturnType<typeof useRTL>;
}) {
  const storeName = locale === 'ar' ? store.name_ar : store.name_en;
  const brandKey = getStoreBrandKey(store.name_en || store.name || '');
  const brand = brandKey ? STORE_BRAND_COLORS[brandKey] : null;
  const bg = brand ? (isDark ? brand.darkBg : brand.lightBg) : colors.secondaryBackground;
  const logoUrl = brandKey ? `${API_BASE_URL}/logos/${brandKey}.png` : store.logo_url;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (store.slug) {
          router.push(`/(stack)/store/${store.slug}`);
        } else {
          router.push('/(stack)/stores');
        }
      }}
      style={({ pressed }) => [
        styles.storeCard,
        { backgroundColor: bg },
        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
      ]}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={styles.storeLogo}
          contentFit="contain"
        />
      ) : (
        <View
          style={[
            styles.storeInitial,
            { backgroundColor: brand?.color || colors.primary },
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
            {(storeName || '?')[0]}
          </Text>
        </View>
      )}
      <Text
        style={[
          typography.caption1,
          {
            color: colors.label,
            fontWeight: '600',
            marginTop: spacing.sm,
            textAlign: 'center',
          },
        ]}
        numberOfLines={1}
      >
        {storeName}
      </Text>
    </Pressable>
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
  categoryChipRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  categoryChip: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dealImageContainer: {
    height: 160,
    borderRadius: radii.md,
    overflow: 'hidden',
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
  savingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  savingsCardContainer: {
    width: PRODUCT_CARD_WIDTH,
  },
  savingsImageContainer: {
    height: 120,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 120,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  storeCard: {
    width: STORE_CARD_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
  },
  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
  },
  storeInitial: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponsBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  couponIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
