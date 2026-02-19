/**
 * Stack navigator layout for push screens.
 * Used for product details, stores, wishlist, etc.
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { getFontFamily } from '@/src/lib/theme/typography';

export default function StackLayout() {
  const { colors } = useTheme();
  const { locale } = useLocale();

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
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="product/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="stores/index" options={{ title: locale === 'ar' ? 'المتاجر' : 'Stores' }} />
      <Stack.Screen name="store/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="wishlist" options={{ title: locale === 'ar' ? 'قائمة الأمنيات' : 'Wishlist' }} />
      <Stack.Screen name="notifications" options={{ title: locale === 'ar' ? 'الإشعارات' : 'Notifications' }} />
      <Stack.Screen name="price-alerts" options={{ title: locale === 'ar' ? 'تنبيهات الأسعار' : 'Price Alerts' }} />
      <Stack.Screen name="compare" options={{ title: locale === 'ar' ? 'المقارنة' : 'Compare' }} />
      <Stack.Screen name="settings" options={{ title: locale === 'ar' ? 'الإعدادات' : 'Settings' }} />
      <Stack.Screen name="edit-profile" options={{ title: locale === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile' }} />
    </Stack>
  );
}
