/**
 * Tab navigator with custom premium tab bar.
 *
 * HIG: 3-5 tabs, tab bar remains visible during navigation,
 * frosted blur background, animated pill indicator.
 *
 * key={locale} forces re-mount when language changes — ensures
 * all child screens get fresh RTL values without app restart.
 *
 * Smooth tab transition: ShiftTransition so page content slides
 * and fades when switching tabs (matches native mockup feel).
 * Wrapper View with theme background prevents white flash in dark mode.
 */

import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TransitionPresets } from '@react-navigation/bottom-tabs';
import { CustomTabBar } from '@/src/components/navigation/CustomTabBar';
import { useLocale } from '@/src/lib/i18n/provider';
import { useTheme } from '@/src/lib/theme/theme-context';

export default function TabLayout() {
  const { locale } = useLocale();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        key={locale}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          ...TransitionPresets.ShiftTransition,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="deals" />
        <Tabs.Screen name="compare" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}
