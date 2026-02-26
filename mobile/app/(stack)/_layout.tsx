/**
 * Stack navigator layout for push screens.
 * Used for product details, stores, wishlist, etc.
 *
 * Since native I18nManager RTL is disabled, the header doesn't
 * auto-flip. We manually place the back button on the correct
 * side: headerRight for RTL, headerLeft for LTR.
 */

import { Pressable, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { getFontFamily } from '@/src/lib/theme/typography';

export default function StackLayout() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();

  const BackButton = () => {
    const Icon = rtl.isRTL ? ChevronRight : ChevronLeft;
    return (
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={24} color={colors.primary} strokeWidth={2} />
      </Pressable>
    );
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: getFontFamily(locale, '600'),
          fontSize: 17,
          color: colors.label,
        },
        headerBackTitle: '',
        headerBackVisible: false,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        ...(rtl.isRTL
          ? { headerLeft: () => null, headerRight: () => <BackButton /> }
          : { headerLeft: () => <BackButton /> }),
      }}
    >
      <Stack.Screen name="product/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="stores/index" options={{ title: locale === 'ar' ? 'المتاجر' : 'Stores' }} />
      <Stack.Screen name="store/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="wishlist" options={{ title: locale === 'ar' ? 'قائمة الأمنيات' : 'Wishlist' }} />
      <Stack.Screen
        name="notifications"
        options={{
          title: locale === 'ar' ? 'الإشعارات' : 'Notifications',
          presentation: 'formSheet',
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(120,120,128,0.2)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} color={colors.secondaryLabel} strokeWidth={2.5} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="price-alerts" options={{ title: locale === 'ar' ? 'تنبيهات الأسعار' : 'Price Alerts' }} />
      <Stack.Screen name="cart" options={{ title: locale === 'ar' ? 'السلة' : 'Cart' }} />
      <Stack.Screen name="settings" options={{ title: locale === 'ar' ? 'الإعدادات' : 'Settings' }} />
      <Stack.Screen name="edit-profile" options={{ title: locale === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile' }} />
      <Stack.Screen name="coupons" options={{ title: locale === 'ar' ? 'كوبونات' : 'Coupons' }} />
    </Stack>
  );
}
