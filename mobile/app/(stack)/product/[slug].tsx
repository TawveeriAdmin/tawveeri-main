/**
 * Product Detail Screen
 *
 * HIG: Large title, horizontal image gallery with pagination dots,
 * action bar with primary button, tabbed content area.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, FlatList,
  Dimensions, ActivityIndicator, Share, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, Heart, ShoppingCart, Share2, Bell, ExternalLink,
  Star, ChevronRight, Check, Minus, Plus,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { apiClient } from '@/src/lib/api/client';
import { useCartStore } from '@/src/lib/cart/cart-store';
import { formatPrice, calculateSavingsPercentage } from '@/src/lib/utils';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Badge, Price, Skeleton } from '@/src/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75;

type ContentTab = 'specs' | 'reviews' | 'history';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>('specs');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (slug) loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      // Fetch product with stores
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!prod) { router.back(); return; }
      setProduct(prod);

      // Track view
      apiClient.post(`/api/products/${prod.id}/view`, {}).catch(() => {});

      // Fetch store prices
      const { data: storeData } = await supabase
        .from('product_stores')
        .select('*, stores(*)')
        .eq('product_id', prod.id)
        .order('current_price', { ascending: true });
      setStores(storeData || []);

      // Fetch reviews
      const { data: reviewData } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', prod.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setReviews(reviewData || []);

      // Check wishlist
      if (user) {
        const { data: wish } = await supabase
          .from('user_wishlists')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', prod.id)
          .maybeSingle();
        setIsWishlisted(!!wish);
      }
    } catch {
      // Fail silently, show empty
    } finally {
      setLoading(false);
    }
  };

  const bestPrice = stores[0]?.current_price;
  const originalPrice = product?.original_price || stores[0]?.original_price;
  const savings = originalPrice && bestPrice ? calculateSavingsPercentage(originalPrice, bestPrice) : 0;

  const images = product?.images?.length
    ? product.images
    : product?.image_url
      ? [product.image_url]
      : [];

  const toggleWishlist = async () => {
    if (!user) { router.push('/(auth)/login'); return; }
    setWishlistLoading(true);
    try {
      if (isWishlisted) {
        await supabase
          .from('user_wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        setIsWishlisted(false);
      } else {
        await supabase
          .from('user_wishlists')
          .insert({ user_id: user.id, product_id: product.id });
        setIsWishlisted(true);
      }
    } catch {
      // Fail silently
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `${product.name} - ${formatPrice(bestPrice)} SAR\nhttps://tawveeri.com/product/${slug}`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleAddToCart = () => {
    if (!product || !stores[0]) return;
    const store = stores[0];
    addItem({
      productId: product.id,
      productName: product.name || product.name_en || '',
      productSlug: product.slug,
      storeId: store.store_id || store.stores?.id,
      storeName: store.stores?.name || store.stores?.name_en || 'Store',
      price: store.current_price,
      imageUrl: product.image_url,
      quantity: 1,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg }}>
          <Skeleton width={SCREEN_WIDTH - spacing.lg * 2} height={IMAGE_HEIGHT} style={{ borderRadius: radii.lg }} />
          <Skeleton width="70%" height={24} style={{ marginTop: spacing.md, borderRadius: radii.sm }} />
          <Skeleton width="40%" height={20} style={{ marginTop: spacing.sm, borderRadius: radii.sm }} />
          <Skeleton width="100%" height={60} style={{ marginTop: spacing.lg, borderRadius: radii.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) return null;

  const tabs: { key: ContentTab; label: string }[] = [
    { key: 'specs', label: locale === 'ar' ? 'المواصفات' : 'Specs' },
    { key: 'reviews', label: locale === 'ar' ? 'التقييمات' : 'Reviews' },
    { key: 'history', label: locale === 'ar' ? 'سجل الأسعار' : 'Price History' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                    contentFit="contain"
                    transition={200}
                  />
                )}
              />
              {images.length > 1 && (
                <View style={styles.pagination}>
                  {images.map((_: string, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: i === activeImageIndex ? colors.primary : colors.tertiaryLabel },
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.tertiaryFill }]}>
              <Text style={[typography.title1, { color: colors.tertiaryLabel }]}>📷</Text>
            </View>
          )}

          {/* Floating nav buttons */}
          <Pressable
            onPress={() => router.back()}
            style={[styles.floatingButton, { position: 'absolute', top: spacing.sm, ...(rtl.isRTL ? { right: spacing.sm } : { left: spacing.sm }), backgroundColor: colors.background + 'DD' }]}
            hitSlop={8}
          >
            {rtl.isRTL ? <ArrowRight size={22} color={colors.label} /> : <ArrowLeft size={22} color={colors.label} />}
          </Pressable>
          <View style={[styles.floatingActions, rtl.isRTL ? { left: spacing.sm, right: undefined } : {}]}>
            <Pressable
              onPress={handleShare}
              style={[styles.floatingButton, { backgroundColor: colors.background + 'DD' }]}
              hitSlop={8}
            >
              <Share2 size={20} color={colors.label} />
            </Pressable>
          </View>
        </View>

        {/* Product Info */}
        <View style={{ padding: spacing.lg }}>
          {/* Brand + Category */}
          {(product.brand || product.category) && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              {product.brand && <Badge label={product.brand} variant="tinted" />}
              {product.category && <Badge label={product.category} variant="outlined" />}
            </View>
          )}

          {/* Name */}
          <Text style={[typography.title2, { color: colors.label, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {locale === 'ar' ? (product.name_ar || product.name) : (product.name_en || product.name)}
          </Text>

          {/* Rating */}
          {product.rating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Star size={16} color={colors.systemYellow} fill={colors.systemYellow} />
              <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginLeft: 4 }]}>
                {product.rating} {product.review_count ? `(${product.review_count})` : ''}
              </Text>
            </View>
          )}

          {/* Price */}
          <View style={{ marginTop: spacing.md }}>
            <Price
              price={bestPrice}
              originalPrice={originalPrice}
              locale={locale}
              size="lg"
            />
            {savings > 0 && (
              <Badge
                label={locale === 'ar' ? `وفر ${Math.round(savings)}%` : `Save ${Math.round(savings)}%`}
                color={colors.systemGreen}
                style={{ marginTop: spacing.xs }}
              />
            )}
          </View>

          {/* Action Bar */}
          <View style={[styles.actionBar, { borderColor: colors.separator }]}>
            <Pressable
              onPress={handleAddToCart}
              style={[styles.primaryAction, { backgroundColor: colors.primary }]}
            >
              <ShoppingCart size={18} color="#fff" />
              <Text style={[typography.headline, { color: '#fff', marginLeft: spacing.sm }]}>
                {locale === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleWishlist}
              style={[styles.iconAction, { backgroundColor: colors.secondaryBackground }]}
              disabled={wishlistLoading}
            >
              <Heart
                size={22}
                color={isWishlisted ? colors.systemPink : colors.secondaryLabel}
                fill={isWishlisted ? colors.systemPink : 'none'}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (!user) { router.push('/(auth)/login'); return; }
                // Navigate to create alert
              }}
              style={[styles.iconAction, { backgroundColor: colors.secondaryBackground }]}
            >
              <Bell size={22} color={colors.secondaryLabel} />
            </Pressable>
          </View>
        </View>

        {/* Store Prices */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.md }]}>
            {locale === 'ar' ? 'مقارنة الأسعار' : 'Compare Prices'}
          </Text>
          {stores.map((ps, idx) => (
            <StorePriceCard
              key={ps.id || idx}
              productStore={ps}
              isBest={idx === 0}
              colors={colors}
              locale={locale}
            />
          ))}
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { borderColor: colors.separator, marginTop: spacing.xl }]}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[
                styles.tab,
                activeTab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text
                style={[
                  typography.subheadline,
                  {
                    color: activeTab === t.key ? colors.primary : colors.secondaryLabel,
                    fontWeight: activeTab === t.key ? '600' : '400',
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          {activeTab === 'specs' && <SpecsTab product={product} colors={colors} locale={locale} />}
          {activeTab === 'reviews' && <ReviewsTab reviews={reviews} colors={colors} locale={locale} />}
          {activeTab === 'history' && <HistoryTab productId={product.id} colors={colors} locale={locale} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

function StorePriceCard({ productStore, isBest, colors, locale }: {
  productStore: any; isBest: boolean; colors: any; locale: string;
}) {
  const store = productStore.stores;
  const openStore = () => {
    const url = productStore.affiliate_url || productStore.product_url;
    if (url) Linking.openURL(url);
  };

  return (
    <Pressable
      onPress={openStore}
      style={[
        styles.storeCard,
        {
          backgroundColor: colors.card,
          borderColor: isBest ? colors.primary : colors.separator,
          borderWidth: isBest ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {store?.logo_url && (
            <Image source={{ uri: store.logo_url }} style={{ width: 24, height: 24, borderRadius: 4 }} />
          )}
          <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600' }]}>
            {locale === 'ar' ? (store?.name_ar || store?.name) : (store?.name_en || store?.name)}
          </Text>
          {isBest && (
            <Badge
              label={locale === 'ar' ? 'أفضل سعر' : 'Best Price'}
              color={colors.primary}
              size="sm"
            />
          )}
        </View>
        {productStore.availability_status && (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
            {productStore.availability_status === 'in_stock'
              ? (locale === 'ar' ? 'متوفر' : 'In Stock')
              : (locale === 'ar' ? 'غير متوفر' : 'Out of Stock')}
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Price price={productStore.current_price} locale={locale} size="md" />
        <ExternalLink size={14} color={colors.tertiaryLabel} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

function SpecsTab({ product, colors, locale }: { product: any; colors: any; locale: string }) {
  const specs = product.specifications || product.specs || {};
  const specEntries = Object.entries(specs);

  if (specEntries.length === 0) {
    return (
      <Text style={[typography.body, { color: colors.tertiaryLabel, textAlign: 'center' }]}>
        {locale === 'ar' ? 'لا توجد مواصفات متوفرة' : 'No specifications available'}
      </Text>
    );
  }

  return (
    <View style={[styles.specsContainer, { backgroundColor: colors.card, borderRadius: radii.lg }]}>
      {specEntries.map(([key, value], idx) => (
        <View
          key={key}
          style={[
            styles.specRow,
            idx < specEntries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
          ]}
        >
          <Text style={[typography.subheadline, { color: colors.secondaryLabel, flex: 1 }]}>{key}</Text>
          <Text style={[typography.subheadline, { color: colors.label, flex: 1.5, fontWeight: '500' }]}>
            {String(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReviewsTab({ reviews, colors, locale }: { reviews: any[]; colors: any; locale: string }) {
  if (reviews.length === 0) {
    return (
      <Text style={[typography.body, { color: colors.tertiaryLabel, textAlign: 'center' }]}>
        {locale === 'ar' ? 'لا توجد تقييمات' : 'No reviews yet'}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {reviews.map((review) => (
        <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
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
            <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
              {new Date(review.created_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </Text>
          </View>
          {review.reviewer_name && (
            <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600', marginTop: 4 }]}>
              {review.reviewer_name}
            </Text>
          )}
          {review.comment && (
            <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: 4 }]}>
              {review.comment}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function HistoryTab({ productId, colors, locale }: { productId: string; colors: any; locale: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('price_history')
        .select('*, stores(name, name_ar, name_en)')
        .eq('product_id', productId)
        .order('recorded_at', { ascending: false })
        .limit(50);
      setHistory(data || []);
      setLoading(false);
    })();
  }, [productId]);

  if (loading) return <ActivityIndicator color={colors.primary} />;

  if (history.length === 0) {
    return (
      <Text style={[typography.body, { color: colors.tertiaryLabel, textAlign: 'center' }]}>
        {locale === 'ar' ? 'لا يوجد سجل أسعار' : 'No price history available'}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {history.map((h, i) => (
        <View
          key={h.id || i}
          style={[
            styles.historyRow,
            { backgroundColor: colors.card },
            i < history.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.subheadline, { color: colors.label }]}>
              {locale === 'ar' ? (h.stores?.name_ar || h.stores?.name) : (h.stores?.name_en || h.stores?.name)}
            </Text>
            <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
              {new Date(h.recorded_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </Text>
          </View>
          <Price price={h.price} locale={locale} size="sm" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  imagePlaceholder: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    gap: spacing.xs,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  iconAction: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  specsContainer: {
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  reviewCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
  },
});
