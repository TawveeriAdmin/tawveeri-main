/**
 * Search Screen
 *
 * HIG: Search field at top with scope buttons (category chips).
 * States: Idle (recent + popular) → Loading (skeleton) → Results / No Results.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Keyboard,
  Linking,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Search as SearchIcon,
  X,
  Grid,
  List,
  Smartphone,
  Laptop,
  Headphones,
  Monitor,
  Gamepad2,
  Tablet,
  Package,
  Clock,
  TrendingUp,
  ArrowUpDown,
  SearchX,
  SlidersHorizontal,
  BarChart3,
  ExternalLink,
  Heart,
  Bookmark,
  BookmarkCheck,
  ScanBarcode,
  Mic,
} from 'lucide-react-native';
import { saveSearch } from '@/src/lib/search/saved-searches';
import { BarcodeScanner } from '@/src/components/search/BarcodeScanner';
import { useNetwork } from '@/src/lib/network/use-network';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { apiClient } from '@/src/lib/api/client';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Card, Price, Badge, EmptyState, SkeletonCard } from '@/src/components/ui';
import { calculateSavingsPercentage } from '@/src/lib/utils';
import { STORE_LOGOS } from '@/src/lib/constants/store-logos';
import { useCompareStore } from '@/src/lib/compare/compare-store';
import { useSavedStore } from '@/src/lib/wishlist/saved-store';
import {
  FilterSheet,
  applyFilters,
  getActiveFilterCount,
  EMPTY_FILTERS,
  type SearchFilters,
} from '@/src/components/search/FilterSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;
const RECENT_SEARCHES_KEY = 'tawveeri_recent_searches';
const MAX_RECENT_SEARCHES = 8;

// ─── Static Data ─────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all', Icon: null, label_ar: 'الكل', label_en: 'All' },
  { key: 'smartphone', Icon: Smartphone, label_ar: 'هواتف', label_en: 'Phones' },
  { key: 'laptop', Icon: Laptop, label_ar: 'لابتوب', label_en: 'Laptops' },
  { key: 'audio', Icon: Headphones, label_ar: 'سماعات', label_en: 'Audio' },
  { key: 'tv', Icon: Monitor, label_ar: 'شاشات', label_en: 'TVs' },
  { key: 'gaming', Icon: Gamepad2, label_ar: 'ألعاب', label_en: 'Gaming' },
  { key: 'tablet', Icon: Tablet, label_ar: 'تابلت', label_en: 'Tablets' },
];

// ─── Types ───────────────────────────────────────────────────

interface AutocompleteSuggestion {
  id: string;
  name: string;
  imageUrl?: string;
  type: 'product' | 'recent';
}


type SortOption = 'relevance' | 'price_asc' | 'price_desc';

interface SearchResult {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  store: string;
  imageUrl?: string;
  url: string;
  brand?: string;
  category?: string;
  stores?: any[];
  storeCount?: number;
}

// ─── Main Component ──────────────────────────────────────────

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();

  const [query, setQuery] = useState(params.query || '');
  const [category, setCategory] = useState(params.category || 'all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autocompleteRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const recentRef = useRef<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          recentRef.current = parsed;
          setRecentSearches(parsed);
        } catch {}
      }
    });
  }, []);

  // Load popular searches from DB (top viewed products)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('name_en')
          .eq('is_active', true)
          .order('view_count', { ascending: false })
          .limit(6);
        if (data && data.length > 0) {
          setPopularSearches(data.map((p: any) => p.name_en).filter(Boolean));
        }
      } catch {
        setPopularSearches(['iPhone 15', 'MacBook Air', 'AirPods Pro', 'Samsung Galaxy S24', 'PlayStation 5', 'iPad Air']);
      }
    })();
  }, []);

  // Autocomplete suggestions
  const fetchAutocomplete = useCallback(
    (text: string) => {
      if (autocompleteRef.current) clearTimeout(autocompleteRef.current);
      if (!text.trim() || text.trim().length < 2) {
        setAutocompleteSuggestions([]);
        setShowAutocomplete(false);
        return;
      }
      autocompleteRef.current = setTimeout(async () => {
        try {
          const suggestions: AutocompleteSuggestion[] = [];

          // Search products from DB
          const { data: products } = await supabase
            .from('products')
            .select('id, name_ar, name_en, image_url')
            .eq('is_active', true)
            .or(`name_ar.ilike.%${text.trim()}%,name_en.ilike.%${text.trim()}%,brand.ilike.%${text.trim()}%`)
            .order('view_count', { ascending: false })
            .limit(6);

          if (products) {
            products.forEach((p: any) => {
              suggestions.push({
                id: p.id,
                name: locale === 'ar' ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar),
                imageUrl: p.image_url,
                type: 'product',
              });
            });
          }

          // Recent matching searches for auth users
          if (user) {
            const { data: history } = await supabase
              .from('saved_searches')
              .select('id, query')
              .eq('user_id', user.id)
              .ilike('query', `%${text.trim()}%`)
              .order('created_at', { ascending: false })
              .limit(2);

            if (history) {
              history.forEach((h: any) => {
                if (!suggestions.find((s) => s.name.toLowerCase() === h.query.toLowerCase())) {
                  suggestions.push({ id: h.id, name: h.query, type: 'recent' });
                }
              });
            }
          }

          setAutocompleteSuggestions(suggestions.slice(0, 8));
          setShowAutocomplete(suggestions.length > 0);
        } catch {
          setShowAutocomplete(false);
        }
      }, 300);
    },
    [locale, user?.id],
  );

  const saveRecentSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentRef.current.filter((s) => s !== trimmed)].slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    recentRef.current = updated;
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }, []);

  const clearRecentSearches = useCallback(async () => {
    recentRef.current = [];
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  const doSearch = useCallback(
    async (q: string, cat: string) => {
      if (!q.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      setLoading(true);
      setHasSearched(true);
      saveRecentSearch(q);

      const cacheKey = `tawveeri_search_cache_${q.trim()}_${cat}`;

      // If offline, load from cache
      if (!isConnected) {
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) setResults(JSON.parse(cached));
        } catch {}
        setLoading(false);
        return;
      }

      try {
        const data = await apiClient.post<{ products: any[] }>('/api/search/scrape', {
          query: q.trim(),
          category: cat === 'all' ? undefined : cat,
          stores: ['amazon', 'noon', 'jarir', 'extra', 'almanea'],
          pages: 1,
        });
        const mapped: SearchResult[] = (data.products || []).map((p: any) => ({
          id: p.sku || p.product_url || String(Math.random()),
          title: p.name_en || p.name_ar || '',
          price: p.best_price || p.current_price || 0,
          originalPrice: p.original_price ?? undefined,
          store: p.stores?.[0]?.store || p.store || '',
          imageUrl: p.image_urls?.[0] ?? undefined,
          url: p.product_url || '',
          brand: p.brand ?? undefined,
          category: p.category ?? undefined,
          stores: p.stores,
          storeCount: p.store_count || 1,
        }));
        setResults(mapped);
        // Cache results for offline use
        AsyncStorage.setItem(cacheKey, JSON.stringify(mapped)).catch(() => {});
      } catch (err) {
        console.error('Search error:', err);
        // Try cache on error too
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) { setResults(JSON.parse(cached)); return; }
        } catch {}
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [saveRecentSearch, isConnected],
  );

  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (!text.trim()) {
        setResults([]);
        setHasSearched(false);
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
      } else {
        fetchAutocomplete(text);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text, category), 600);
    },
    [category, doSearch, fetchAutocomplete],
  );

  const onCategoryChange = useCallback(
    (cat: string) => {
      setCategory(cat);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (query.trim()) doSearch(query, cat);
    },
    [query, doSearch],
  );

  const onSubmit = useCallback(() => {
    Keyboard.dismiss();
    doSearch(query, category);
  }, [query, category, doSearch]);

  const performSearch = useCallback(
    (q: string) => {
      setQuery(q);
      setShowAutocomplete(false);
      Keyboard.dismiss();
      doSearch(q, category);
    },
    [category, doSearch],
  );

  const handleSaveSearch = useCallback(async () => {
    if (!user || !query.trim()) return;
    try {
      await saveSearch(user.id, query.trim(), category !== 'all' ? category : undefined);
      setSearchSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSearchSaved(false), 3000);
    } catch {}
  }, [user, query, category]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    results.forEach((r) => { if (r.brand) brands.add(r.brand); });
    return Array.from(brands).sort();
  }, [results]);

  const filterCount = useMemo(() => getActiveFilterCount(filters), [filters]);

  const sortedResults = useMemo(() => {
    let filtered = applyFilters(results, filters);
    if (sortBy === 'price_asc') filtered.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [results, sortBy, filters]);

  // Auto-search if params provided
  useEffect(() => {
    if (params.query) doSearch(params.query, params.category || 'all');
  }, []);

  const isIdle = !hasSearched && !loading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* ── Search Input ── */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.secondaryBackground,
              borderWidth: 1,
              borderColor: colors.separator,
            },
          ]}
        >
          <SearchIcon size={18} color={colors.secondaryLabel} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={onSubmit}
            placeholder={t('search.searchPlaceholder')}
            placeholderTextColor={colors.tertiaryLabel}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={!params.query}
            accessibilityRole="search"
            accessibilityLabel={rtl.isRTL ? 'البحث عن المنتجات' : 'Search for products'}
            style={[
              typography.body,
              {
                flex: 1,
                color: colors.label,
                marginLeft: rtl.isRTL ? 0 : spacing.sm,
                marginRight: rtl.isRTL ? spacing.sm : 0,
                textAlign: rtl.textAlign,
                writingDirection: rtl.writingDirection,
              },
            ]}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={rtl.isRTL ? 'مسح البحث' : 'Clear search'}
              style={({ pressed }) => [
                styles.clearButton,
                { backgroundColor: colors.tertiaryFill },
                pressed && { opacity: 0.7 },
              ]}
            >
              <X size={14} color={colors.secondaryLabel} strokeWidth={2} />
            </Pressable>
          )}
          {/* Mic button — focuses input to trigger OS dictation */}
          <Pressable
            onPress={() => {
              inputRef.current?.focus();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={rtl.isRTL ? 'البحث الصوتي' : 'Voice search'}
            accessibilityHint={rtl.isRTL ? 'يفتح لوحة المفاتيح للإملاء الصوتي' : 'Opens keyboard for voice dictation'}
            style={({ pressed }) => [styles.inputIconBtn, pressed && { opacity: 0.6 }]}
          >
            <Mic size={18} color={colors.secondaryLabel} strokeWidth={2} />
          </Pressable>
          {/* Barcode scanner button */}
          <Pressable
            onPress={() => {
              setBarcodeScannerVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={rtl.isRTL ? 'مسح الباركود' : 'Scan barcode'}
            accessibilityHint={rtl.isRTL ? 'يفتح الكاميرا لمسح باركود المنتج' : 'Opens camera to scan a product barcode'}
            style={({ pressed }) => [styles.inputIconBtn, pressed && { opacity: 0.6 }]}
          >
            <ScanBarcode size={18} color={colors.secondaryLabel} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* ── Autocomplete Overlay ── */}
      {showAutocomplete && autocompleteSuggestions.length > 0 && !loading && !hasSearched && (
        <View style={[styles.autocompleteContainer, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          {autocompleteSuggestions.map((suggestion) => (
            <Pressable
              key={`${suggestion.type}-${suggestion.id}`}
              onPress={() => performSearch(suggestion.name)}
              style={({ pressed }) => [
                styles.autocompleteRow,
                { flexDirection: rtl.row },
                pressed && { backgroundColor: colors.quaternaryFill },
              ]}
            >
              {suggestion.type === 'product' && suggestion.imageUrl ? (
                <Image source={{ uri: suggestion.imageUrl }} style={styles.autocompleteImage} contentFit="contain" />
              ) : (
                <View style={[styles.autocompleteIconWrap, { backgroundColor: colors.tertiaryFill }]}>
                  <Clock size={14} color={colors.tertiaryLabel} />
                </View>
              )}
              <Text
                numberOfLines={1}
                style={[typography.subheadline, { color: colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
              >
                {suggestion.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Category Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          const CatIcon = cat.Icon;
          return (
            <Pressable
              key={cat.key}
              onPress={() => onCategoryChange(cat.key)}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? cat.label_ar : cat.label_en}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.secondaryBackground,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.separator,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {CatIcon && (
                <CatIcon
                  size={14}
                  color={active ? colors.onPrimary : colors.secondaryLabel}
                  strokeWidth={1.8}
                />
              )}
              <Text
                style={[
                  typography.footnote,
                  {
                    color: active ? colors.onPrimary : colors.label,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {locale === 'ar' ? cat.label_ar : cat.label_en}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Content States ── */}
      {loading ? (
        <LoadingSkeleton gridView={gridView} />
      ) : isIdle ? (
        <IdleState
          recentSearches={recentSearches}
          onRecentPress={performSearch}
          onClearRecent={clearRecentSearches}
          onPopularPress={performSearch}
          popularSearches={popularSearches}
          locale={locale}
          colors={colors}
          isDark={isDark}
          rtl={rtl}
        />
      ) : results.length === 0 && hasSearched ? (
        <EmptyState
          icon={<SearchX size={48} color={colors.tertiaryLabel} strokeWidth={1.2} />}
          title={t('search.noResults')}
          message={
            locale === 'ar'
              ? 'جرب كلمات بحث مختلفة أو فئة أخرى'
              : 'Try different search terms or another category'
          }
        />
      ) : (
        <>
          <ResultsHeader
            count={sortedResults.length}
            sortBy={sortBy}
            onSortChange={setSortBy}
            gridView={gridView}
            onToggleView={() => {
              setGridView(!gridView);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            filterCount={filterCount}
            onFilterPress={() => setFilterVisible(true)}
            onSaveSearch={user ? handleSaveSearch : undefined}
            searchSaved={searchSaved}
            locale={locale}
            colors={colors}
            t={t}
            rtl={rtl}
          />
          <FlashList
            data={sortedResults}
            renderItem={({ item }) =>
              gridView ? (
                <GridResultCard item={item} colors={colors} rtl={rtl} />
              ) : (
                <ListResultCard item={item} colors={colors} rtl={rtl} />
              )
            }
            keyExtractor={(item, index) => `${item.url}-${index}`}
            numColumns={gridView ? 2 : 1}
            key={gridView ? 'grid' : 'list'}
            contentContainerStyle={[
              { paddingHorizontal: gridView ? 0 : spacing.md, paddingBottom: 100 },
              !gridView && { gap: spacing.sm },
            ]}
            ItemSeparatorComponent={gridView ? undefined : () => <View style={{ height: spacing.md }} />}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"

          />
        </>
      )}
      {/* Filter Sheet */}
      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={setFilters}
        category={category}
        availableBrands={availableBrands}
        locale={locale}
      />
      {/* Barcode Scanner */}
      <BarcodeScanner
        visible={barcodeScannerVisible}
        onClose={() => setBarcodeScannerVisible(false)}
        onScanned={(data) => performSearch(data)}
        locale={locale}
      />
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function LoadingSkeleton({ gridView }: { gridView: boolean }) {
  if (gridView) {
    return (
      <View style={styles.skeletonGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} style={{ width: CARD_WIDTH }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: spacing.sm }}>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

function IdleState({
  recentSearches,
  onRecentPress,
  onClearRecent,
  onPopularPress,
  popularSearches,
  locale,
  colors,
  isDark,
  rtl,
}: {
  recentSearches: string[];
  onRecentPress: (q: string) => void;
  onClearRecent: () => void;
  onPopularPress: (q: string) => void;
  popularSearches: string[];
  locale: string;
  colors: any;
  isDark: boolean;
  rtl: ReturnType<typeof useRTL>;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero prompt */}
      <View style={styles.idleHero}>
        <View
          style={[
            styles.idleIconCircle,
            { backgroundColor: isDark ? '#172554' : '#EFF6FF' },
          ]}
        >
          <SearchIcon size={28} color={isDark ? '#60A5FA' : '#2563EB'} strokeWidth={1.5} />
        </View>
        <Text
          style={[
            typography.title3,
            {
              color: colors.label,
              fontWeight: '600',
              textAlign: 'center',
              marginTop: spacing.md,
              writingDirection: rtl.writingDirection,
            },
          ]}
        >
          {locale === 'ar' ? 'ابحث عن المنتجات' : 'Search for products'}
        </Text>
        <Text
          style={[
            typography.subheadline,
            { color: colors.secondaryLabel, textAlign: 'center', marginTop: spacing.xs, writingDirection: rtl.writingDirection },
          ]}
        >
          {locale === 'ar'
            ? 'قارن الأسعار من أكثر من 5 متاجر'
            : 'Compare prices from 5+ stores'}
        </Text>
      </View>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={[styles.idleSectionHeader, { flexDirection: rtl.row }]}>
            <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
              <Clock size={16} color={colors.secondaryLabel} strokeWidth={1.8} />
              <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {locale === 'ar' ? 'البحوث الأخيرة' : 'Recent'}
              </Text>
            </View>
            <Pressable onPress={onClearRecent} hitSlop={8}>
              <Text style={[typography.subheadline, { color: colors.primary, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {locale === 'ar' ? 'مسح' : 'Clear'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {recentSearches.map((q, i) => (
              <Pressable
                key={`${q}-${i}`}
                onPress={() => onRecentPress(q)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.secondaryBackground,
                    borderWidth: 1,
                    borderColor: colors.separator,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Clock size={12} color={colors.tertiaryLabel} strokeWidth={1.5} />
                <Text
                  style={[typography.footnote, { color: colors.label }]}
                  numberOfLines={1}
                >
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Popular Searches */}
      {popularSearches.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View
            style={{
              flexDirection: rtl.row,
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}
          >
            <TrendingUp size={16} color={colors.primary} strokeWidth={1.8} />
            <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? 'بحث شائع' : 'Popular'}
            </Text>
          </View>
          <View style={styles.chipWrap}>
            {popularSearches.map((q) => (
              <Pressable
                key={q}
                onPress={() => onPopularPress(q)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { backgroundColor: isDark ? '#172554' : '#EFF6FF' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <TrendingUp
                  size={12}
                  color={isDark ? '#60A5FA' : '#2563EB'}
                  strokeWidth={1.5}
                />
                <Text
                  style={[
                    typography.footnote,
                    { color: isDark ? '#60A5FA' : '#2563EB', fontWeight: '500' },
                  ]}
                  numberOfLines={1}
                >
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function ResultsHeader({
  count,
  sortBy,
  onSortChange,
  gridView,
  onToggleView,
  filterCount,
  onFilterPress,
  onSaveSearch,
  searchSaved,
  locale,
  colors,
  t,
  rtl,
}: {
  count: number;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  gridView: boolean;
  onToggleView: () => void;
  filterCount: number;
  onFilterPress: () => void;
  onSaveSearch?: () => void;
  searchSaved?: boolean;
  locale: string;
  colors: any;
  t: (key: string) => string;
  rtl: ReturnType<typeof useRTL>;
}) {
  const sortLabels: Record<SortOption, string> = {
    relevance: locale === 'ar' ? 'الأكثر صلة' : 'Relevance',
    price_asc: locale === 'ar' ? 'الأقل سعراً' : 'Lowest',
    price_desc: locale === 'ar' ? 'الأعلى سعراً' : 'Highest',
  };

  const cycleSortOption = () => {
    const options: SortOption[] = ['relevance', 'price_asc', 'price_desc'];
    const idx = options.indexOf(sortBy);
    onSortChange(options[(idx + 1) % options.length]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.resultsHeader, { flexDirection: rtl.row }]}>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {count} {t('search.resultsCount')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFilterPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={locale === 'ar' ? 'فلتر النتائج' : 'Filter results'}
          style={({ pressed }) => [
            styles.sortButton,
            {
              backgroundColor: filterCount > 0 ? colors.primaryContainer : colors.secondaryBackground,
              borderWidth: filterCount > 0 ? 0 : 1,
              borderColor: colors.separator,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <SlidersHorizontal size={12} color={filterCount > 0 ? colors.primary : colors.secondaryLabel} strokeWidth={2} />
          <Text style={[typography.caption1, { color: filterCount > 0 ? colors.primary : colors.label, fontWeight: '500' }]}>
            {locale === 'ar' ? 'فلتر' : 'Filter'}
            {filterCount > 0 ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={cycleSortOption}
          accessibilityRole="button"
          accessibilityLabel={locale === 'ar' ? `ترتيب حسب: ${sortLabels[sortBy]}` : `Sort by: ${sortLabels[sortBy]}`}
          style={({ pressed }) => [
            styles.sortButton,
            {
              backgroundColor: colors.secondaryBackground,
              borderWidth: 1,
              borderColor: colors.separator,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <ArrowUpDown size={12} color={colors.secondaryLabel} strokeWidth={2} />
          <Text style={[typography.caption1, { color: colors.label, fontWeight: '500' }]}>
            {sortLabels[sortBy]}
          </Text>
        </Pressable>
        {onSaveSearch && (
          <Pressable
            onPress={onSaveSearch}
            accessibilityRole="button"
            accessibilityLabel={locale === 'ar' ? (searchSaved ? 'تم حفظ البحث' : 'حفظ البحث') : (searchSaved ? 'Search saved' : 'Save search')}
            style={({ pressed }) => [
              styles.viewToggle,
              { backgroundColor: searchSaved ? colors.primaryContainer : colors.secondaryBackground },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={4}
          >
            {searchSaved ? (
              <BookmarkCheck size={18} color={colors.primary} strokeWidth={1.8} />
            ) : (
              <Bookmark size={18} color={colors.secondaryLabel} strokeWidth={1.8} />
            )}
          </Pressable>
        )}
        <Pressable
          onPress={onToggleView}
          accessibilityRole="button"
          accessibilityLabel={locale === 'ar' ? (gridView ? 'عرض قائمة' : 'عرض شبكة') : (gridView ? 'List view' : 'Grid view')}
          style={({ pressed }) => [
            styles.viewToggle,
            { backgroundColor: colors.secondaryBackground },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={4}
        >
          {gridView ? (
            <List size={18} color={colors.secondaryLabel} strokeWidth={1.8} />
          ) : (
            <Grid size={18} color={colors.secondaryLabel} strokeWidth={1.8} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function GridResultCard({ item, colors, rtl }: { item: SearchResult; colors: any; rtl: ReturnType<typeof useRTL> }) {
  const savings = item.originalPrice
    ? calculateSavingsPercentage(item.originalPrice, item.price)
    : 0;
  const addToCompare = useCompareStore((s) => s.addProduct);
  const removeFromCompare = useCompareStore((s) => s.removeProduct);
  const isInCompare = useCompareStore((s) => s.isInCompare(item.id));
  const { addProduct: saveProduct, removeProduct: unsaveProduct, isSaved } = useSavedStore();
  const saved = isSaved(item.id);

  const toggleSaved = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (saved) {
      unsaveProduct(item.id);
    } else {
      saveProduct({ id: item.id, title: item.title, price: item.price, originalPrice: item.originalPrice, imageUrl: item.imageUrl, store: item.store, url: item.url });
    }
  };

  const toggleCompare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isInCompare) {
      removeFromCompare(item.id);
    } else {
      const added = addToCompare({
        id: item.id,
        name: item.title,
        slug: item.id,
        image_url: item.imageUrl,
        brand: item.brand,
        category: item.category,
        product_stores: [{
          id: item.id,
          current_price: item.price,
          original_price: item.originalPrice,
          store_id: item.store,
          stores: { id: item.store, name: item.store },
        }],
      });
      if (!added) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };

  return (
    <Card onPress={() => Linking.openURL(item.url)} style={{ width: CARD_WIDTH }} padding="xs">
      <View
        style={{
          height: 130,
          backgroundColor: colors.secondaryBackground,
          borderRadius: radii.md,
          overflow: 'hidden',
        }}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
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
        {/* Action buttons overlay */}
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
          <Pressable
            onPress={(e) => { e.stopPropagation(); Linking.openURL(item.url); }}
            style={[styles.cardActionBtn, { backgroundColor: colors.background + 'E6' }]}
            hitSlop={4}
          >
            <ExternalLink size={14} color={colors.secondaryLabel} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <View style={{ padding: spacing.sm }}>
        <Text
          numberOfLines={2}
          style={[typography.footnote, { color: colors.label, lineHeight: 18, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
          <Price price={item.price} originalPrice={item.originalPrice} size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {STORE_LOGOS[item.store] ? (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.secondaryBackground, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Image source={STORE_LOGOS[item.store]} style={{ width: 14, height: 14 }} contentFit="contain" />
              </View>
            ) : null}
            <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '500' }]}>{item.store}</Text>
            {(item.storeCount ?? 0) > 1 && (
              <Text style={[typography.caption2, { color: colors.primary, fontWeight: '600' }]}>
                +{(item.storeCount ?? 1) - 1}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

function ListResultCard({ item, colors, rtl }: { item: SearchResult; colors: any; rtl: ReturnType<typeof useRTL> }) {
  const savings = item.originalPrice
    ? calculateSavingsPercentage(item.originalPrice, item.price)
    : 0;
  const addToCompare = useCompareStore((s) => s.addProduct);
  const removeFromCompare = useCompareStore((s) => s.removeProduct);
  const isInCompare = useCompareStore((s) => s.isInCompare(item.id));
  const { addProduct: saveProduct, removeProduct: unsaveProduct, isSaved } = useSavedStore();
  const saved = isSaved(item.id);

  const toggleSaved = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (saved) {
      unsaveProduct(item.id);
    } else {
      saveProduct({ id: item.id, title: item.title, price: item.price, originalPrice: item.originalPrice, imageUrl: item.imageUrl, store: item.store, url: item.url });
    }
  };

  const toggleCompare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isInCompare) {
      removeFromCompare(item.id);
    } else {
      const added = addToCompare({
        id: item.id,
        name: item.title,
        slug: item.id,
        image_url: item.imageUrl,
        brand: item.brand,
        category: item.category,
        product_stores: [{
          id: item.id,
          current_price: item.price,
          original_price: item.originalPrice,
          store_id: item.store,
          stores: { id: item.store, name: item.store },
        }],
      });
      if (!added) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };

  return (
    <Card onPress={() => Linking.openURL(item.url)} padding="sm">
      <View style={{ flexDirection: rtl.row, gap: spacing.md }}>
        <View
          style={{
            width: 100,
            height: 100,
            backgroundColor: colors.secondaryBackground,
            borderRadius: radii.md,
            overflow: 'hidden',
          }}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={28} color={colors.tertiaryLabel} strokeWidth={1.2} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text
            numberOfLines={2}
            style={[typography.subheadline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
          >
            {item.title}
          </Text>
          <View
            style={{ flexDirection: rtl.row, alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}
          >
            <Price price={item.price} originalPrice={item.originalPrice} size="sm" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {STORE_LOGOS[item.store] ? (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.secondaryBackground, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={STORE_LOGOS[item.store]} style={{ width: 16, height: 16 }} contentFit="contain" />
                </View>
              ) : null}
              <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '500' }]}>{item.store}</Text>
              {(item.storeCount ?? 0) > 1 && (
                <Text style={[typography.caption2, { color: colors.primary, fontWeight: '600' }]}>
                  +{(item.storeCount ?? 1) - 1}
                </Text>
              )}
              {savings > 0 && (
                <View
                  style={{
                    backgroundColor: colors.priceSavingsContainer,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={[
                      typography.caption2,
                      { color: colors.priceSavings, fontWeight: '700' },
                    ]}
                  >
                    -{savings}%
                  </Text>
                </View>
              )}
            </View>
          </View>
          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); toggleSaved(); }}
              style={[styles.listActionBtn, { backgroundColor: saved ? '#FEE2E2' : colors.tertiaryFill }]}
              hitSlop={4}
            >
              <Heart size={13} color={saved ? colors.systemRed : colors.secondaryLabel} fill={saved ? colors.systemRed : 'none'} strokeWidth={2} />
              <Text style={[typography.caption2, { color: saved ? colors.systemRed : colors.secondaryLabel, fontWeight: '500' }]}>
                {saved ? (rtl.isRTL ? 'محفوظ' : 'Saved') : (rtl.isRTL ? 'حفظ' : 'Save')}
              </Text>
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation(); toggleCompare(); }}
              style={[styles.listActionBtn, { backgroundColor: isInCompare ? colors.primaryContainer : colors.tertiaryFill }]}
              hitSlop={4}
            >
              <BarChart3 size={13} color={isInCompare ? colors.primary : colors.secondaryLabel} strokeWidth={2} />
              <Text style={[typography.caption2, { color: isInCompare ? colors.primary : colors.secondaryLabel, fontWeight: '500' }]}>
                {isInCompare ? (rtl.isRTL ? 'في المقارنة' : 'In Compare') : (rtl.isRTL ? 'قارن' : 'Compare')}
              </Text>
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation(); Linking.openURL(item.url); }}
              style={[styles.listActionBtn, { backgroundColor: colors.tertiaryFill }]}
              hitSlop={4}
            >
              <ExternalLink size={13} color={colors.secondaryLabel} strokeWidth={2} />
              <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '500' }]}>
                {rtl.isRTL ? 'المتجر' : 'Store'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  inputIconBtn: {
    padding: 6,
    marginLeft: 2,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  // Idle state
  idleHero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  idleIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  // Results
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
  listActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  autocompleteContainer: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  autocompleteRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  autocompleteImage: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
  },
  autocompleteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
