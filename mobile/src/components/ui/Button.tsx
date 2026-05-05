/**
 * Button component following Apple HIG button guidelines.
 *
 * HIG:
 * - Minimum 44pt touch target
 * - Button roles: default, destructive, cancel
 * - Styles: borderedProminent (filled), bordered, borderless
 * - Start labels with verbs
 * - Use haptic feedback on press
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';

type ButtonVariant = 'filled' | 'tinted' | 'outlined' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonRole = 'default' | 'destructive' | 'cancel';

interface ButtonProps extends Omit<PressableProps, 'style' | 'role'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  role?: ButtonRole;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  variant = 'filled',
  size = 'md',
  role = 'default',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getBackgroundColor = (pressed: boolean): string => {
    if (disabled) return colors.quaternaryFill;

    const baseColors: Record<ButtonRole, string> = {
      default: colors.primary,
      destructive: colors.error,
      cancel: 'transparent',
    };

    if (variant === 'filled') {
      return pressed ? adjustAlpha(baseColors[role], 0.85) : baseColors[role];
    }
    if (variant === 'tinted') {
      return pressed
        ? adjustAlpha(baseColors[role], 0.15)
        : adjustAlpha(baseColors[role], 0.1);
    }
    if (variant === 'outlined') {
      return pressed ? adjustAlpha(baseColors[role], 0.08) : 'transparent';
    }
    return pressed ? colors.quaternaryFill : 'transparent';
  };

  const getTextColor = (): string => {
    if (disabled) return colors.tertiaryLabel;

    if (variant === 'filled') {
      return role === 'cancel' ? colors.primary : colors.onPrimary;
    }

    const textColors: Record<ButtonRole, string> = {
      default: colors.primary,
      destructive: colors.error,
      cancel: colors.primary,
    };
    return textColors[role];
  };

  const sizeConfig: Record<ButtonSize, { height: number; paddingH: number; text: TextStyle }> = {
    sm: { height: 36, paddingH: spacing.md, text: typography.subheadline },
    md: { height: MIN_TOUCH_TARGET, paddingH: spacing.lg, text: typography.body },
    lg: { height: 52, paddingH: spacing.xl, text: typography.headline },
  };

  const cfg = sizeConfig[size];

  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: cfg.height,
          paddingHorizontal: cfg.paddingH,
          backgroundColor: getBackgroundColor(pressed),
          borderRadius: radii.md,
          borderWidth: variant === 'outlined' ? StyleSheet.hairlineWidth : 0,
          borderColor: variant === 'outlined' ? getTextColor() : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            style={[
              cfg.text,
              { color: getTextColor(), fontWeight: variant === 'filled' ? '600' : '400' },
              icon ? { marginHorizontal: spacing.xs } : undefined,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </Pressable>
  );
}

function adjustAlpha(color: string, alpha: number): string {
  // Simple hex-to-rgba for solid colors
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
});
