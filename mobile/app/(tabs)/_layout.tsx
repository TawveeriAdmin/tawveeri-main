/**
 * Tab navigator with custom premium tab bar.
 *
 * HIG: 3-5 tabs, tab bar remains visible during navigation,
 * frosted blur background, animated pill indicator.
 */

import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/src/components/navigation/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="deals" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
