/**
 * Tab navigator with custom premium tab bar.
 *
 * HIG: 3-5 tabs, tab bar remains visible during navigation,
 * frosted blur background, animated pill indicator.
 *
 * key={locale} forces re-mount when language changes — ensures
 * all child screens get fresh RTL values without app restart.
 */

import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/src/components/navigation/CustomTabBar';
import { useLocale } from '@/src/lib/i18n/provider';

export default function TabLayout() {
  const { locale } = useLocale();

  return (
    <Tabs
      key={locale}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="deals" />
      <Tabs.Screen name="compare" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
