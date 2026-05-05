import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useNetwork } from '@/src/lib/network/use-network';
import { typography, spacing, radii } from '@/src/lib/theme/typography';

export function OfflineBanner() {
  const { colors } = useTheme();
  const rtl = useRTL();
  const { isConnected } = useNetwork();
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isConnected ? -60 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  }, [isConnected]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.systemRed,
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={rtl.isRTL ? 'أنت غير متصل بالإنترنت' : 'You are offline'}
    >
      <View style={[styles.content, { flexDirection: rtl.row }]}>
        <WifiOff size={16} color="#fff" strokeWidth={2} />
        <Text style={[typography.footnote, { color: '#fff', fontWeight: '600', marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0 }]}>
          {rtl.isRTL ? 'أنت غير متصل' : "You're offline"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
