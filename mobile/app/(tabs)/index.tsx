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
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Zap,
  TrendingUp,
  Bell,
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
  LayoutGrid,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase/client';
import { useNetwork } from '@/src/lib/network/use-network';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, SkeletonCard, Skeleton, KeyedProductImage, SARSymbol } from '@/src/components/ui';
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
  const { isConnected } = useNetwork();

  const [refreshing, setRefreshing] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [biggestSavings, setBiggestSavings] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [couponsCount, setCouponsCount] = useState(0);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [featuredDeal, setFeaturedDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { greeting, subtitle } = getGreeting(locale);
  const firstName = user?.full_name?.split(' ')[0];
  const HOME_CACHE_KEY = 'tawveeri_home_cache';

  const fetchData = useCallback(async () => {
    // If offline, load from cache
    if (!isConnected) {
      try {
        const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (cached) {
          const c = JSON.parse(cached);
          setTrendingProducts(c.trending || []);
          setDeals(c.deals || []);
          setBiggestSavings(c.savings || []);
          setStores(c.storesList || []);
          setCouponsCount(c.cCount || 0);
          if (c.savings?.length > 0) setFeaturedDeal(c.savings[0]);
        }
      } catch {}
      setLoading(false);
      return;
    }

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

      const trending = productsRes.data || [];
      const allDeals = dealsRes.data || [];
      const dealsSlice = allDeals.slice(0, 10);
      const sorted = [...allDeals]
        .filter((d) => d.original_price && d.original_price > d.current_price)
        .sort((a, b) => {
          const savA = (a.original_price - a.current_price) / a.original_price;
          const savB = (b.original_price - b.current_price) / b.original_price;
          return savB - savA;
        })
        .slice(0, 6);
      const storesList = storesRes.data || [];
      const cCount = couponsRes.count || 0;

      setTrendingProducts(trending);
      setDeals(dealsSlice);
      setBiggestSavings(sorted);
      setStores(storesList);
      setCouponsCount(cCount);
      if (sorted.length > 0) setFeaturedDeal(sorted[0]);

      // Cache for offline
      AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
        trending, deals: dealsSlice, savings: sorted, storesList, cCount,
      })).catch(() => {});
    } catch (err) {
      console.error('Home fetch error:', err);
      // Try cache on error
      try {
        const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (cached) {
          const c = JSON.parse(cached);
          setTrendingProducts(c.trending || []);
          setDeals(c.deals || []);
          setBiggestSavings(c.savings || []);
          setStores(c.storesList || []);
          setCouponsCount(c.cCount || 0);
          if (c.savings?.length > 0) setFeaturedDeal(c.savings[0]);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

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
      {/* Background glows (mock) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={[
            styles.glowCircle,
            {
              top: -80,
              left: -SCREEN_WIDTH * 0.3,
              width: SCREEN_WIDTH * 0.9,
              height: 220,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(13, 71, 161, 0.04)',
            },
          ]}
        />
        <View
          style={[
            styles.glowCircle,
            {
              bottom: 80,
              right: -SCREEN_WIDTH * 0.3,
              width: SCREEN_WIDTH * 0.9,
              height: 220,
              backgroundColor: isDark ? 'rgba(168, 85, 247, 0.04)' : 'rgba(79, 70, 229, 0.03)',
            },
          ]}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header (mock: greeting, subtitle, Bell + Avatar) ── */}
        <View style={[styles.headerWrap, { paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md }]}>
          <View style={[styles.headerRow, { flexDirection: rtl.row }]}>
            <View style={{ flex: 1, alignItems: rtl.alignStart }}>
              <Text
                style={[
                  typography.largeTitle,
                  {
                    color: colors.label,
                    fontWeight: '700',
                    fontSize: 28,
                    textAlign: rtl.textAlign,
                    writingDirection: rtl.writingDirection,
                  },
                ]}
              >
                {locale === 'ar' ? 'توفيري' : 'Tawveeri'}
              </Text>
              <Text
                style={[
                  typography.footnote,
                  {
                    color: colors.secondaryLabel,
                    marginTop: spacing.xs,
                    textAlign: rtl.textAlign,
                    writingDirection: rtl.writingDirection,
                  },
                ]}
              >
                {subtitle}
              </Text>
            </View>
            <View style={{ flexDirection: rtl.row, gap: spacing.sm }}>
              <Pressable
                onPress={() => router.push('/(stack)/wishlist')}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
              >
                <Heart size={20} color={colors.label} strokeWidth={1.8} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/(stack)/notifications')}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator },
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
              >
                <Bell size={20} color={colors.label} strokeWidth={1.8} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Category Chips: no left/right padding so selector is full-bleed ── */}
        <View style={[styles.sectionHeader, { flexDirection: rtl.row, paddingHorizontal: spacing.md, paddingTop: 0, paddingBottom: spacing.sm }]}>
          <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
            <View style={styles.sectionIconBadge}>
              <LayoutGrid size={16} color={colors.primary} strokeWidth={2} />
            </View>
            <Text
              style={[
                typography.title3,
                {
                  color: colors.label,
                  fontWeight: '700',
                  textAlign: rtl.textAlign,
                  writingDirection: rtl.writingDirection,
                },
              ]}
            >
              {locale === 'ar' ? 'الفئات' : 'Categories'}
            </Text>
          </View>
        </View>
        <View style={styles.categoryChipSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipRow}
          >
            {CATEGORIES.map((cat) => {
              const iconColor = isDark ? cat.darkIcon : cat.lightIcon;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/(tabs)/search', params: { category: cat.key } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={rtl.isRTL ? cat.label_ar : cat.label_en}
                  style={({ pressed }) => [
                    styles.categoryChipMock,
                    {
                      backgroundColor: colors.secondaryGroupedBackground,
                      borderColor: colors.separator,
                      flexDirection: rtl.row,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={[styles.categoryChipIconBox, { backgroundColor: colors.tertiaryBackground }]}>
                    <cat.Icon size={18} color={iconColor} strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      typography.footnote,
                      {
                        color: colors.secondaryLabel,
                        fontWeight: '600',
                        marginLeft: rtl.isRTL ? 0 : spacing.sm,
                        marginRight: rtl.isRTL ? spacing.sm : 0,
                      },
                    ]}
                  >
                    {locale === 'ar' ? cat.label_ar : cat.label_en}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Featured Deal Banner (highest discount product) ── */}
        {featuredDeal && (() => {
          const f = featuredDeal;
          const product = f.products || {};
          const imageUrl = (product.image_urls?.[0]) ?? f.image_url ?? null;
          const slug = product.slug ?? f.slug ?? null;
          const nameEn = product.name_en ?? f.name_en ?? '';
          const nameAr = product.name_ar ?? f.name_ar ?? '';
          const discount = f.original_price && f.current_price
            ? Math.round(((f.original_price - f.current_price) / f.original_price) * 100)
            : 0;
          return (
            <Pressable
              onPress={() => slug && router.push(`/(stack)/product/${slug}`)}
              style={({ pressed }) => [styles.featuredBanner, { marginHorizontal: spacing.md, opacity: pressed ? 0.93 : 1 }]}
              accessibilityRole="button"
            >
              {imageUrl ? (
                <>
                  <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                </>
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary + '33' }]} />
              )}
              <View style={styles.featuredGradient} />
              <View style={styles.featuredContent}>
                <View style={[styles.featuredBadgeRow, { flexDirection: rtl.row }]}>
                  <View style={[styles.featuredBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.featuredBadgeText}>
                      {locale === 'ar' ? 'عرض مميز' : 'Featured Deal'}
                    </Text>
                  </View>
                  {discount > 0 && (
                    <View style={[styles.featuredBadge, { backgroundColor: colors.systemRed }]}>
                      <Text style={styles.featuredBadgeText}>-{discount}%</Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={styles.featuredTitle}>
                  {locale === 'ar' ? (nameAr || nameEn) : (nameEn || nameAr)}
                </Text>
                <View style={[styles.featuredBottom, { flexDirection: rtl.row }]}>
                  <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: 6 }}>
                    <Text style={styles.featuredPrice}>
                      {f.current_price?.toLocaleString()}
                    </Text>
                    <SARSymbol size={18} color="#fff" />
                  </View>
                  <View style={styles.featuredBtn}>
                    <Text style={styles.featuredBtnText}>
                      {locale === 'ar' ? 'اشتري الآن' : 'Buy Now'}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })()}

        {/* ── Hot Deals (same scroll/padding as category chips: full-bleed container, content padding) ── */}
        {deals.length > 0 && (
          <>
            <SectionHeader
              title={locale === 'ar' ? 'عروض اليوم' : 'Hot Deals'}
              icon={<Zap size={20} color={colors.deal} strokeWidth={2} fill={colors.deal} />}
              onSeeAll={() => router.push('/(tabs)/deals')}
              colors={colors}
              rtl={rtl}
              locale={locale}
            />
            <FlashList
              data={deals}
              renderItem={({ item }) => (
                <DealCard item={item} locale={locale} colors={colors} rtl={rtl} isDark={isDark} />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalSectionList}
              ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
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
              icon={<Flame size={20} color={colors.systemOrange} strokeWidth={2} fill={colors.systemOrange} />}
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
                contentContainerStyle={styles.horizontalSectionList}
              >
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} style={{ width: SMALL_CARD_WIDTH }} />
                ))}
              </ScrollView>
            ) : (
              <FlashList
                data={trendingProducts}
                renderItem={({ item }) => (
                  <ProductCard item={item} locale={locale} colors={colors} rtl={rtl} />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalSectionList}
                ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
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
              contentContainerStyle={styles.horizontalSectionList}
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
                backgroundColor: colors.tertiaryContainer,
                marginHorizontal: spacing.md,
                borderColor: colors.separator,
                flexDirection: rtl.row,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={[styles.couponIconCircle, { backgroundColor: colors.tertiary }]}>
              <Ticket size={18} color={colors.onTertiary} strokeWidth={2} />
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
              <View style={[styles.couponArrowPill, { backgroundColor: colors.tertiary }]}>
                <ArrowLeft size={16} color={colors.onTertiary} />
              </View>
            ) : (
              <View style={[styles.couponArrowPill, { backgroundColor: colors.tertiary }]}>
                <ArrowRight size={16} color={colors.onTertiary} />
              </View>
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
            <FlashList
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

        <View style={{ height: 96 }} />
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
        <View style={styles.sectionIconBadge}>
          {icon}
        </View>
        <Text
          style={[
            typography.title3,
            {
              color: colors.label,
              fontWeight: '700',
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
        accessibilityRole="button"
        accessibilityLabel={locale === 'ar' ? `عرض الكل ${title}` : `See all ${title}`}
        style={{ flexDirection: rtl.row, alignItems: 'center', gap: 2 }}
      >
        <Text
          style={[
            typography.caption1,
            {
              color: colors.primary,
              fontWeight: '700',
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
      style={{
        width: DEAL_CARD_WIDTH,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.separator,
        padding: 0,
        overflow: 'hidden',
      }}
      padding="xs"
    >
      <View style={[styles.dealImageContainer, { backgroundColor: colors.tertiaryGroupedBackground }]}>
        {image ? (
          <KeyedProductImage uri={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={40} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
        {savings > 0 && (
          <View
            style={[
              styles.savingsBadge,
              {
                backgroundColor: colors.error,
                left: rtl.isRTL ? undefined : spacing.sm,
                right: rtl.isRTL ? spacing.sm : undefined,
              },
            ]}
          >
            <Text style={[styles.savingsBadgeText, { color: colors.onError }]}>-{savings}%</Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.cardHeartBtn,
            {
              opacity: pressed ? 0.8 : 1,
              right: rtl.isRTL ? undefined : spacing.sm,
              left: rtl.isRTL ? spacing.sm : undefined,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Heart size={16} color={colors.label} strokeWidth={2} fill="transparent" />
        </Pressable>
      </View>
      <View style={{ padding: spacing.md }}>
        {storeName && (
          <Text
            style={[
              typography.caption2,
              { color: colors.primary, fontWeight: '600', marginBottom: 4, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection },
            ]}
            numberOfLines={1}
          >
            {storeName}
          </Text>
        )}
        <Text
          numberOfLines={2}
          style={[
            typography.footnote,
            {
              color: colors.label,
              fontWeight: '600',
              minHeight: 40,
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {name}
        </Text>
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
      style={{
        width: PRODUCT_CARD_WIDTH,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.separator,
        padding: 0,
        overflow: 'hidden',
      }}
      padding="xs"
    >
      <View style={[styles.savingsImageContainer, { backgroundColor: colors.tertiaryGroupedBackground }]}>
        {image ? (
          <KeyedProductImage uri={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={28} color={colors.tertiaryLabel} strokeWidth={1.2} />
          </View>
        )}
        {savings > 0 && (
          <View
            style={[
              styles.savingsBadge,
              {
                backgroundColor: colors.error,
                left: rtl.isRTL ? undefined : spacing.sm,
                right: rtl.isRTL ? spacing.sm : undefined,
              },
            ]}
          >
            <Text style={[styles.savingsBadgeText, { color: colors.onError }]}>-{savings}%</Text>
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
      style={{
        width: SMALL_CARD_WIDTH,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.separator,
        padding: 0,
        overflow: 'hidden',
      }}
      padding="xs"
    >
      <View style={[styles.productImageContainer, { backgroundColor: colors.tertiaryGroupedBackground }]}>
        {image ? (
          <KeyedProductImage uri={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
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
      accessibilityRole="link"
      accessibilityLabel={storeName || ''}
      style={({ pressed }) => [
        styles.storeCard,
        {
          backgroundColor: bg,
          borderColor: colors.separator,
        },
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
          <Text style={{ color: colors.onPrimary, fontSize: 18, fontWeight: '700' }}>
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
  heroShell: {
    position: 'relative',
    marginTop: spacing.sm,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -26,
    width: 180,
    height: 110,
    borderRadius: radii.xl,
    opacity: 0.35,
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  headerWrap: {},
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerAvatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: {
    marginBottom: spacing.sm,
  },
  searchBarMock: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchBarIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipSection: {
    marginBottom: spacing.sm,
  },
  featuredBanner: {
    height: 192,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 4,
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  featuredBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  featuredBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  featuredBtnText: {
    color: '#0D1117',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  categoryChipMock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryChipIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: 1,
    marginVertical: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchShell: {
    marginTop: spacing.md,
    padding: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchBar: {
    alignItems: 'center',
    height: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  searchIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  horizontalSectionList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealImageContainer: {
    height: 160,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  cardHeartBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 120,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  storeCard: {
    width: STORE_CARD_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: 1,
  },
  couponIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponArrowPill: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
