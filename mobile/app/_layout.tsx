/**
 * Root Layout
 *
 * Provider hierarchy (matches web, adapted for mobile):
 * IntlProvider > ThemeProvider > AuthProvider > Navigation
 *
 * Fonts: Inter (English) + IBM Plex Sans Arabic loaded via expo-font.
 *
 * RTL: Native I18nManager is DISABLED. All RTL is handled in JS
 * via the useRTL() hook. key={locale} on Stack forces re-mount
 * on language switch — no app restart needed.
 */

import { useEffect } from 'react';
import { I18nManager, DevSettings, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  IBMPlexSansArabic_300Light,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import 'react-native-reanimated';

import { IntlProvider, useLocale } from '@/src/lib/i18n/provider';
import { ThemeProvider } from '@/src/lib/theme/theme-context';
import { AuthProvider } from '@/src/lib/auth/auth-context';
import * as Linking from 'expo-linking';
import { usePushNotifications } from '@/src/lib/notifications/use-push-notifications';
import { useDeepLinkHandler } from '@/src/lib/linking/use-deep-links';
import { OfflineBanner } from '@/src/components/ui/OfflineBanner';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Disable native RTL completely — we handle RTL in JavaScript via useRTL hook.
// forceRTL(false) persists the value but only takes effect after a reload.
// If a previous session had forceRTL(true), isRTL will still be true until
// we reload. The one-time reload below handles this transition.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

if (I18nManager.isRTL) {
  // Previous session had native RTL enabled — reload once so forceRTL(false) takes effect.
  // After reload, I18nManager.isRTL will be false and this block won't execute again.
  if (__DEV__ && DevSettings?.reload) {
    DevSettings.reload();
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexSansArabic_300Light,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <IntlProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
              <Toast />
            </AuthProvider>
          </ThemeProvider>
        </IntlProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Inner component that can use auth-dependent hooks. */
function AppContent() {
  usePushNotifications();
  useDeepLinkHandler();
  const { locale } = useLocale();

  return (
    <>
      <OfflineBanner />
      <Stack key={locale} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(auth)"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="(stack)" />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
