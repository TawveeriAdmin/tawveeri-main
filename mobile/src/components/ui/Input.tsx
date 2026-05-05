/**
 * Input component following Apple HIG.
 *
 * HIG:
 * - Use appropriate keyboard type
 * - Enable AutoFill with content types
 * - Minimum 44pt touch target
 * - Show placeholder text
 * - Support clear button
 */

import React, { forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  Pressable,
  I18nManager,
} from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, icon, clearable, onClear, style, value, ...props }, ref) => {
    const { colors } = useTheme();

    return (
      <View style={styles.container}>
        {label && (
          <Text
            style={[
              typography.subheadline,
              { color: colors.secondaryLabel, marginBottom: spacing.xs },
            ]}
          >
            {label}
          </Text>
        )}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.tertiaryFill,
              borderRadius: radii.md,
              borderWidth: error ? 1 : 0,
              borderColor: error ? colors.error : 'transparent',
            },
          ]}
        >
          {icon && <View style={styles.icon}>{icon}</View>}
          <TextInput
            ref={ref}
            value={value}
            placeholderTextColor={colors.tertiaryLabel}
            style={[
              typography.body,
              styles.input,
              {
                color: colors.label,
                textAlign: I18nManager.isRTL ? 'right' : 'left',
                writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
              },
              style,
            ]}
            {...props}
          />
          {clearable && value && value.length > 0 && (
            <Pressable
              onPress={onClear}
              hitSlop={8}
              style={styles.clearButton}
              accessibilityLabel="Clear"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.tertiaryLabel, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>
        {error && (
          <Text
            style={[
              typography.caption1,
              { color: colors.error, marginTop: spacing.xs },
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
  },
  icon: {
    marginEnd: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    marginStart: spacing.sm,
    padding: spacing.xs,
  },
});
