/**
 * Custom Tab Bar
 *
 * Clean tab bar with colored active state, frosted blur background,
 * haptic feedback, and bilingual support.
 *
 * HIG: SF-style blur, 49pt content height, semantic tint colors,
 * filled icon when active, outline when inactive.
 */

import React, { useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Home, Search, Percent, ShoppingCart, User,
} from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useCartStore } from '@/src/lib/cart/cart-store';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 60;
const BOTTOM_PADDING = Platform.OS === 'ios' ? 28 : 8;

const TAB_CONFIG = [
  { name: 'index', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
  { name: 'search', icon: Search, label_ar: 'البحث', label_en: 'Search' },
  { name: 'deals', icon: Percent, label_ar: 'العروض', label_en: 'Deals' },
  { name: 'cart', icon: ShoppingCart, label_ar: 'السلة', label_en: 'Cart' },
  { name: 'profile', icon: User, label_ar: 'حسابي', label_en: 'Profile' },
];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const rtl = useRTL();
  const locale = rtl.locale;
  const cartItemCount = useCartStore((s) => s.getTotals().totalItems);

  const scaleAnims = useRef(
    TAB_CONFIG.map(() => new Animated.Value(1))
  ).current;

  const handlePress = (index: number, routeName: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented && state.index !== index) {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Animated.sequence([
        Animated.timing(scaleAnims[index], {
          toValue: 0.8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnims[index], {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 300,
        }),
      ]).start();

      navigation.navigate(routeName);
    }
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blur}>
        <View style={[styles.topBorder, { backgroundColor: colors.separator }]} />

        <View style={[styles.tabRow, { flexDirection: rtl.row }]}>
          {state.routes.map((route, index) => {
            const config = TAB_CONFIG[index];
            if (!config) return null;

            const isFocused = state.index === index;
            const IconComponent = config.icon;
            const label = locale === 'ar' ? config.label_ar : config.label_en;
            const tint = isFocused ? colors.primary : colors.systemGray;
            const showBadge = config.name === 'cart' && cartItemCount > 0;

            return (
              <Pressable
                key={route.key}
                onPress={() => handlePress(index, route.name)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label}
              >
                <Animated.View
                  style={[
                    styles.iconWrap,
                    { transform: [{ scale: scaleAnims[index] }] },
                  ]}
                >
                  <IconComponent
                    size={22}
                    color={tint}
                    strokeWidth={isFocused ? 2.3 : 1.6}
                  />
                  {showBadge && (
                    <View style={[styles.badge, { backgroundColor: colors.systemRed }]}>
                      <Text style={styles.badgeText}>
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                <Text
                  style={[
                    styles.label,
                    {
                      color: tint,
                      fontWeight: isFocused ? '600' : '400',
                      fontFamily: locale === 'ar'
                        ? 'IBMPlexSansArabic_500Medium'
                        : 'Inter_500Medium',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blur: {
    height: TAB_BAR_HEIGHT,
    paddingBottom: BOTTOM_PADDING,
    overflow: 'hidden',
  },
  topBorder: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  label: {
    fontSize: 10,
  },
});
