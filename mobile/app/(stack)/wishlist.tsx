/**
 * Wishlist Screen
 *
 * HIG: .insetGrouped list style, swipe-to-delete, empty state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, SectionList, StyleSheet, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Heart, Trash2, ExternalLink } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { useSavedStore, SavedProduct } from '@/src/lib/wishlist/saved-store';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, EmptyState, Skeleton } from '@/src/components/ui';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();

  // DB-backed wishlist (authenticated users)
  const [dbItems, setDbItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Local saved products (from search, no auth needed)
  const savedProducts = useSavedStore((s) => s.products);
  const removeSaved = useSavedStore((s) => s.removeProduct);

  const loadWishlist = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('user_wishlists')
      .select('*, products(*, product_stores(*, stores(*)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setDbItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  const removeDbItem = async (wishlistId: string) => {
    await supabase.from('user_wishlists').delete().eq('id', wishlistId);
    setDbItems((prev) => prev.filter((i) => i.id !== wishlistId));
  };

  const confirmRemoveDb = (wishlistId: string) => {
    Alert.alert(
      locale === 'ar' ? 'إزالة من المفضلة' : 'Remove from Wishlist',
      locale === 'ar' ? 'هل تريد إزالة هذا المنتج؟' : 'Remove this product from your wishlist?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'إزالة' : 'Remove', style: 'destructive', onPress: () => removeDbItem(wishlistId) },
      ],
    );
  };

  const confirmRemoveSaved = (id: string) => {
    Alert.alert(
      locale === 'ar' ? 'إزالة المنتج المحفوظ' : 'Remove Saved Product',
      locale === 'ar' ? 'هل تريد إزالة هذا المنتج؟' : 'Remove this product from saved?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'إزالة' : 'Remove', style: 'destructive', onPress: () => removeSaved(id) },
      ],
    );
  };

  if (loading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={100} style={{ borderRadius: radii.lg }} />
        ))}
      </View>
    );
  }

  const hasDbItems = dbItems.length > 0;
  const hasSavedItems = savedProducts.length > 0;
  const isEmpty = !hasDbItems && !hasSavedItems;

  if (isEmpty) {
    return (
      <EmptyState
        icon={<Heart size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'المفضلة فارغة' : 'No favorites yet'}
        message={locale === 'ar' ? 'أضف منتجات لمتابعة أسعارها' : 'Add products to track their prices'}
        actionLabel={locale === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
        onAction={() => router.push('/(tabs)/search')}
      />
    );
  }

  // Build sections for SectionList
  type SectionItem = { type: 'db'; data: any } | { type: 'saved'; data: SavedProduct };
  const sections: { title: string; data: SectionItem[] }[] = [];

  if (hasDbItems) {
    sections.push({
      title: locale === 'ar' ? 'المفضلة' : 'Wishlist',
      data: dbItems.map((item) => ({ type: 'db' as const, data: item })),
    });
  }

  if (hasSavedItems) {
    sections.push({
      title: locale === 'ar' ? 'محفوظ من البحث' : 'Saved from Search',
      data: savedProducts.map((item) => ({ type: 'saved' as const, data: item })),
    });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.type === 'db' ? item.data.id : `saved-${item.data.id}`}
      contentContainerStyle={{ padding: spacing.md }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section: { title } }) => (
        sections.length > 1 ? (
          <Text style={[
            typography.headline,
            {
              color: colors.label,
              marginTop: spacing.md,
              marginBottom: spacing.sm,
              textAlign: rtl.textAlign,
              writingDirection: rtl.writingDirection,
            },
          ]}>
            {title}
          </Text>
        ) : null
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        if (item.type === 'db') {
          const wishlistItem = item.data;
          const product = wishlistItem.products;
          const bestStore = product?.product_stores
            ?.sort((a: any, b: any) => a.current_price - b.current_price)[0];

          return (
            <Pressable
              onPress={() => router.push(`/(stack)/product/${product?.slug}`)}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name)}
              style={[styles.card, { backgroundColor: colors.card, flexDirection: rtl.row }]}
            >
              {product?.image_url && (
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.image}
                  contentFit="contain"
                />
              )}
              <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
                <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                  {locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name)}
                </Text>
                {bestStore && (
                  <Price price={bestStore.current_price} size="sm" style={{ marginTop: 4 }} />
                )}
              </View>
              <Pressable
                onPress={() => confirmRemoveDb(wishlistItem.id)}
                accessibilityRole="button"
                accessibilityLabel={locale === 'ar' ? 'إزالة من المفضلة' : 'Remove from wishlist'}
                style={styles.deleteBtn}
                hitSlop={8}
              >
                <Trash2 size={18} color={colors.systemRed} />
              </Pressable>
            </Pressable>
          );
        }

        // Saved from search (local store)
        const saved = item.data;
        return (
          <Pressable
            onPress={() => Linking.openURL(saved.url)}
            accessibilityRole="link"
            accessibilityLabel={saved.title}
            style={[styles.card, { backgroundColor: colors.card, flexDirection: rtl.row }]}
          >
            {saved.imageUrl && (
              <Image
                source={{ uri: saved.imageUrl }}
                style={styles.image}
                contentFit="contain"
              />
            )}
            <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
              <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                {saved.title}
              </Text>
              <Price price={saved.price} originalPrice={saved.originalPrice} size="sm" style={{ marginTop: 4 }} />
              <View style={[styles.storeRow, { flexDirection: rtl.row }]}>
                <ExternalLink size={12} color={colors.tertiaryLabel} />
                <Text style={[typography.caption2, { color: colors.tertiaryLabel, marginLeft: rtl.isRTL ? 0 : 4, marginRight: rtl.isRTL ? 4 : 0 }]}>
                  {saved.store}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => confirmRemoveSaved(saved.id)}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'إزالة من المحفوظات' : 'Remove from saved'}
              style={styles.deleteBtn}
              hitSlop={8}
            >
              <Trash2 size={18} color={colors.systemRed} />
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    backgroundColor: '#f5f5f5',
  },
  deleteBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeRow: {
    alignItems: 'center',
    marginTop: 4,
  },
});
