/**
 * Store Detail Screen
 *
 * Shows store info, rating, products, and policies.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, ExternalLink, MapPin, Globe, Store } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, Badge, Skeleton } from '@/src/components/ui';

export default function StoreDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { locale } = useLocale();

  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) loadStore();
  }, [slug]);

  const loadStore = async () => {
    setLoading(true);
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();

    if (storeData) {
      setStore(storeData);
      const { data: prods } = await supabase
        .from('product_stores')
        .select('*, products(*)')
        .eq('store_id', storeData.id)
        .order('current_price', { ascending: true })
        .limit(20);
      setProducts(prods || []);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg }}>
          <Skeleton width={64} height={64} style={{ borderRadius: 32 }} />
          <Skeleton width="60%" height={24} style={{ marginTop: spacing.md, borderRadius: radii.sm }} />
          <Skeleton width="100%" height={100} style={{ marginTop: spacing.lg, borderRadius: radii.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!store) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={22} color={colors.label} />
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.storeLogo} contentFit="contain" />
            ) : (
              <View style={[styles.storeLogo, { backgroundColor: colors.tertiaryFill, alignItems: 'center', justifyContent: 'center' }]}>
                <Store size={32} color={colors.tertiaryLabel} />
              </View>
            )}

            <Text style={[typography.title2, { color: colors.label, fontWeight: '700', marginTop: spacing.md }]}>
              {locale === 'ar' ? (store.name_ar || store.name) : (store.name_en || store.name)}
            </Text>

            {store.rating && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                <Star size={16} color={colors.systemYellow} fill={colors.systemYellow} />
                <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginStart: 4 }]}>
                  {store.rating} {store.review_count ? `(${store.review_count})` : ''}
                </Text>
              </View>
            )}

            {store.website_url && (
              <Pressable
                onPress={() => Linking.openURL(store.website_url)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}
              >
                <Globe size={14} color={colors.primary} />
                <Text style={[typography.subheadline, { color: colors.primary, marginStart: 4 }]}>
                  {locale === 'ar' ? 'زيارة الموقع' : 'Visit Website'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Description */}
        {store.description && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>
              {locale === 'ar' ? (store.description_ar || store.description) : (store.description_en || store.description)}
            </Text>
          </View>
        )}

        {/* Products */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.md }]}>
            {locale === 'ar' ? 'المنتجات' : 'Products'} ({products.length})
          </Text>
        </View>

        {products.map((ps) => {
          const product = ps.products;
          if (!product) return null;
          return (
            <Pressable
              key={ps.id}
              onPress={() => router.push(`/(stack)/product/${product.slug}`)}
              style={[styles.productRow, { backgroundColor: colors.card, marginHorizontal: spacing.md }]}
            >
              {product.image_url && (
                <Image source={{ uri: product.image_url }} style={styles.productImage} contentFit="contain" />
              )}
              <View style={{ flex: 1, marginStart: spacing.md }}>
                <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600' }]} numberOfLines={2}>
                  {locale === 'ar' ? (product.name_ar || product.name) : (product.name_en || product.name)}
                </Text>
                <Price price={ps.current_price} originalPrice={ps.original_price} locale={locale} size="sm" style={{ marginTop: 4 }} />
              </View>
            </Pressable>
          );
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
  },
});
