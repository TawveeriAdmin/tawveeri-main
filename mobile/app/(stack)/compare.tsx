/**
 * Compare Screen
 *
 * HIG: Horizontal scroll with up to 4 product columns.
 * Dynamic spec rows, best price highlighting.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { X, Plus, BarChart3 } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { formatPrice } from '@/src/lib/utils';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, EmptyState } from '@/src/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - spacing.lg * 2) / 2.3;

export default function CompareScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const [products, setProducts] = useState<any[]>([]);

  // Collect spec keys from all products
  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specifications || p.specs || {})))
  );

  const bestPrices = products.map((p) => {
    const stores = p.product_stores || [];
    return stores.length > 0
      ? Math.min(...stores.map((s: any) => s.current_price || Infinity))
      : null;
  });
  const overallBest = bestPrices.filter(Boolean).length > 0
    ? Math.min(...bestPrices.filter((p): p is number => p !== null))
    : null;

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'لا توجد منتجات للمقارنة' : 'No products to compare'}
        message={locale === 'ar' ? 'أضف منتجات من صفحة المنتج' : 'Add products from the product page'}
        actionLabel={locale === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
        onAction={() => router.push('/(tabs)/search')}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Product columns (horizontal scroll) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {products.map((product, idx) => (
          <View key={product.id} style={[styles.column, { width: COLUMN_WIDTH }]}>
            {/* Remove button */}
            <Pressable
              onPress={() => setProducts((prev) => prev.filter((_, i) => i !== idx))}
              style={[styles.removeBtn, { backgroundColor: colors.tertiaryFill }]}
            >
              <X size={14} color={colors.secondaryLabel} />
            </Pressable>

            {/* Image */}
            {product.image_url && (
              <Image
                source={{ uri: product.image_url }}
                style={[styles.productImage, { backgroundColor: colors.tertiaryFill }]}
                contentFit="contain"
              />
            )}

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
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
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
                    const specs = p.specifications || p.specs || {};
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
