/**
 * Price display component with SAR currency symbol (SVG).
 * Matches web's <Price> component behavior.
 * Uses tabular-nums for proper number alignment per HIG.
 */

import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { formatPrice, calculateSavingsPercentage } from '@/src/lib/utils';
import { typography, spacing } from '@/src/lib/theme/typography';
import { SARSymbol } from './SARSymbol';

export interface PriceProps {
  price: number;
  originalPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showSavings?: boolean;
  locale?: string;
  style?: any;
}

const SYMBOL_SIZE: Record<string, number> = {
  sm: 12,
  md: 14,
  lg: 18,
};

export function Price({ price, originalPrice, size = 'md', showSavings = true, style }: PriceProps) {
  const { colors } = useTheme();
  const { locale } = useLocale();

  const sizeConfig: Record<string, { price: TextStyle; original: TextStyle }> = {
    sm: {
      price: { ...typography.subheadline, fontWeight: '600' },
      original: typography.caption2,
    },
    md: {
      price: { ...typography.headline },
      original: typography.caption1,
    },
    lg: {
      price: { ...typography.title2, fontWeight: '700' },
      original: typography.subheadline,
    },
  };

  const cfg = sizeConfig[size];
  const hasSavings = originalPrice && originalPrice > price;
  const savingsPercent = hasSavings ? calculateSavingsPercentage(originalPrice, price) : 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.priceRow}>
        <Text
          style={[cfg.price, { color: colors.label, fontVariant: ['tabular-nums'] }]}
          accessibilityLabel={`${formatPrice(price)} SAR`}
        >
          {formatPrice(price)}
        </Text>
        <View style={styles.symbolWrap}>
          <SARSymbol size={SYMBOL_SIZE[size]} color={colors.primary} />
        </View>
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
    alignItems: 'center',
  },
  symbolWrap: {
    marginLeft: 4,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
});
