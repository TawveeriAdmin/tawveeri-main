import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { typography, spacing, radii } from '@/src/lib/theme/typography';

type BadgeVariant = 'filled' | 'tinted' | 'outlined';
type BadgeColor = 'primary' | 'error' | 'success' | 'warning' | 'deal';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  text?: string;
  label?: string;
  variant?: BadgeVariant;
  color?: BadgeColor | string;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({ text, label, variant = 'filled', color = 'primary', size = 'md', style }: BadgeProps) {
  const displayText = text || label || '';
  const resolvedColor: BadgeColor = (
    color === 'primary' || color === 'error' || color === 'success' || color === 'warning' || color === 'deal'
  ) ? color : 'primary';
  const { colors } = useTheme();

  const colorMap: Record<BadgeColor, { bg: string; text: string; border: string }> = {
    primary: { bg: colors.primary, text: colors.onPrimary, border: colors.primary },
    error: { bg: colors.error, text: colors.onError, border: colors.error },
    success: { bg: colors.success, text: colors.onSuccess, border: colors.success },
    warning: { bg: colors.warning, text: colors.onWarning, border: colors.warning },
    deal: { bg: colors.deal, text: colors.onTertiary, border: colors.deal },
  };

  const scheme = colorMap[resolvedColor];

  const containerStyle: ViewStyle = {
    backgroundColor: variant === 'filled' ? scheme.bg : variant === 'tinted' ? `${scheme.bg}20` : 'transparent',
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: scheme.border,
    borderRadius: radii.full,
    paddingHorizontal: size === 'sm' ? spacing.xs : spacing.sm,
    paddingVertical: size === 'sm' ? 1 : 2,
  };

  const textColor = variant === 'filled' ? scheme.text : scheme.bg;
  const textStyle = size === 'sm' ? typography.caption2 : typography.caption2;

  return (
    <View style={[containerStyle, style]}>
      <Text style={[textStyle, { color: textColor, fontWeight: '600' }]}>
        {displayText}
      </Text>
    </View>
  );
}

// Numeric badge for tab bar / notification counts
export function NumericBadge({ count, style }: { count: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  if (count <= 0) return null;

  const text = count > 99 ? '99+' : String(count);

  return (
    <View
      style={[
        {
          backgroundColor: colors.error,
          borderRadius: radii.full,
          minWidth: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        },
        style,
      ]}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
