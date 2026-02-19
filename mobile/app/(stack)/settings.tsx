/**
 * Settings Screen
 *
 * HIG: .insetGrouped list style with icon backgrounds,
 * inline language picker, theme cards, notification toggles.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Globe,
  Sun,
  Moon,
  Smartphone,
  Bell,
  TrendingDown,
  Tag,
  Package,
  Lock,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  Shield,
  FileText,
  Pencil,
  LogOut,
  Palette,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';

type ThemePreference = 'light' | 'dark' | 'system';

// ─── Main Component ──────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, setColorScheme } = useTheme();
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const rtl = useRTL();
  const { user, signOut } = useAuth();

  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dealAlerts, setDealAlerts] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);

  // Read saved theme preference
  useEffect(() => {
    AsyncStorage.getItem('tawveeri-theme').then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemePreference(val);
      }
    });
  }, []);

  const handleThemeChange = useCallback(
    (pref: ThemePreference) => {
      setThemePreference(pref);
      setColorScheme(pref);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setColorScheme],
  );

  const handleLanguageChange = useCallback(
    (newLocale: 'ar' | 'en') => {
      if (newLocale === locale) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLocale(newLocale);
    },
    [locale, setLocale],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert(
      locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out',
      locale === 'ar'
        ? 'هل أنت متأكد من تسجيل الخروج؟'
        : 'Are you sure you want to sign out?',
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: locale === 'ar' ? 'خروج' : 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ],
    );
  }, [locale, t, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountDescription'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: locale === 'ar' ? 'حذف' : 'Delete',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [t, locale, signOut]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Preferences ── */}
      <SectionLabel text={t('settings.preferences')} rtl={rtl} />

      <View style={[styles.group, { backgroundColor: colors.card }]}>
        {/* Language */}
        <View style={styles.rowBlock}>
          <View style={[styles.rowLabelLine, { flexDirection: rtl.row }]}>
            <IconBg color={colors.systemBlue}>
              <Globe size={16} color="#fff" strokeWidth={2} />
            </IconBg>
            <Text style={[typography.body, { color: colors.label, marginLeft: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {t('settings.language')}
            </Text>
          </View>
          <View style={styles.languageRow}>
            <LanguageCard
              label="العربية"
              active={locale === 'ar'}
              onPress={() => handleLanguageChange('ar')}
              colors={colors}
            />
            <LanguageCard
              label="English"
              active={locale === 'en'}
              onPress={() => handleLanguageChange('en')}
              colors={colors}
            />
          </View>
        </View>

        <Separator colors={colors} inset />

        {/* Theme */}
        <View style={styles.rowBlock}>
          <View style={[styles.rowLabelLine, { flexDirection: rtl.row }]}>
            <IconBg color={colors.systemIndigo}>
              <Palette size={16} color="#fff" strokeWidth={2} />
            </IconBg>
            <Text style={[typography.body, { color: colors.label, marginLeft: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {t('settings.theme')}
            </Text>
          </View>
          <View style={styles.themeRow}>
            <ThemeCard
              icon={
                <Sun
                  size={22}
                  color={themePreference === 'light' ? colors.primary : colors.secondaryLabel}
                  strokeWidth={1.8}
                />
              }
              label={t('settings.light')}
              active={themePreference === 'light'}
              onPress={() => handleThemeChange('light')}
              colors={colors}
            />
            <ThemeCard
              icon={
                <Moon
                  size={22}
                  color={themePreference === 'dark' ? colors.primary : colors.secondaryLabel}
                  strokeWidth={1.8}
                />
              }
              label={t('settings.dark')}
              active={themePreference === 'dark'}
              onPress={() => handleThemeChange('dark')}
              colors={colors}
            />
            <ThemeCard
              icon={
                <Smartphone
                  size={22}
                  color={
                    themePreference === 'system' ? colors.primary : colors.secondaryLabel
                  }
                  strokeWidth={1.8}
                />
              }
              label={t('settings.system')}
              active={themePreference === 'system'}
              onPress={() => handleThemeChange('system')}
              colors={colors}
            />
          </View>
        </View>
      </View>

      {/* ── Notifications ── */}
      <SectionLabel text={t('settings.notifications')} rtl={rtl} />

      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <ToggleRow
          icon={
            <IconBg color={colors.systemOrange}>
              <Bell size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={t('settings.pushNotifications')}
          value={pushEnabled}
          onValueChange={(v) => {
            setPushEnabled(v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          colors={colors}
        />
        <Separator colors={colors} inset />
        <ToggleRow
          icon={
            <IconBg color={colors.systemGreen}>
              <TrendingDown size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={t('settings.priceAlerts')}
          value={priceAlerts && pushEnabled}
          onValueChange={(v) => {
            setPriceAlerts(v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          colors={colors}
          disabled={!pushEnabled}
        />
        <Separator colors={colors} inset />
        <ToggleRow
          icon={
            <IconBg color={colors.tertiary}>
              <Tag size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={t('settings.dealAlerts')}
          value={dealAlerts && pushEnabled}
          onValueChange={(v) => {
            setDealAlerts(v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          colors={colors}
          disabled={!pushEnabled}
        />
        <Separator colors={colors} inset />
        <ToggleRow
          icon={
            <IconBg color={colors.systemTeal}>
              <Package size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={t('settings.stockAlerts')}
          value={stockAlerts && pushEnabled}
          onValueChange={(v) => {
            setStockAlerts(v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          colors={colors}
          disabled={!pushEnabled}
        />
      </View>

      {/* ── Account ── */}
      {user && (
        <>
          <SectionLabel
            text={locale === 'ar' ? 'الحساب' : 'Account'}
            rtl={rtl}
          />
          <View style={[styles.group, { backgroundColor: colors.card }]}>
            <NavRow
              icon={
                <IconBg color={colors.systemCyan}>
                  <Pencil size={16} color="#fff" strokeWidth={2} />
                </IconBg>
              }
              label={locale === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
              onPress={() => router.push('/(stack)/edit-profile')}
              colors={colors}
            />
            <Separator colors={colors} inset />
            <NavRow
              icon={
                <IconBg color={colors.systemGray}>
                  <Lock size={16} color="#fff" strokeWidth={2} />
                </IconBg>
              }
              label={locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              onPress={() => router.push('/(auth)/forgot-password')}
              colors={colors}
            />
            <Separator colors={colors} inset />
            <NavRow
              icon={
                <IconBg color={colors.systemRed}>
                  <LogOut size={16} color="#fff" strokeWidth={2} />
                </IconBg>
              }
              label={locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              onPress={handleSignOut}
              colors={colors}
              destructive
            />
          </View>
        </>
      )}

      {/* ── About ── */}
      <SectionLabel text={locale === 'ar' ? 'حول التطبيق' : 'About'} rtl={rtl} />

      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <View style={[styles.navRow, { flexDirection: rtl.row }]}>
          <IconBg color={colors.systemGray2}>
            <Info size={16} color="#fff" strokeWidth={2} />
          </IconBg>
          <Text
            style={[typography.body, { color: colors.label, flex: 1, marginLeft: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
          >
            {locale === 'ar' ? 'الإصدار' : 'Version'}
          </Text>
          <Text style={[typography.body, { color: colors.secondaryLabel }]}>1.0.0</Text>
        </View>
        <Separator colors={colors} inset />
        <NavRow
          icon={
            <IconBg color={colors.systemBlue}>
              <Shield size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
          onPress={() => Linking.openURL('https://tawveeri.com/privacy')}
          colors={colors}
        />
        <Separator colors={colors} inset />
        <NavRow
          icon={
            <IconBg color={colors.systemBlue}>
              <FileText size={16} color="#fff" strokeWidth={2} />
            </IconBg>
          }
          label={locale === 'ar' ? 'الشروط والأحكام' : 'Terms of Service'}
          onPress={() => Linking.openURL('https://tawveeri.com/terms')}
          colors={colors}
        />
      </View>

      {/* ── Delete Account ── */}
      {user && (
        <>
          <View style={[styles.group, { backgroundColor: colors.card, marginTop: spacing.xl }]}>
            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.deleteRow,
                pressed && { backgroundColor: colors.quaternaryFill },
              ]}
            >
              <Trash2 size={18} color={colors.error} strokeWidth={1.8} />
              <Text
                style={[
                  typography.body,
                  { color: colors.error, marginLeft: spacing.sm },
                ]}
              >
                {t('settings.deleteAccount')}
              </Text>
            </Pressable>
          </View>
          <Text
            style={[
              typography.caption2,
              {
                color: colors.tertiaryLabel,
                textAlign: 'center',
                marginTop: spacing.sm,
                paddingHorizontal: spacing.xl,
              },
            ]}
          >
            {t('settings.deleteAccountDescription')}
          </Text>
        </>
      )}

      {/* Footer */}
      <Text
        style={[
          typography.caption1,
          { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.xl },
        ]}
      >
        {locale === 'ar' ? 'توفيري' : 'Tawveeri'} v1.0.0
      </Text>
    </ScrollView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function SectionLabel({ text, rtl: rtlProp }: { text: string; rtl?: any }) {
  const { colors } = useTheme();
  const rtlHook = useRTL();
  const rtl = rtlProp || rtlHook;
  return (
    <Text
      style={[
        typography.footnote,
        {
          color: colors.secondaryLabel,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          textTransform: 'uppercase',
          textAlign: rtl.textAlign,
          writingDirection: rtl.writingDirection,
        },
      ]}
    >
      {text}
    </Text>
  );
}

function IconBg({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={[styles.iconBg, { backgroundColor: color }]}>{children}</View>
  );
}

function Separator({ colors, inset }: { colors: any; inset?: boolean }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.separator,
        marginLeft: inset ? 52 : 0,
      }}
    />
  );
}

function LanguageCard({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageCard,
        {
          backgroundColor: active ? colors.primaryContainer : colors.secondaryBackground,
          borderWidth: active ? 2 : 1,
          borderColor: active ? colors.primary : colors.separator,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={[
          typography.subheadline,
          {
            color: active ? colors.primary : colors.label,
            fontWeight: active ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
      {active && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
    </Pressable>
  );
}

function ThemeCard({
  icon,
  label,
  active,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeCard,
        {
          backgroundColor: active ? colors.primaryContainer : colors.secondaryBackground,
          borderWidth: active ? 2 : 1,
          borderColor: active ? colors.primary : colors.separator,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon}
      <Text
        style={[
          typography.caption1,
          {
            color: active ? colors.primary : colors.label,
            fontWeight: active ? '600' : '400',
            marginTop: spacing.xs,
          },
        ]}
      >
        {label}
      </Text>
      {active && (
        <Check
          size={14}
          color={colors.primary}
          strokeWidth={2.5}
          style={{ marginTop: 4 }}
        />
      )}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  colors,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
  disabled?: boolean;
}) {
  const rtl = useRTL();
  return (
    <View style={[styles.navRow, { flexDirection: rtl.row }, disabled && { opacity: 0.5 }]}>
      {icon}
      <Text
        style={[typography.body, { color: colors.label, flex: 1, marginLeft: spacing.md, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.systemGray4, true: colors.systemGreen }}
        thumbColor="#fff"
      />
    </View>
  );
}

function NavRow({
  icon,
  label,
  onPress,
  colors,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: any;
  destructive?: boolean;
}) {
  const rtl = useRTL();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navRow,
        { flexDirection: rtl.row },
        pressed && { backgroundColor: colors.quaternaryFill },
      ]}
    >
      {icon}
      <Text
        style={[
          typography.body,
          {
            color: destructive ? colors.error : colors.label,
            flex: 1,
            marginLeft: spacing.md,
            textAlign: rtl.textAlign,
            writingDirection: rtl.writingDirection,
          },
        ]}
      >
        {label}
      </Text>
      {!destructive &&
        (rtl.isRTL ? (
          <ChevronLeft size={18} color={colors.tertiaryLabel} />
        ) : (
          <ChevronRight size={18} color={colors.tertiaryLabel} />
        ))}
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  group: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  rowBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabelLine: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  languageCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minHeight: 80,
  },
  navRow: {
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
});
