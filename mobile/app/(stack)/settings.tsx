/**
 * Settings Screen
 *
 * HIG: .insetGrouped list style with toggle rows.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Globe, Moon, Bell, Lock, Trash2, ChevronRight, ChevronLeft, Check,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';

export default function SettingsScreen() {
  const { colors, colorScheme, setColorScheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const { user, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLanguageToggle = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  const handleThemeToggle = () => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      locale === 'ar' ? 'حذف الحساب' : 'Delete Account',
      locale === 'ar'
        ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.'
        : 'Are you sure? This action cannot be undone.',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: locale === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Call delete account API
            signOut();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      {/* Language & Appearance */}
      <Text style={[typography.footnote, { color: colors.secondaryLabel, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }]}>
        {locale === 'ar' ? 'العامة' : 'GENERAL'}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <SettingRow
          icon={<Globe size={20} color={colors.systemBlue} />}
          label={locale === 'ar' ? 'اللغة' : 'Language'}
          value={locale === 'ar' ? 'العربية' : 'English'}
          onPress={handleLanguageToggle}
          colors={colors}
          locale={locale}
        />
        <SettingRow
          icon={<Moon size={20} color={colors.systemIndigo} />}
          label={locale === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
          colors={colors}
          locale={locale}
          last
        >
          <Switch
            value={colorScheme === 'dark'}
            onValueChange={handleThemeToggle}
            trackColor={{ false: colors.systemGray4, true: colors.systemGreen }}
            thumbColor="#fff"
          />
        </SettingRow>
      </View>

      {/* Notifications */}
      <Text style={[typography.footnote, { color: colors.secondaryLabel, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }]}>
        {locale === 'ar' ? 'الإشعارات' : 'NOTIFICATIONS'}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <SettingRow
          icon={<Bell size={20} color={colors.systemOrange} />}
          label={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
          colors={colors}
          locale={locale}
          last
        >
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.systemGray4, true: colors.systemGreen }}
            thumbColor="#fff"
          />
        </SettingRow>
      </View>

      {/* Account */}
      {user && (
        <>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }]}>
            {locale === 'ar' ? 'الحساب' : 'ACCOUNT'}
          </Text>
          <View style={[styles.group, { backgroundColor: colors.card }]}>
            <SettingRow
              icon={<Lock size={20} color={colors.systemGray} />}
              label={locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              onPress={() => router.push('/(auth)/forgot-password')}
              colors={colors}
              locale={locale}
            />
            <SettingRow
              icon={<Trash2 size={20} color={colors.systemRed} />}
              label={locale === 'ar' ? 'حذف الحساب' : 'Delete Account'}
              onPress={handleDeleteAccount}
              colors={colors}
              locale={locale}
              destructive
              last
            />
          </View>
        </>
      )}

      {/* App Version */}
      <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.xl }]}>
        Tawveeri v1.0.0
      </Text>
    </ScrollView>
  );
}

function SettingRow({ icon, label, value, onPress, children, colors, locale, destructive, last }: {
  icon: React.ReactNode; label: string; value?: string; onPress?: () => void;
  children?: React.ReactNode; colors: any; locale: string; destructive?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !children}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {icon}
        <Text style={[typography.body, { color: destructive ? colors.error : colors.label, marginStart: spacing.md }]}>
          {label}
        </Text>
      </View>
      {children || (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {value && (
            <Text style={[typography.body, { color: colors.secondaryLabel, marginEnd: spacing.xs }]}>{value}</Text>
          )}
          {onPress && (locale === 'ar' ? <ChevronLeft size={18} color={colors.tertiaryLabel} /> : <ChevronRight size={18} color={colors.tertiaryLabel} />)}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
