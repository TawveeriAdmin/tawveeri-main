/**
 * Card component following Apple HIG.
 *
 * HIG: Use cards to group related information.
 * - secondarySystemGroupedBackground for card surfaces
 * - Consistent corner radius (radii.lg = 14pt)
 * - Subtle shadow for elevation
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { radii, spacing } from '@/src/lib/theme/typography';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
  elevated?: boolean;
}

export function Card({ children, onPress, style, padding = 'md', elevated = true }: CardProps) {
  const { colors, isDark } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: elevated ? colors.cardElevated : colors.card,
    borderRadius: radii.lg,
    padding: spacing[padding],
    ...(elevated && !isDark
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 2,
        }
      : elevated && isDark
      ? {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.separator,
        }
      : {}),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          style,
        ]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
