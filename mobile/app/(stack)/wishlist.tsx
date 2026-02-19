/**
 * Wishlist Screen
 *
 * HIG: .insetGrouped list style, swipe-to-delete, empty state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Heart, Trash2, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { useCartStore } from '@/src/lib/cart/cart-store';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, EmptyState, Skeleton } from '@/src/components/ui';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_wishlists')
      .select('*, products(*, product_stores(*, stores(*)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  const removeItem = async (wishlistId: string) => {
    await supabase.from('user_wishlists').delete().eq('id', wishlistId);
    setItems((prev) => prev.filter((i) => i.id !== wishlistId));
  };

  const confirmRemove = (wishlistId: string) => {
    Alert.alert(
      locale === 'ar' ? 'إزالة من المفضلة' : 'Remove from Wishlist',
      locale === 'ar' ? 'هل تريد إزالة هذا المنتج؟' : 'Remove this product from your wishlist?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'إزالة' : 'Remove', style: 'destructive', onPress: () => removeItem(wishlistId) },
      ],
    );
  };

  if (!user) {
    return (
      <EmptyState
        icon={<Heart size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'سجل دخولك' : 'Sign in'}
        message={locale === 'ar' ? 'سجل دخولك لحفظ المنتجات المفضلة' : 'Sign in to save your favorite products'}
        actionLabel={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  if (loading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={100} style={{ borderRadius: radii.lg }} />
        ))}
      </View>
    );
  }

  if (items.length === 0) {
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

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      renderItem={({ item }) => {
        const product = item.products;
        const bestStore = product?.product_stores
          ?.sort((a: any, b: any) => a.current_price - b.current_price)[0];

        return (
          <Pressable
            onPress={() => router.push(`/(stack)/product/${product?.slug}`)}
            style={[styles.card, { backgroundColor: colors.card }]}
          >
            {product?.image_url && (
              <Image
                source={{ uri: product.image_url }}
                style={styles.image}
                contentFit="contain"
              />
            )}
            <View style={{ flex: 1, marginStart: spacing.md }}>
              <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600' }]} numberOfLines={2}>
                {locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name)}
              </Text>
              {bestStore && (
                <Price price={bestStore.current_price} locale={locale} size="sm" style={{ marginTop: 4 }} />
              )}
              {item.note && (
                <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]} numberOfLines={1}>
                  {item.note}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => confirmRemove(item.id)}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
  },
  deleteBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
