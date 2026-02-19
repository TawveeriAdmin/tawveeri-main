/**
 * Search Screen
 *
 * HIG: Search field at top with scope buttons (category chips).
 * Debounced search → POST /api/search/scrape → FlatList grid results.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  I18nManager,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, SlidersHorizontal, X, Grid, List } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { apiClient } from '@/src/lib/api/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Card, Price, Badge, EmptyState, SkeletonCard } from '@/src/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

const CATEGORIES = [
  { key: 'all', label_ar: 'الكل', label_en: 'All' },
  { key: 'smartphone', label_ar: 'هواتف', label_en: 'Phones' },
  { key: 'laptop', label_ar: 'لابتوب', label_en: 'Laptops' },
  { key: 'audio', label_ar: 'سماعات', label_en: 'Audio' },
  { key: 'tv', label_ar: 'شاشات', label_en: 'TVs' },
  { key: 'gaming', label_ar: 'ألعاب', label_en: 'Gaming' },
  { key: 'tablet', label_ar: 'تابلت', label_en: 'Tablets' },
];

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
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();

  const [query, setQuery] = useState(params.query || '');
  const [category, setCategory] = useState(params.category || 'all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [gridView, setGridView] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string, cat: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await apiClient.post<{ results: SearchResult[] }>('/api/search/scrape', {
        query: q.trim(),
        category: cat === 'all' ? undefined : cat,
        stores: ['amazon', 'noon', 'jarir', 'extra'],
        pages: 1,
      });
      setResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  const onQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text, category), 600);
  }, [category, doSearch]);

  const onCategoryChange = useCallback((cat: string) => {
    setCategory(cat);
    if (query.trim()) doSearch(query, cat);
  }, [query, doSearch]);

  const onSubmit = useCallback(() => {
    Keyboard.dismiss();
    doSearch(query, category);
  }, [query, category, doSearch]);

  // Auto-search if params provided
  useEffect(() => {
    if (params.query) doSearch(params.query, params.category || 'all');
  }, []);

  const renderItem = useCallback(({ item }: { item: SearchResult }) => (
    <Card
      onPress={() => {/* Open product detail or external URL */}}
      style={gridView ? { width: CARD_WIDTH } : { width: '100%' }}
      padding="xs"
    >
      <View style={{
        height: gridView ? 120 : 80,
        width: gridView ? '100%' : 80,
        backgroundColor: colors.secondaryBackground,
        borderRadius: radii.md,
        overflow: 'hidden',
      }}>
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        )}
      </View>
      <View style={{ flex: 1, padding: spacing.sm }}>
        <Text numberOfLines={2} style={[typography.footnote, { color: colors.label }]}>
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
          <Badge text={item.store} variant="tinted" color="primary" />
        </View>
        <Price price={item.price} originalPrice={item.originalPrice} size="sm" />
      </View>
    </Card>
  ), [gridView, colors]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.tertiaryFill, borderRadius: radii.md }]}>
          <SearchIcon size={20} color={colors.tertiaryLabel} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={onSubmit}
            placeholder={t('search.searchPlaceholder')}
            placeholderTextColor={colors.tertiaryLabel}
            returnKeyType="search"
            autoCorrect={false}
            style={[typography.body, {
              flex: 1, color: colors.label, marginStart: spacing.sm,
              textAlign: I18nManager.isRTL ? 'right' : 'left',
            }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={8}>
              <X size={18} color={colors.tertiaryLabel} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setGridView(!gridView)}
          style={styles.viewToggle}
          hitSlop={8}
        >
          {gridView ? <List size={22} color={colors.secondaryLabel} /> : <Grid size={22} color={colors.secondaryLabel} />}
        </Pressable>
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => onCategoryChange(cat.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.secondaryFill,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Text style={[typography.footnote, {
                color: active ? colors.onPrimary : colors.label,
                fontWeight: active ? '600' : '400',
              }]}>
                {locale === 'ar' ? cat.label_ar : cat.label_en}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : results.length === 0 && query.trim() ? (
        <EmptyState
          title={locale === 'ar' ? 'لا توجد نتائج' : 'No results found'}
          message={locale === 'ar' ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}
        />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.title}-${index}`}
          numColumns={gridView ? 2 : 1}
          key={gridView ? 'grid' : 'list'}
          columnWrapperStyle={gridView ? { gap: spacing.md, paddingHorizontal: spacing.md } : undefined}
          contentContainerStyle={[
            { paddingHorizontal: gridView ? 0 : spacing.md, paddingBottom: spacing.xxl },
            !gridView && { gap: spacing.sm },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
  },
  viewToggle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 32,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
