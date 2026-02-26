/**
 * CouponBadge — Native port of web's coupon-badge.tsx.
 * Two variants: compact (inline pill) and expanded (full card).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Clipboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ticket, Copy, Check, Clock } from 'lucide-react-native';
import { SARSymbol } from './SARSymbol';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { apiClient } from '@/src/lib/api/client';
import { typography, spacing, radii } from '@/src/lib/theme/typography';

interface CouponData {
  id?: string;
  code: string;
  description_ar?: string | null;
  description_en?: string | null;
  discount_type?: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value?: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  expires_at?: string | null;
  store_name_ar?: string;
  store_name_en?: string;
}

interface CouponBadgeProps {
  coupon: CouponData;
  variant?: 'compact' | 'expanded';
  locale: string;
}

function getDiscountLabel(coupon: CouponData, t: (key: string, params?: Record<string, string>) => string): string {
  if (!coupon.discount_type) return '';
  switch (coupon.discount_type) {
    case 'percentage':
      return t('coupons.discountPercentage', { value: String(coupon.discount_value ?? 0) });
    case 'fixed_amount':
      return t('coupons.discountFixed', { value: String(coupon.discount_value ?? 0) });
    case 'free_shipping':
      return t('coupons.freeShipping');
    default:
      return '';
  }
}

function getExpiryInfo(expiresAt: string | null | undefined, t: (key: string, params?: Record<string, string>) => string) {
  if (!expiresAt) return { label: t('coupons.noExpiry'), isExpired: false, isUrgent: false };

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return { label: t('coupons.expired'), isExpired: true, isUrgent: false };

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffDays <= 1) {
    return { label: t('coupons.expiresInHours', { hours: String(diffHours) }), isExpired: false, isUrgent: true };
  }
  return { label: t('coupons.expiresIn', { days: String(diffDays) }), isExpired: false, isUrgent: diffDays <= 3 };
}

export function CouponBadge({ coupon, variant = 'compact', locale }: CouponBadgeProps) {
  const { colors } = useTheme();
  const t = useTranslations();
  const rtl = useRTL();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    Clipboard.setString(coupon.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    // Track copy (fire-and-forget)
    if (coupon.id) apiClient.post(`/api/coupons/${coupon.id}/copy`, {}).catch(() => {});
    setTimeout(() => setCopied(false), 2000);
  };

  const discountLabel = getDiscountLabel(coupon, t);
  const description = locale === 'ar' ? coupon.description_ar : coupon.description_en;

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel={rtl.isRTL ? `كوبون ${coupon.code}` : `Coupon ${coupon.code}`}
        accessibilityHint={rtl.isRTL ? 'انقر لنسخ رمز الكوبون' : 'Tap to copy coupon code'}
        style={[styles.compact, { borderColor: colors.tertiary + '80', backgroundColor: colors.tertiary + '10' }]}>
        <Ticket size={12} color={colors.tertiary} />
        <Text style={[typography.caption2, { color: colors.tertiary, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
          {coupon.code}
        </Text>
        {discountLabel ? (
          <Text style={[typography.caption2, { color: colors.tertiary + 'CC', fontWeight: '500' }]}>
            {discountLabel}
          </Text>
        ) : null}
        {copied ? <Check size={12} color={colors.systemGreen} /> : <Copy size={12} color={colors.tertiaryLabel} />}
      </Pressable>
    );
  }

  // Expanded variant
  const expiryInfo = getExpiryInfo(coupon.expires_at, t);

  return (
    <Pressable
      onPress={handleCopy}
      accessibilityRole="button"
      accessibilityLabel={rtl.isRTL ? `كوبون ${coupon.code}` : `Coupon ${coupon.code}`}
      accessibilityHint={rtl.isRTL ? 'انقر لنسخ رمز الكوبون' : 'Tap to copy coupon code'}
      style={[styles.expanded, { borderColor: colors.tertiary + '50', backgroundColor: colors.tertiary + '08' }]}>
      {/* Discount + Expiry row */}
      <View style={[styles.expandedRow, { flexDirection: rtl.row }]}>
        <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs, flex: 1 }}>
          <Ticket size={14} color={colors.tertiary} />
          <Text style={[typography.subheadline, { color: colors.tertiary, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
            {discountLabel}
          </Text>
        </View>
        <View style={[
          styles.expiryBadge,
          {
            backgroundColor: expiryInfo.isExpired
              ? colors.error + '20'
              : expiryInfo.isUrgent
                ? colors.warning + '20'
                : colors.tertiaryFill,
          },
        ]}>
          {expiryInfo.isUrgent && <Clock size={10} color={colors.warning} />}
          <Text style={[typography.caption2, {
            color: expiryInfo.isExpired ? colors.error : expiryInfo.isUrgent ? colors.warning : colors.secondaryLabel,
            fontWeight: '500',
          }]}>
            {expiryInfo.label}
          </Text>
        </View>
      </View>

      {/* Code + Copy */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.tertiary + '40' }]}>
          <Text style={[typography.footnote, { color: colors.label, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 1 }]}>
            {coupon.code}
          </Text>
        </View>
        <Pressable
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={rtl.isRTL ? 'نسخ الكوبون' : 'Copy coupon'}
          accessibilityHint={rtl.isRTL ? 'انقر لنسخ رمز الكوبون' : 'Tap to copy coupon code'}
          style={[styles.copyBtn, { backgroundColor: colors.tertiary + '15' }]}>
          {copied ? <Check size={14} color={colors.systemGreen} /> : <Copy size={14} color={colors.tertiary} />}
        </Pressable>
      </View>

      {/* Description */}
      {description ? (
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
          {description}
        </Text>
      ) : null}

      {/* Min purchase / Max discount */}
      {(coupon.min_purchase || (coupon.max_discount && coupon.discount_type === 'percentage')) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          {coupon.min_purchase ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                {t('coupons.minPurchase')} {coupon.min_purchase}
              </Text>
              <SARSymbol size={8} color={colors.primary} />
            </View>
          ) : null}
          {coupon.max_discount && coupon.discount_type === 'percentage' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                ({t('coupons.maxDiscountAmount')}: {coupon.max_discount}
              </Text>
              <SARSymbol size={8} color={colors.primary} />
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>)</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  expanded: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  expandedRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  codeBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  copyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
