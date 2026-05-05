/**
 * Store Detail Screen
 *
 * Shows store info, rating, products, and policies.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Pressable, Linking, Modal } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Star, ExternalLink, MapPin, Globe, Store, Ticket, MessageSquare } from 'lucide-react-native';
import { useAuth } from '@/src/lib/auth/auth-context';
import { StoreReviewForm } from '@/src/components/store/StoreReviewForm';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { apiClient } from '@/src/lib/api/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, Badge, Skeleton } from '@/src/components/ui';
import { CouponBadge } from '@/src/components/ui/CouponBadge';

export default function StoreDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();

  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [storeCoupons, setStoreCoupons] = useState<any[]>([]);
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [reviewFormVisible, setReviewFormVisible] = useState(false);
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

      // Fetch store coupons
      try {
        const data = await apiClient.get<any>(`/api/coupons?store_id=${storeData.id}&limit=5`);
        const list = Array.isArray(data.data) ? data.data : Array.isArray(data.coupons) ? data.coupons : Array.isArray(data) ? data : [];
        setStoreCoupons(list);
      } catch {}

      // Fetch store reviews
      try {
        const { data: reviews } = await supabase
          .from('store_reviews')
          .select('*, users(full_name)')
          .eq('store_id', storeData.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setStoreReviews(reviews || []);
      } catch {}
    }
    setLoading(false);
  };

  const handleReviewSubmitted = useCallback(() => {
    setReviewFormVisible(false);
    // Reload reviews
    if (store) {
      supabase
        .from('store_reviews')
        .select('*, users(full_name)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => setStoreReviews(data || []));
    }
  }, [store?.id]);

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
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'رجوع' : 'Go back'} style={[styles.backBtn, { alignSelf: rtl.alignStart }]} hitSlop={8}>
            {rtl.isRTL ? <ArrowRight size={22} color={colors.label} /> : <ArrowLeft size={22} color={colors.label} />}
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.storeLogo} contentFit="contain" />
            ) : (
              <View style={[styles.storeLogo, { backgroundColor: colors.tertiaryFill, alignItems: 'center', justifyContent: 'center' }]}>
                <Store size={32} color={colors.tertiaryLabel} />
              </View>
            )}

            <Text style={[typography.title2, { color: colors.label, fontWeight: '700', marginTop: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? (store.name_ar || store.name) : (store.name_en || store.name)}
            </Text>

            {store.rating && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                <Star size={16} color={colors.systemYellow} fill={colors.systemYellow} />
                <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginLeft: 4 }]}>
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
                <Text style={[typography.subheadline, { color: colors.primary, marginLeft: 4 }]}>
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

        {/* Coupons */}
        {storeCoupons.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
              <Ticket size={16} color={colors.tertiary} />
              <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {locale === 'ar' ? 'كوبونات' : 'Coupons'}
              </Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              {storeCoupons.map((c: any) => (
                <CouponBadge key={c.id || c.code} coupon={c} variant="expanded" locale={locale} />
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: rtl.row, alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
              <MessageSquare size={16} color={colors.primary} />
              <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {locale === 'ar' ? 'التقييمات' : 'Reviews'} {storeReviews.length > 0 ? `(${storeReviews.length})` : ''}
              </Text>
            </View>
            {user && (
              <Pressable onPress={() => setReviewFormVisible(true)} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'كتابة تقييم' : 'Write a review'} style={[styles.writeReviewBtn, { backgroundColor: colors.primaryContainer }]}>
                <Star size={14} color={colors.primary} />
                <Text style={[typography.footnote, { color: colors.primary, fontWeight: '600' }]}>
                  {locale === 'ar' ? 'اكتب تقييم' : 'Write Review'}
                </Text>
              </Pressable>
            )}
          </View>

          {storeReviews.length === 0 ? (
            <Text style={[typography.body, { color: colors.tertiaryLabel, textAlign: 'center', paddingVertical: spacing.md }]}>
              {locale === 'ar' ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
            </Text>
          ) : (
            storeReviews.slice(0, 5).map((review: any) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        color={s <= (review.rating || 0) ? colors.systemYellow : colors.systemGray4}
                        fill={s <= (review.rating || 0) ? colors.systemYellow : 'none'}
                      />
                    ))}
                  </View>
                  {review.users?.full_name && (
                    <Text style={[typography.caption1, { color: colors.secondaryLabel, fontWeight: '500' }]}>
                      {review.users.full_name}
                    </Text>
                  )}
                </View>
                {review.comment && (
                  <Text style={[typography.body, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                    {review.comment}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

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
              style={[styles.productRow, { backgroundColor: colors.card, marginHorizontal: spacing.md, flexDirection: rtl.row }]}
            >
              {product.image_url && (
                <Image source={{ uri: product.image_url }} style={styles.productImage} contentFit="contain" />
              )}
              <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
                <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                  {locale === 'ar' ? (product.name_ar || product.name) : (product.name_en || product.name)}
                </Text>
                <Price price={ps.current_price} originalPrice={ps.original_price} locale={locale} size="sm" style={{ marginTop: 4 }} />
              </View>
            </Pressable>
          );
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Review Form Modal */}
      <Modal visible={reviewFormVisible} transparent animationType="slide">
        <View style={styles.reviewOverlay}>
          <StoreReviewForm
            storeId={store.id}
            userId={user?.id || ''}
            locale={locale}
            onSubmitted={handleReviewSubmitted}
            onCancel={() => setReviewFormVisible(false)}
          />
        </View>
      </Modal>
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
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  reviewCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
});
