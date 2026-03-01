/**
 * Compare Tab Screen
 *
 * UI structure: sticky header (title + subtitle + Clear All), horizontal product carousel
 * with card styling and Best Value badge, Store Comparison card.
 * Keeps all existing compare logic and components.
 */

import React, { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, BarChart3, Trash2, Truck, RotateCcw, Shield, Store, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useCompareStore, CompareProduct } from '@/src/lib/compare/compare-store';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Price, EmptyState, SARSymbol, KeyedProductImage } from '@/src/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = spacing.lg;
const CARD_WIDTH = 192;
const COLUMN_WIDTH = (SCREEN_WIDTH - spacing.lg * 2) / 2.3;

export default function CompareScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const products = useCompareStore((s) => s.products);
  const removeProduct = useCompareStore((s) => s.removeProduct);
  const clearAll = useCompareStore((s) => s.clearAll);

  // Collect spec keys from all products
  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specifications || {})))
  );

  const bestPrices = products.map((p) => {
    const stores = p.product_stores || [];
    return stores.length > 0
      ? Math.min(...stores.map((s) => s.current_price || Infinity))
      : null;
  });
  const overallBest = bestPrices.filter(Boolean).length > 0
    ? Math.min(...bestPrices.filter((p): p is number => p !== null))
    : null;

  if (products.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
          <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {locale === 'ar' ? 'المقارنة' : 'Compare'}
          </Text>
        </View>
        <EmptyState
          icon={<BarChart3 size={48} color={colors.tertiaryLabel} />}
          title={locale === 'ar' ? 'لا توجد منتجات للمقارنة' : 'No products to compare'}
          message={locale === 'ar' ? 'أضف منتجات من صفحة المنتج' : 'Add products from the product page'}
          actionLabel={locale === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
          onAction={() => router.push('/(tabs)/search')}
        />
      </SafeAreaView>
    );
  }

  const scrollRef = useRef<ScrollView>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header (mock: px-6 pt-8 pb-4, title + subtitle, Clear All) */}
      <View style={[styles.stickyHeader, { flexDirection: rtl.row, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {locale === 'ar' ? 'المقارنة' : 'Compare'}
          </Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {products.length} {locale === 'ar' ? 'منتجات محددة' : 'products selected'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            clearAll();
          }}
          style={[styles.clearAllBtn, { flexDirection: rtl.row }]}
          hitSlop={8}
        >
          <Trash2 size={16} color={colors.error} />
          <Text style={[typography.footnote, { color: colors.error, fontWeight: '600' }]}>
            {locale === 'ar' ? 'مسح الكل' : 'Clear All'}
          </Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainContent}>
        {/* Horizontal product carousel (mock: gap-4 px-6 py-6, cards rounded-3xl, Add Product dashed) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {products.map((product, idx) => {
            const isBestValue = bestPrices[idx] !== null && bestPrices[idx] === overallBest;
            return (
              <View key={product.id} style={[styles.productCard, { width: CARD_WIDTH, backgroundColor: colors.secondaryGroupedBackground, borderColor: isBestValue ? colors.brandAccent + '80' : colors.separator, borderWidth: isBestValue ? 2 : 1 }]}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeProduct(product.id);
                  }}
                  style={[styles.removeBtn, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, ...(rtl.isRTL ? { right: undefined, left: -8 } : { right: -8 }) }]}
                >
                  <X size={16} color={colors.secondaryLabel} />
                </Pressable>

                <Pressable onPress={() => router.push(`/(stack)/product/${product.slug}`)}>
                  {product.image_url ? (
                    <KeyedProductImage uri={product.image_url} style={[styles.productImage, { backgroundColor: colors.tertiaryFill }]} contentFit="contain" />
                  ) : (
                    <View style={[styles.productImage, { backgroundColor: colors.tertiaryFill, alignItems: 'center', justifyContent: 'center' }]}>
                      <BarChart3 size={24} color={colors.tertiaryLabel} />
                    </View>
                  )}
                </Pressable>

                <Text style={[styles.productTitle, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                  {locale === 'ar' ? (product.name_ar || product.name) : (product.name_en || product.name)}
                </Text>

                <View style={[styles.priceRow, { flexDirection: rtl.row }]}>
                  {bestPrices[idx] !== null ? (
                    <Price price={bestPrices[idx]!} locale={locale} size="sm" />
                  ) : (
                    <Text style={[typography.footnote, { color: colors.tertiaryLabel }]}>—</Text>
                  )}
                  {isBestValue && (
                    <View style={[styles.bestValueBadge, { backgroundColor: colors.brandAccent + '1A', flexDirection: rtl.row }]}>
                      <CheckCircle size={10} color={colors.brandAccent} strokeWidth={2.5} />
                      <Text style={[styles.bestValueBadgeText, { color: colors.brandAccent }]}>
                        {locale === 'ar' ? 'الأفضل قيمة' : 'Best Value'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {products.length < 4 && (
            <Pressable
              onPress={() => router.push('/(tabs)/search')}
              style={[styles.addSlot, { width: CARD_WIDTH, borderColor: colors.separator, backgroundColor: colors.secondaryGroupedBackground + '4D' }]}
            >
              <View style={[styles.addSlotCircle, { backgroundColor: colors.tertiaryFill }]}>
                <BarChart3 size={20} color={colors.secondaryLabel} />
              </View>
              <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '500', marginTop: spacing.sm }]}>
                {locale === 'ar' ? 'إضافة منتج' : 'Add Product'}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Store Comparison card */}
        {products.some((p) => p.product_stores && p.product_stores.length > 0) && (
          <View style={[styles.storeCard, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
            <View style={[styles.storeCardTitleRow, { flexDirection: rtl.row }]}>
              <View style={[styles.storeCardIconBox, { backgroundColor: `${colors.primary}18` }]}>
                <Store size={20} color={colors.primary} />
              </View>
              <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {locale === 'ar' ? 'مقارنة المتاجر' : 'Store Comparison'}
              </Text>
            </View>

            <View style={styles.storeRows}>
              <CompareInfoRow
                label={locale === 'ar' ? 'وقت التوصيل' : 'Delivery'}
                icon={<Truck size={16} color={colors.secondaryLabel} />}
                products={products}
                getValue={(p) => {
                  const ps = p.product_stores?.[0];
                  if (!ps) return '—';
                  if (ps.delivery_time_days != null) {
                    return locale === 'ar' ? `${ps.delivery_time_days} يوم` : `${ps.delivery_time_days} days`;
                  }
                  return '—';
                }}
                colors={colors}
                cardColumnWidth={COLUMN_WIDTH}
              />
              <View style={[styles.storeRowDivider, { backgroundColor: colors.separator }]} />
              <CompareInfoRow
                label={locale === 'ar' ? 'الشحن' : 'Shipping'}
                icon={<Truck size={16} color={colors.secondaryLabel} />}
                products={products}
                getValue={(p) => {
                  const ps = p.product_stores?.[0];
                  if (!ps) return '—';
                  if (ps.is_free_delivery) return locale === 'ar' ? 'مجاني' : 'Free';
                  if (ps.delivery_cost != null) return `${ps.delivery_cost} SAR`;
                  return '—';
                }}
                getHighlight={(p) => p.product_stores?.[0]?.is_free_delivery === true}
                showSymbol={(p) => {
                  const ps = p.product_stores?.[0];
                  return !!(ps && !ps.is_free_delivery && ps.delivery_cost != null);
                }}
                colors={colors}
                cardColumnWidth={COLUMN_WIDTH}
              />
              <View style={[styles.storeRowDivider, { backgroundColor: colors.separator }]} />
              <CompareInfoRow
                label={locale === 'ar' ? 'الضمان' : 'Warranty'}
                icon={<Shield size={16} color={colors.secondaryLabel} />}
                products={products}
                getValue={(p) => {
                  const store = p.product_stores?.[0]?.stores;
                  if (!store) return '—';
                  return (locale === 'ar' ? store.warranty_info_ar : store.warranty_info_en) || '—';
                }}
                colors={colors}
                cardColumnWidth={COLUMN_WIDTH}
              />
              <View style={[styles.storeRowDivider, { backgroundColor: colors.separator }]} />
              <CompareInfoRow
                label={locale === 'ar' ? 'الإرجاع' : 'Return'}
                icon={<RotateCcw size={16} color={colors.secondaryLabel} />}
                products={products}
                getValue={(p) => {
                  const store = p.product_stores?.[0]?.stores;
                  if (!store) return '—';
                  return (locale === 'ar' ? store.return_policy_ar : store.return_policy_en) || '—';
                }}
                colors={colors}
                cardColumnWidth={COLUMN_WIDTH}
              />
            </View>
          </View>
        )}

        {/* Spec comparison rows */}
        {allSpecKeys.length > 0 && (
          <View style={styles.specSection}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? 'مقارنة المواصفات' : 'Spec Comparison'}
            </Text>
            {allSpecKeys.map((key) => (
              <View key={key} style={[styles.specRow, { borderBottomColor: colors.separator }]}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, width: 80 }]} numberOfLines={1}>
                  {key}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {products.map((p) => {
                      const specs = p.specifications || {};
                      return (
                        <Text
                          key={p.id}
                          style={[typography.caption1, { color: colors.label, width: COLUMN_WIDTH - spacing.lg, fontWeight: '500' }]}
                          numberOfLines={1}
                        >
                          {specs[key] ? String(specs[key]) : '—'}
                        </Text>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CompareInfoRow({
  label,
  icon,
  products,
  getValue,
  getHighlight,
  showSymbol,
  colors,
  cardColumnWidth,
}: {
  label: string;
  icon: React.ReactNode;
  products: CompareProduct[];
  getValue: (p: CompareProduct) => string;
  getHighlight?: (p: CompareProduct) => boolean;
  showSymbol?: (p: CompareProduct) => boolean;
  colors: any;
  cardColumnWidth?: number;
}) {
  const rtl = useRTL();
  const colWidth = cardColumnWidth ?? COLUMN_WIDTH;
  return (
    <View style={[styles.infoRow, { flexDirection: rtl.row, borderBottomWidth: 0 }]}>
      <View style={[styles.infoRowLabel, { flexDirection: rtl.row }]}>
        {icon}
        <Text style={[typography.caption2, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={[styles.infoRowValues, { flexDirection: rtl.row }]}>
        {products.map((p) => {
          const value = getValue(p);
          const highlighted = getHighlight?.(p);
          const needsSymbol = showSymbol?.(p);
          return (
            <View key={p.id} style={{ flexDirection: rtl.row, alignItems: 'center', width: colWidth, gap: 3, flex: 1 }}>
              <Text
                style={[
                  typography.footnote,
                  {
                    color: highlighted ? colors.brandAccent : colors.label,
                    fontWeight: highlighted ? '700' : '500',
                    flexShrink: 1,
                    textAlign: rtl.textAlign,
                    writingDirection: rtl.writingDirection,
                  },
                ]}
                numberOfLines={2}
              >
                {value}
              </Text>
              {needsSymbol && <SARSymbol size={9} color={colors.primary} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mainContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 0,
    paddingBottom: 100,
  },
  carouselContent: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  productCard: {
    padding: spacing.md,
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.xl,
    marginBottom: 12,
    overflow: 'hidden',
  },
  productTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 8,
    minHeight: 32,
  },
  priceRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  bestValueBadge: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestValueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addSlot: {
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  addSlotCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCard: {
    borderRadius: 32,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  storeCardTitleRow: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  storeCardIconBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  storeRows: {},
  storeRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  specSection: {
    marginBottom: spacing.lg,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoRowLabel: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 100,
    minWidth: 100,
  },
  infoRowValues: {
    flex: 1,
    gap: spacing.sm,
  },
});
