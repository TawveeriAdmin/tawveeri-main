/**
 * Coupons Screen — Browse active coupon codes.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, RefreshControl, TextInput, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Search, Ticket, X } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { apiClient } from '@/src/lib/api/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { EmptyState, Skeleton } from '@/src/components/ui';
import { CouponBadge } from '@/src/components/ui/CouponBadge';

type SortOption = 'newest' | 'highest_discount' | 'expiring_soon';

export default function CouponsScreen() {
  const { colors } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const rtl = useRTL();

  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [storeFilter, setStoreFilter] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    try {
      const data = await apiClient.get<any>(`/api/coupons?sort=${sortBy}&limit=50`);
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data.coupons) ? data.coupons : Array.isArray(data) ? data : [];
      setCoupons(list);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCoupons();
    setRefreshing(false);
  }, [fetchCoupons]);

  // Unique stores — API nests store as `stores: { name_ar, name_en }` from the join
  const stores = useMemo(() => {
    const map = new Map<string, string>();
    coupons.forEach((c) => {
      const storeObj = c.stores;
      const name = locale === 'ar' ? (storeObj?.name_ar || c.store_name_ar) : (storeObj?.name_en || c.store_name_en);
      if (c.store_id && name) map.set(c.store_id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [coupons, locale]);

  // Filtered coupons
  const filtered = useMemo(() => {
    let items = coupons;
    if (storeFilter) items = items.filter((c) => c.store_id === storeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) => {
        const storeObj = c.stores;
        return (
          c.code?.toLowerCase().includes(q) ||
          storeObj?.name_ar?.toLowerCase().includes(q) ||
          storeObj?.name_en?.toLowerCase().includes(q) ||
          c.description_ar?.toLowerCase().includes(q) ||
          c.description_en?.toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [coupons, storeFilter, search]);

  const sortLabels: Record<SortOption, string> = {
    newest: t('coupons.sortNewest'),
    highest_discount: t('coupons.sortHighestDiscount'),
    expiring_soon: t('coupons.sortExpiringSoon'),
  };

  const cycleSortOption = () => {
    const options: SortOption[] = ['newest', 'highest_discount', 'expiring_soon'];
    const idx = options.indexOf(sortBy);
    setSortBy(options[(idx + 1) % options.length]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search — same spacing as search page */}
      <View style={[styles.searchRow, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.secondaryBackground, borderColor: colors.separator }]}>
          <Search size={16} color={colors.secondaryLabel} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('coupons.searchPlaceholder')}
            placeholderTextColor={colors.tertiaryLabel}
            style={[typography.body, { flex: 1, color: colors.label, marginLeft: spacing.sm, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={14} color={colors.secondaryLabel} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Store chips — compact, no stretch (match search page category chips spacing) */}
      {stores.length > 0 && (
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScrollContent}
            style={styles.chipScrollView}
          >
          <Pressable
            onPress={() => setStoreFilter(null)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: !storeFilter ? colors.primary : colors.secondaryBackground, borderWidth: storeFilter ? 1 : 0, borderColor: colors.separator },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[typography.footnote, { color: !storeFilter ? colors.onPrimary : colors.label, fontWeight: !storeFilter ? '600' : '500' }]}>
              {t('coupons.allStores')}
            </Text>
          </Pressable>
          {stores.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setStoreFilter(storeFilter === s.id ? null : s.id)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: storeFilter === s.id ? colors.primary : colors.secondaryBackground, borderWidth: storeFilter !== s.id ? 1 : 0, borderColor: colors.separator },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[typography.footnote, { color: storeFilter === s.id ? colors.onPrimary : colors.label, fontWeight: storeFilter === s.id ? '600' : '500' }]}>
                {s.name}
              </Text>
            </Pressable>
          ))}
          </ScrollView>
        </View>
      )}

      {/* Sort row — same padding as search page results header */}
      <View style={[styles.sortRow, { flexDirection: rtl.row }]}>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          {filtered.length} {t('coupons.resultsCount')}
        </Text>
        <Pressable onPress={cycleSortOption} style={[styles.sortBtn, { backgroundColor: colors.secondaryBackground, borderColor: colors.separator }]}>
          <Text style={[typography.caption1, { color: colors.label, fontWeight: '500' }]}>
            {sortLabels[sortBy]}
          </Text>
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={100} style={{ borderRadius: radii.lg }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Ticket size={48} color={colors.tertiaryLabel} />}
          title={t('coupons.noCoupons')}
          message={t('coupons.noCouponsDesc')}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id || item.code}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}

          renderItem={({ item }) => {
            // Flatten nested store data from API join into coupon props
            const coupon = {
              ...item,
              store_name_ar: item.stores?.name_ar || item.store_name_ar,
              store_name_en: item.stores?.name_en || item.store_name_en,
            };
            return <CouponBadge coupon={coupon} variant="expanded" locale={locale} />;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  chipRowWrap: {
    alignSelf: 'stretch',
  },
  chipScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignSelf: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sortBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
  },
});
