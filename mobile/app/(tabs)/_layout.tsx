/**
 * Tab navigator following Apple HIG tab bar guidelines.
 *
 * HIG:
 * - 3-5 tabs (max 5 visible)
 * - Use for navigation, NOT actions
 * - Tab bar remains visible during hierarchical navigation
 * - Fill variant when selected, outline when unselected
 * - Tab bar height: 49pt (portrait) + safe area
 */

import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useCartStore } from '@/src/lib/cart/cart-store';
import { Home, Search, Percent, ShoppingCart, User } from 'lucide-react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const t = useTranslations();
  const { locale } = useLocale();
  const cartItemCount = useCartStore((s) => s.getTotals().totalItems);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.systemGray,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 34 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          fontFamily: locale === 'ar' ? 'IBMPlexSansArabic_500Medium' : 'Inter_500Medium',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('nav.search'),
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: t('nav.deals'),
          tabBarIcon: ({ color, size }) => <Percent size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('nav.cart'),
          tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
