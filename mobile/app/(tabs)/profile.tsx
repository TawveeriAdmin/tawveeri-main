/**
 * Profile / Dashboard Screen
 *
 * HIG: Use .insetGrouped list style for settings-like rows.
 * Shows user info if authenticated, login prompt otherwise.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Heart, Bell, TrendingDown, Settings, LogOut, LogIn,
  ChevronRight, Search, BarChart3, Shield,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button, Card } from '@/src/components/ui';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const { user, loading, signOut } = useAuth();

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = locale === 'ar'
    ? (hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء الخير')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

  if (!user && !loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <User size={64} color={colors.tertiaryLabel} />
          <Text style={[typography.title2, { color: colors.label, fontWeight: '600', marginTop: spacing.lg, textAlign: 'center' }]}>
            {locale === 'ar' ? 'مرحباً بك في توفيري' : 'Welcome to Tawveeri'}
          </Text>
          <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: spacing.sm, textAlign: 'center' }]}>
            {locale === 'ar' ? 'سجل دخولك لتتبع الأسعار وإنشاء التنبيهات' : 'Sign in to track prices and create alerts'}
          </Text>
          <Button
            title={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            onPress={() => router.push('/(auth)/login')}
            icon={<LogIn size={18} color="#fff" />}
            style={{ marginTop: spacing.xl }}
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Greeting + Avatar */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[typography.title1, { color: colors.primary }]}>
              {user?.full_name?.charAt(0)?.toUpperCase() || '👤'}
            </Text>
          </View>
          <View style={{ flex: 1, marginStart: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{greeting}</Text>
            <Text style={[typography.title3, { color: colors.label, fontWeight: '600' }]}>
              {user?.full_name || (locale === 'ar' ? 'مستخدم' : 'User')}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { icon: Search, label_ar: 'بحث', label_en: 'Search', route: '/(tabs)/search' },
            { icon: Heart, label_ar: 'المفضلة', label_en: 'Wishlist', route: '/(stack)/wishlist' },
            { icon: TrendingDown, label_ar: 'التنبيهات', label_en: 'Alerts', route: '/(stack)/price-alerts' },
            { icon: Bell, label_ar: 'الإشعارات', label_en: 'Notifications', route: '/(stack)/notifications' },
          ].map((action) => (
            <Pressable
              key={action.route}
              onPress={() => router.push(action.route as any)}
              style={[styles.quickAction, { backgroundColor: colors.secondaryBackground }]}
            >
              <action.icon size={22} color={colors.primary} />
              <Text style={[typography.caption1, { color: colors.label, marginTop: 4 }]}>
                {locale === 'ar' ? action.label_ar : action.label_en}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Menu Rows */}
        <View style={[styles.menuGroup, { backgroundColor: colors.card }]}>
          <MenuRow
            icon={<Heart size={20} color={colors.systemPink} />}
            label={locale === 'ar' ? 'قائمة الأمنيات' : 'Wishlist'}
            onPress={() => router.push('/(stack)/wishlist')}
            colors={colors}
          />
          <MenuRow
            icon={<TrendingDown size={20} color={colors.systemGreen} />}
            label={locale === 'ar' ? 'تنبيهات الأسعار' : 'Price Alerts'}
            onPress={() => router.push('/(stack)/price-alerts')}
            colors={colors}
          />
          <MenuRow
            icon={<Bell size={20} color={colors.systemBlue} />}
            label={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
            onPress={() => router.push('/(stack)/notifications')}
            colors={colors}
          />
          <MenuRow
            icon={<BarChart3 size={20} color={colors.systemIndigo} />}
            label={locale === 'ar' ? 'المقارنات' : 'Compare'}
            onPress={() => router.push('/(stack)/compare')}
            colors={colors}
            last
          />
        </View>

        <View style={[styles.menuGroup, { backgroundColor: colors.card, marginTop: spacing.lg }]}>
          <MenuRow
            icon={<Settings size={20} color={colors.systemGray} />}
            label={locale === 'ar' ? 'الإعدادات' : 'Settings'}
            onPress={() => router.push('/(stack)/settings')}
            colors={colors}
          />
          <MenuRow
            icon={<LogOut size={20} color={colors.systemRed} />}
            label={locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
            onPress={signOut}
            colors={colors}
            destructive
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress, colors, destructive, last }: {
  icon: React.ReactNode; label: string; onPress: () => void;
  colors: any; destructive?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
        pressed && { backgroundColor: colors.quaternaryFill },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {icon}
        <Text style={[typography.body, { color: destructive ? colors.error : colors.label, marginStart: spacing.md }]}>
          {label}
        </Text>
      </View>
      {!destructive && <ChevronRight size={18} color={colors.tertiaryLabel} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  menuGroup: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
