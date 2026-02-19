import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { typography, spacing } from '@/src/lib/theme/typography';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionTitle, actionLabel, onAction }: EmptyStateProps) {
  const buttonTitle = actionTitle || actionLabel;
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[typography.title3, { color: colors.label, fontWeight: '600', textAlign: 'center' }]}>
        {title}
      </Text>
      {message && (
        <Text
          style={[
            typography.body,
            { color: colors.secondaryLabel, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {message}
        </Text>
      )}
      {buttonTitle && onAction && (
        <Button
          title={buttonTitle}
          variant="tinted"
          onPress={onAction}
          style={{ marginTop: spacing.lg }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    marginBottom: spacing.md,
  },
});
