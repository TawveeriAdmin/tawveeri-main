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
 */

import { Tabs } from 'expo-router';
import { TransitionPresets } from '@react-navigation/bottom-tabs';
import { CustomTabBar } from '@/src/components/navigation/CustomTabBar';
import { useLocale } from '@/src/lib/i18n/provider';

export default function TabLayout() {
  const { locale } = useLocale();

  return (
    <Tabs
      key={locale}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        ...TransitionPresets.ShiftTransition,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="deals" />
      <Tabs.Screen name="compare" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
