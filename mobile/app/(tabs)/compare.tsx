/**
 * Compare Tab Screen
 *
 * HIG: Horizontal scroll with up to 4 product columns.
 * Dynamic spec rows, best price highlighting, store policy comparison.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, BarChart3, Trash2, Truck, RotateCcw, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useCompareStore, CompareProduct } from '@/src/lib/compare/compare-store';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, EmptyState, SARSymbol } from '@/src/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Large Title Header */}
      <View style={[styles.header, { flexDirection: rtl.row }]}>
        <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {locale === 'ar' ? 'المقارنة' : 'Compare'}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            clearAll();
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          hitSlop={8}
        >
          <Trash2 size={14} color={colors.error} />
          <Text style={[typography.footnote, { color: colors.error, fontWeight: '600' }]}>
            {locale === 'ar' ? 'مسح الكل' : 'Clear All'}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product count */}
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            {products.length} {locale === 'ar' ? 'منتجات' : 'products'}
          </Text>
        </View>

        {/* Product columns (horizontal scroll) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {products.map((product, idx) => (
            <View key={product.id} style={[styles.column, { width: COLUMN_WIDTH }]}>
              {/* Remove button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  removeProduct(product.id);
                }}
                style={[styles.removeBtn, { backgroundColor: colors.tertiaryFill }]}
              >
                <X size={14} color={colors.secondaryLabel} />
              </Pressable>

              {/* Image */}
              <Pressable onPress={() => router.push(`/(stack)/product/${product.slug}`)}>
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    style={[styles.productImage, { backgroundColor: colors.tertiaryFill }]}
                    contentFit="contain"
                  />
                ) : (
                  <View style={[styles.productImage, { backgroundColor: colors.tertiaryFill, alignItems: 'center', justifyContent: 'center' }]}>
                    <BarChart3 size={24} color={colors.tertiaryLabel} />
                  </View>
                )}
              </Pressable>

              {/* Name */}
              <Text style={[typography.caption1, { color: colors.label, fontWeight: '600', marginTop: spacing.sm, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                {locale === 'ar' ? (product.name_ar || product.name) : (product.name_en || product.name)}
              </Text>

              {/* Best Price */}
              {bestPrices[idx] !== null && (
                <View style={{ marginTop: spacing.xs }}>
                  <Price price={bestPrices[idx]!} locale={locale} size="sm" />
                  {bestPrices[idx] === overallBest && (
                    <Text style={[typography.caption2, { color: colors.systemGreen, fontWeight: '600' }]}>
                      {locale === 'ar' ? '✓ الأفضل' : '✓ Best'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}

          {/* Add product slot */}
          {products.length < 4 && (
            <Pressable
              onPress={() => router.push('/(tabs)/search')}
              style={[styles.addSlot, { width: COLUMN_WIDTH, borderColor: colors.separator }]}
            >
              <Plus size={24} color={colors.tertiaryLabel} />
              <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
                {locale === 'ar' ? 'إضافة' : 'Add'}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Spec comparison rows */}
        {allSpecKeys.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
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

        {/* Store Policy Comparison */}
        {products.some((p) => p.product_stores && p.product_stores.length > 0) && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? 'مقارنة المتاجر' : 'Store Comparison'}
            </Text>

            {/* Delivery Time */}
            <CompareInfoRow
              label={locale === 'ar' ? 'وقت التوصيل' : 'Delivery Time'}
              icon={<Truck size={14} color={colors.secondaryLabel} />}
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
            />

            {/* Shipping Cost */}
            <CompareInfoRow
              label={locale === 'ar' ? 'تكلفة الشحن' : 'Shipping Cost'}
              icon={<Truck size={14} color={colors.secondaryLabel} />}
              products={products}
              getValue={(p) => {
                const ps = p.product_stores?.[0];
                if (!ps) return '—';
                if (ps.is_free_delivery) return locale === 'ar' ? 'مجاني' : 'Free';
                if (ps.delivery_cost != null) return `${ps.delivery_cost}`;
                return '—';
              }}
              getHighlight={(p) => p.product_stores?.[0]?.is_free_delivery === true}
              showSymbol={(p) => {
                const ps = p.product_stores?.[0];
                return !!(ps && !ps.is_free_delivery && ps.delivery_cost != null);
              }}
              colors={colors}
            />

            {/* Warranty */}
            <CompareInfoRow
              label={locale === 'ar' ? 'الضمان' : 'Warranty'}
              icon={<Shield size={14} color={colors.secondaryLabel} />}
              products={products}
              getValue={(p) => {
                const store = p.product_stores?.[0]?.stores;
                if (!store) return '—';
                return (locale === 'ar' ? store.warranty_info_ar : store.warranty_info_en) || '—';
              }}
              colors={colors}
            />

            {/* Return Policy */}
            <CompareInfoRow
              label={locale === 'ar' ? 'سياسة الإرجاع' : 'Return Policy'}
              icon={<RotateCcw size={14} color={colors.secondaryLabel} />}
              products={products}
              getValue={(p) => {
                const store = p.product_stores?.[0]?.stores;
                if (!store) return '—';
                return (locale === 'ar' ? store.return_policy_ar : store.return_policy_en) || '—';
              }}
              colors={colors}
            />
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
}: {
  label: string;
  icon: React.ReactNode;
  products: CompareProduct[];
  getValue: (p: CompareProduct) => string;
  getHighlight?: (p: CompareProduct) => boolean;
  showSymbol?: (p: CompareProduct) => boolean;
  colors: any;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.separator }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 }}>
        {icon}
        <Text style={[typography.caption2, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {products.map((p) => {
            const value = getValue(p);
            const highlighted = getHighlight?.(p);
            const needsSymbol = showSymbol?.(p);
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', width: COLUMN_WIDTH - spacing.lg, gap: 3 }}>
                <Text
                  style={[
                    typography.caption1,
                    {
                      color: highlighted ? colors.systemGreen : colors.label,
                      fontWeight: highlighted ? '600' : '500',
                      flexShrink: 1,
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  column: {
    alignItems: 'center',
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
  },
  addSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 0.8,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
