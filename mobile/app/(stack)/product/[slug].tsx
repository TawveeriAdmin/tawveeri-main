/**
 * Product Detail Screen
 *
 * HIG: Large title, horizontal image gallery with pagination dots,
 * action bar with primary button, tabbed content area.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, FlatList,
  Dimensions, ActivityIndicator, Share, Linking, Modal, TextInput, Switch,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, Heart, ShoppingCart, Share2, Bell, ExternalLink,
  Star, ChevronRight, Check, Minus, Plus, BarChart3, Truck, TrendingDown, TrendingUp, Gift, X, Copy,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { apiClient } from '@/src/lib/api/client';
import { formatDate } from '@/src/lib/formatting';
import { useCartStore } from '@/src/lib/cart/cart-store';
import { useCompareStore } from '@/src/lib/compare/compare-store';
import { formatPrice, calculateSavingsPercentage } from '@/src/lib/utils';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Badge, Price, Skeleton, SARSymbol, KeyedProductImage } from '@/src/components/ui';
import { CouponBadge } from '@/src/components/ui/CouponBadge';
import { ProductVideoPlayer } from '@/src/components/product/ProductVideoPlayer';

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
  const addToCompare = useCompareStore((s) => s.addProduct);
  const removeFromCompare = useCompareStore((s) => s.removeProduct);
  const isInCompare = useCompareStore((s) => s.isInCompare);

  const [product, setProduct] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ContentTab>('specs');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [giftWrapping, setGiftWrapping] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  useEffect(() => {
    if (slug) loadProduct();
  }, [slug]);

  // Load coupons for this product
  useEffect(() => {
    if (!product) return;
    (async () => {
      try {
        const data = await apiClient.get<any>(`/api/coupons?product_id=${product.id}&limit=3`);
        const list = Array.isArray(data.data) ? data.data : Array.isArray(data.coupons) ? data.coupons : Array.isArray(data) ? data : [];
        setCoupons(list);
      } catch {}
    })();
  }, [product?.id]);

  // Load recommendations after product loads
  useEffect(() => {
    if (!product) return;
    (async () => {
      setRecsLoading(true);
      try {
        const { data } = await supabase.rpc('get_recommendations', {
          p_product_id: product.id,
          p_user_id: user?.id ?? null,
          p_type: 'auto',
          p_limit: 6,
        });
        if (data && data.length > 0) {
          // Enrich with product_stores for price display
          const ids = data.map((r: any) => r.id);
          const { data: enriched } = await supabase
            .from('products')
            .select('id, name_ar, name_en, slug, image_urls, brand, product_stores(id, current_price, original_price, store_id)')
            .in('id', ids)
            .eq('is_active', true);
          setRecommendations(enriched || []);
        }
      } catch {
        // Fallback: same category products
        try {
          const { data: fallback } = await supabase
            .from('products')
            .select('id, name_ar, name_en, slug, image_urls, brand, product_stores(id, current_price, original_price, store_id)')
            .eq('category', product.category)
            .eq('is_active', true)
            .neq('id', product.id)
            .order('view_count', { ascending: false })
            .limit(6);
          setRecommendations(fallback || []);
        } catch {}
      } finally {
        setRecsLoading(false);
      }
    })();
  }, [product?.id]);

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
        message: `${product.name} - ${formatPrice(bestPrice)} SAR\nhttps://tawveeri.com/product/${slug}`, // SAR text kept for plain-text share
      });
    } catch {
      // User cancelled
    }
  };

  const inCompare = product ? isInCompare(product.id) : false;

  const toggleCompare = () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inCompare) {
      removeFromCompare(product.id);
    } else {
      const added = addToCompare({
        id: product.id,
        name_ar: product.name_ar,
        name_en: product.name_en,
        name: product.name,
        slug: product.slug,
        image_url: product.image_url || product.image_urls?.[0],
        brand: product.brand,
        category: product.category,
        specifications: product.specifications || product.specs,
        product_stores: stores.map((ps: any) => ({
          id: ps.id,
          current_price: ps.current_price,
          original_price: ps.original_price,
          store_id: ps.store_id,
          delivery_time_days: ps.delivery_time_days,
          delivery_cost: ps.delivery_cost,
          is_free_delivery: ps.is_free_delivery,
          stores: ps.stores ? {
            ...ps.stores,
            delivery_info_ar: ps.stores.delivery_info_ar,
            delivery_info_en: ps.stores.delivery_info_en,
            return_policy_ar: ps.stores.return_policy_ar,
            return_policy_en: ps.stores.return_policy_en,
            warranty_info_ar: ps.stores.warranty_info_ar,
            warranty_info_en: ps.stores.warranty_info_en,
          } : undefined,
        })),
      });
      if (!added) {
        // Max reached — already 4 products
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
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

  const handleGiftShare = async () => {
    const productName = locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name);
    const url = `https://tawveeri.com/product/${slug}`;
    const msg = giftMessage.trim()
      ? `${locale === 'ar' ? 'هدية لك!' : 'A gift for you!'}\n\n${giftMessage}\n\n${productName}\n${url}`
      : `${locale === 'ar' ? 'هدية لك!' : 'A gift for you!'}\n\n${productName}\n${url}`;
    try {
      await Share.share({ message: msg });
    } catch {}
    setGiftModalVisible(false);
  };

  const handleGiftCopyLink = async () => {
    const url = `https://tawveeri.com/product/${slug}`;
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGiftModalVisible(false);
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
                renderItem={({ item, index }) => (
                  <KeyedProductImage
                    uri={item}
                    style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                    contentFit="contain"
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
            accessibilityRole="button"
            accessibilityLabel={locale === 'ar' ? 'رجوع' : 'Go back'}
            style={[styles.floatingButton, { position: 'absolute', top: spacing.sm, ...(rtl.isRTL ? { right: spacing.sm } : { left: spacing.sm }), backgroundColor: colors.background + 'DD' }]}
            hitSlop={8}
          >
            {rtl.isRTL ? <ArrowRight size={22} color={colors.label} /> : <ArrowLeft size={22} color={colors.label} />}
          </Pressable>
          <View style={[styles.floatingActions, rtl.isRTL ? { left: spacing.sm, right: undefined } : {}]}>
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'مشاركة المنتج' : 'Share product'}
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
          </View>

          {/* Coupons */}
          {coupons.length > 0 && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {coupons.slice(0, 2).map((c: any) => (
                <CouponBadge key={c.id || c.code} coupon={c} variant="compact" locale={locale} />
              ))}
              {coupons.length > 2 && (
                <Pressable onPress={() => router.push('/(stack)/coupons')}>
                  <Text style={[typography.caption1, { color: colors.primary, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                    {locale === 'ar' ? `عرض الكل (${coupons.length})` : `See all (${coupons.length})`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Product Video */}
          {product.video_url && (
            <ProductVideoPlayer
              videoUrl={product.video_url}
              thumbnailUrl={product.image_urls?.[0] || product.image_url}
            />
          )}

          {/* Action Bar */}
          <View style={[styles.actionBar, { borderColor: colors.separator }]}>
            <Pressable
              onPress={handleAddToCart}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
              style={[styles.primaryAction, { backgroundColor: colors.primary }]}
            >
              <ShoppingCart size={18} color="#fff" />
              <Text style={[typography.subheadline, { color: '#fff', fontWeight: '600', marginLeft: spacing.sm }]}>
                {locale === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleWishlist}
              accessibilityRole="button"
              accessibilityLabel={isWishlisted ? (locale === 'ar' ? 'إزالة من المفضلة' : 'Remove from wishlist') : (locale === 'ar' ? 'إضافة إلى المفضلة' : 'Add to wishlist')}
              style={[styles.iconAction, { backgroundColor: isWishlisted ? '#FEE2E2' : colors.secondaryBackground }]}
              disabled={wishlistLoading}
            >
              <Heart
                size={20}
                color={isWishlisted ? colors.systemRed : colors.secondaryLabel}
                fill={isWishlisted ? colors.systemRed : 'none'}
              />
            </Pressable>

            <Pressable
              onPress={toggleCompare}
              accessibilityRole="button"
              accessibilityLabel={inCompare ? (locale === 'ar' ? 'إزالة من المقارنة' : 'Remove from compare') : (locale === 'ar' ? 'إضافة إلى المقارنة' : 'Add to compare')}
              style={[styles.iconAction, { backgroundColor: inCompare ? colors.primaryContainer : colors.secondaryBackground }]}
            >
              <BarChart3
                size={20}
                color={inCompare ? colors.primary : colors.secondaryLabel}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (!user) { router.push('/(auth)/login'); return; }
                // Navigate to create alert
              }}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'تنبيه السعر' : 'Price alert'}
              style={[styles.iconAction, { backgroundColor: colors.secondaryBackground }]}
            >
              <Bell size={20} color={colors.secondaryLabel} />
            </Pressable>

            <Pressable
              onPress={() => setGiftModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ar' ? 'إرسال كهدية' : 'Send as gift'}
              style={[styles.iconAction, { backgroundColor: colors.secondaryBackground }]}
            >
              <Gift size={20} color={colors.secondaryLabel} />
            </Pressable>
          </View>
        </View>

        {/* Store Prices */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
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

        {/* Similar Products */}
        {recommendations.length > 0 && (
          <View style={{ marginTop: spacing.xl, paddingTop: spacing.md }}>
            <View style={[styles.recHeader, { flexDirection: rtl.row }]}>
              <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs }}>
                <Star size={16} color={colors.primary} />
                <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                  {locale === 'ar' ? 'منتجات مشابهة' : 'Similar Products'}
                </Text>
              </View>
            </View>
            <FlashList
              data={recommendations}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
              ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
              keyExtractor={(item) => item.id}
              estimatedItemSize={140}
              renderItem={({ item: rec }) => {
                const name = locale === 'ar' ? rec.name_ar : rec.name_en;
                const image = rec.image_urls?.[0];
                const ps = rec.product_stores || [];
                const bestP = ps.map((s: any) => s.current_price).filter(Boolean).sort((a: number, b: number) => a - b)[0];
                return (
                  <Pressable
                    onPress={() => router.push(`/(stack)/product/${rec.slug}`)}
                    style={[styles.recCard, { backgroundColor: colors.card }]}
                  >
                    <View style={[styles.recImageWrap, { backgroundColor: colors.secondaryBackground }]}>
                      {image ? (
                        <KeyedProductImage uri={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Star size={20} color={colors.tertiaryLabel} />
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={2} style={[typography.caption1, { color: colors.label, marginTop: spacing.xs, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                      {name}
                    </Text>
                    {bestP && <Price price={bestP} locale={locale} size="sm" style={{ marginTop: 2 }} />}
                  </Pressable>
                );
              }}
            />
          </View>
        )}

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

      {/* Gift Modal */}
      <Modal visible={giftModalVisible} transparent animationType="slide">
        <View style={styles.giftOverlay}>
          <View style={[styles.giftSheet, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={[typography.title3, { color: colors.label, fontWeight: '600' }]}>
                {locale === 'ar' ? 'إرسال كهدية' : 'Send as Gift'}
              </Text>
              <Pressable onPress={() => setGiftModalVisible(false)} hitSlop={8}>
                <X size={22} color={colors.secondaryLabel} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={[typography.body, { color: colors.label }]}>
                {locale === 'ar' ? 'تغليف هدية' : 'Gift Wrapping'}
              </Text>
              <Switch
                value={giftWrapping}
                onValueChange={setGiftWrapping}
                trackColor={{ false: colors.systemGray4, true: colors.systemGreen }}
                thumbColor="#fff"
              />
            </View>

            <TextInput
              value={giftMessage}
              onChangeText={setGiftMessage}
              placeholder={locale === 'ar' ? 'اكتب رسالة للمستلم...' : 'Write a message for the recipient...'}
              placeholderTextColor={colors.tertiaryLabel}
              multiline
              numberOfLines={3}
              style={[
                typography.body,
                {
                  color: colors.label,
                  backgroundColor: colors.secondaryBackground,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  minHeight: 80,
                  textAlignVertical: 'top',
                  marginBottom: spacing.lg,
                },
              ]}
            />

            <Pressable onPress={handleGiftShare} style={[styles.giftBtn, { backgroundColor: colors.primary }]}>
              <Share2 size={18} color="#fff" />
              <Text style={[typography.headline, { color: '#fff', marginLeft: spacing.sm }]}>
                {locale === 'ar' ? 'مشاركة كهدية' : 'Share as Gift'}
              </Text>
            </Pressable>

            <Pressable onPress={handleGiftCopyLink} style={[styles.giftBtn, { backgroundColor: colors.secondaryBackground, marginTop: spacing.sm }]}>
              <Copy size={18} color={colors.primary} />
              <Text style={[typography.headline, { color: colors.primary, marginLeft: spacing.sm }]}>
                {locale === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

  const storeName = locale === 'ar' ? (store?.name_ar || store?.name) : (store?.name_en || store?.name);
  return (
    <Pressable
      onPress={openStore}
      accessibilityRole="button"
      accessibilityLabel={locale === 'ar' ? `عرض في ${storeName}` : `View at ${storeName}`}
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
        {/* Delivery info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {productStore.is_free_delivery && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.systemGreen + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Truck size={11} color={colors.systemGreen} />
              <Text style={[typography.caption2, { color: colors.systemGreen, fontWeight: '600' }]}>
                {locale === 'ar' ? 'توصيل مجاني' : 'Free Delivery'}
              </Text>
            </View>
          )}
          {!productStore.is_free_delivery && productStore.delivery_cost != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Truck size={11} color={colors.secondaryLabel} />
              <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
                {productStore.delivery_cost} <SARSymbol size={10} color={colors.primary} />
              </Text>
            </View>
          )}
          {productStore.delivery_time_days != null && (
            <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
              {locale === 'ar' ? `${productStore.delivery_time_days} يوم` : `${productStore.delivery_time_days} days`}
            </Text>
          )}
        </View>
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
              {formatDate(review.created_at, locale)}
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
        .order('recorded_at', { ascending: true })
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

  // Prepare chart data
  const prices = history.map((h) => h.price).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const trendPercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isDown = trendPercent < 0;

  const chartData = history.map((h, i) => ({
    x: i,
    y: h.price || 0,
    date: h.recorded_at,
  }));

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // Last 5 entries (most recent)
  const recentHistory = [...history].reverse().slice(0, 5);

  return (
    <View style={{ gap: spacing.md }}>
      {/* Trend summary */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: isDown ? colors.systemGreen + '12' : colors.systemRed + '12', borderRadius: radii.md }}>
        {isDown ? (
          <TrendingDown size={18} color={colors.systemGreen} />
        ) : (
          <TrendingUp size={18} color={trendPercent > 0 ? colors.systemRed : colors.secondaryLabel} />
        )}
        <Text style={[typography.subheadline, { color: isDown ? colors.systemGreen : trendPercent > 0 ? colors.systemRed : colors.secondaryLabel, fontWeight: '600' }]}>
          {isDown
            ? (locale === 'ar' ? `انخفض ${Math.abs(trendPercent).toFixed(1)}%` : `Down ${Math.abs(trendPercent).toFixed(1)}%`)
            : trendPercent > 0
              ? (locale === 'ar' ? `ارتفع ${trendPercent.toFixed(1)}%` : `Up ${trendPercent.toFixed(1)}%`)
              : (locale === 'ar' ? 'مستقر' : 'Stable')}
        </Text>
        <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
          {locale === 'ar' ? `آخر ${history.length} تسجيل` : `Last ${history.length} records`}
        </Text>
      </View>

      {/* Price Chart */}
      {chartData.length >= 2 && (
        <View style={{ height: 200, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.sm, overflow: 'hidden' }}>
          <PriceChart data={chartData} colors={colors} minPrice={minPrice} maxPrice={maxPrice} />
        </View>
      )}

      {/* Min/Max labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
            {locale === 'ar' ? 'أقل سعر' : 'Lowest'}
          </Text>
          <Text style={[typography.headline, { color: colors.systemGreen, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
            {formatPrice(minPrice)} <SARSymbol size={12} color={colors.primary} />
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
            {locale === 'ar' ? 'أعلى سعر' : 'Highest'}
          </Text>
          <Text style={[typography.headline, { color: colors.systemRed, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
            {formatPrice(maxPrice)} <SARSymbol size={12} color={colors.primary} />
          </Text>
        </View>
      </View>

      {/* Recent entries list */}
      {recentHistory.length > 0 && (
        <View>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
            {locale === 'ar' ? 'آخر التحديثات' : 'Recent Updates'}
          </Text>
          {recentHistory.map((h, i) => (
            <View
              key={h.id || i}
              style={[
                styles.historyRow,
                { backgroundColor: colors.card },
                i < recentHistory.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.subheadline, { color: colors.label }]}>
                  {locale === 'ar' ? (h.stores?.name_ar || h.stores?.name) : (h.stores?.name_en || h.stores?.name)}
                </Text>
                <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
                  {formatDate(h.recorded_at, locale)}
                </Text>
              </View>
              <Price price={h.price} locale={locale} size="sm" />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PriceChart({ data, colors, minPrice, maxPrice }: {
  data: { x: number; y: number; date: string }[];
  colors: any;
  minPrice: number;
  maxPrice: number;
}) {
  // Lazy import to avoid crashes if skia isn't available
  try {
    const { CartesianChart, Line, Area } = require('victory-native');
    const padding = (maxPrice - minPrice) * 0.1 || 10;
    return (
      <CartesianChart
        data={data}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [minPrice - padding, maxPrice + padding] }}
        axisOptions={{
          font: null,
          tickCount: { x: 4, y: 4 },
          formatXLabel: (val: number) => {
            const entry = data[Math.round(val)];
            if (!entry) return '';
            const d = new Date(entry.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          },
          formatYLabel: (val: number) => `${Math.round(val)}`,
          labelColor: colors.tertiaryLabel,
          lineColor: colors.separator,
        }}
      >
        {({ points, chartBounds }: any) => (
          <>
            <Area
              points={points.y}
              y0={chartBounds.bottom}
              color={colors.primary}
              opacity={0.1}
              curveType="natural"
              animate={{ type: 'timing', duration: 500 }}
            />
            <Line
              points={points.y}
              color={colors.primary}
              strokeWidth={2}
              curveType="natural"
              animate={{ type: 'timing', duration: 500 }}
            />
          </>
        )}
      </CartesianChart>
    );
  } catch {
    // Fallback if victory-native/skia not available
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
          Chart unavailable
        </Text>
      </View>
    );
  }
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
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: spacing.lg,
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  recHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  recCard: {
    width: 150,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  recImageWrap: {
    width: '100%',
    height: 100,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  giftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  giftSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  giftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
  },
});
