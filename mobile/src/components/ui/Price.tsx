/**
 * Price display component with SAR currency.
 * Matches web's <Price> component behavior.
 * Uses tabular-nums for proper number alignment per HIG.
 */

import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { formatPrice, calculateSavingsPercentage } from '@/src/lib/utils';
import { typography, spacing } from '@/src/lib/theme/typography';

export interface PriceProps {
  price: number;
  originalPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showSavings?: boolean;
  locale?: string;
  style?: any;
}

export function Price({ price, originalPrice, size = 'md', showSavings = true, style }: PriceProps) {
  const { colors } = useTheme();
  const { locale } = useLocale();

  const sizeConfig: Record<string, { price: TextStyle; currency: TextStyle; original: TextStyle }> = {
    sm: {
      price: { ...typography.subheadline, fontWeight: '600' },
      currency: typography.caption1,
      original: typography.caption2,
    },
    md: {
      price: { ...typography.headline },
      currency: typography.footnote,
      original: typography.caption1,
    },
    lg: {
      price: { ...typography.title2, fontWeight: '700' },
      currency: typography.callout,
      original: typography.subheadline,
    },
  };

  const cfg = sizeConfig[size];
  const hasSavings = originalPrice && originalPrice > price;
  const savingsPercent = hasSavings ? calculateSavingsPercentage(originalPrice, price) : 0;
  const currency = locale === 'ar' ? 'ر.س' : 'SAR';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.priceRow}>
        <Text
          style={[cfg.price, { color: colors.label, fontVariant: ['tabular-nums'] }]}
          accessibilityLabel={`${formatPrice(price)} ${currency}`}
        >
          {formatPrice(price)}
        </Text>
        <Text style={[cfg.currency, { color: colors.secondaryLabel, marginStart: 4 }]}>
          {currency}
        </Text>
      </View>

      {hasSavings && (
        <View style={styles.savingsRow}>
          <Text
            style={[
              cfg.original,
              {
                color: colors.priceOriginal,
                textDecorationLine: 'line-through',
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {formatPrice(originalPrice)}
          </Text>
          {showSavings && savingsPercent > 0 && (
            <Text
              style={[
                typography.caption2,
                {
                  color: colors.priceSavings,
                  fontWeight: '600',
                  marginStart: spacing.xs,
                },
              ]}
            >
              -{savingsPercent}%
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
});
