/**
 * Profile & Settings Screen
 *
 * HIG: .insetGrouped list style with icon backgrounds.
 * Combines user profile (when authenticated) with app settings
 * (language, theme, notifications) accessible to all users.
 *
 * RTL: Uses useRTL() hook — flexDirection: rtl.row for rows,
 * textAlign: rtl.textAlign + writingDirection: rtl.writingDirection for text.
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
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  User,
  Heart,
  Bell,
  TrendingDown,
  LogOut,
  LogIn,
  ChevronRight,
  ChevronLeft,
  Search,
  ShoppingCart,
  Pencil,
  Globe,
  Sun,
  Moon,
  Smartphone,
  Tag,
  Package,
  Lock,
  Trash2,
  Check,
  Info,
  Shield,
  FileText,
  Palette,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button } from '@/src/components/ui';

type ThemePreference = 'light' | 'dark' | 'system';

export default function ProfileScreen() {
  const { colors, setColorScheme } = useTheme();
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { user, loading, signOut } = useAuth();
  const rtl = useRTL();

  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dealAlerts, setDealAlerts] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);

  const hour = new Date().getHours();
  const greeting =
    rtl.isRTL
      ? hour < 12 ? 'صباح الخير' : 'مساء الخير'
      : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

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
      rtl.isRTL ? 'تسجيل الخروج' : 'Sign Out',
      rtl.isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: rtl.isRTL ? 'خروج' : 'Sign Out', style: 'destructive', onPress: signOut },
      ],
    );
  }, [rtl.isRTL, t, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountDescription'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: rtl.isRTL ? 'حذف' : 'Delete', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [t, rtl.isRTL, signOut]);

  const ChevronIcon = rtl.isRTL ? ChevronLeft : ChevronRight;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.groupedBackground }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      >
        {/* ── Profile Header ── */}
        {user ? (
          <Pressable
            onPress={() => router.push('/(stack)/edit-profile')}
            style={[styles.header, { flexDirection: rtl.row }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
              ) : (
                <Text style={[typography.title1, { color: colors.primary }]}>
                  {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, alignItems: rtl.alignStart }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {greeting}
              </Text>
              <Text style={[typography.title3, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {user.full_name || (rtl.isRTL ? 'مستخدم' : 'User')}
              </Text>
            </View>
            <Pencil size={16} color={colors.tertiaryLabel} />
          </Pressable>
        ) : !loading ? (
          <View style={styles.welcomeHeader}>
            <View style={[styles.avatarLarge, { backgroundColor: colors.primaryContainer }]}>
              <User size={36} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={[typography.title2, { color: colors.label, fontWeight: '600', marginTop: spacing.md, textAlign: 'center' }]}>
              {rtl.isRTL ? 'مرحباً بك في توفيري' : 'Welcome to Tawveeri'}
            </Text>
            <Text style={[typography.subheadline, { color: colors.secondaryLabel, marginTop: spacing.xs, textAlign: 'center' }]}>
              {rtl.isRTL ? 'سجل دخولك لتتبع الأسعار وإنشاء التنبيهات' : 'Sign in to track prices and create alerts'}
            </Text>
            <Button
              title={rtl.isRTL ? 'تسجيل الدخول' : 'Sign In'}
              onPress={() => router.push('/(auth)/login')}
              icon={<LogIn size={18} color="#fff" />}
              style={{ marginTop: spacing.lg }}
              fullWidth
            />
          </View>
        ) : null}

        {/* ── Quick Actions (logged in only) ── */}
        {user && (
          <View style={[styles.quickActions, { flexDirection: rtl.row }]}>
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
                <Text style={[typography.caption1, { color: colors.label, marginTop: 4, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                  {rtl.isRTL ? action.label_ar : action.label_en}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Menu Rows (logged in only) ── */}
        {user && (
          <View style={[styles.group, { backgroundColor: colors.card }]}>
            {[
              { icon: <Heart size={20} color={colors.systemPink} />, label_ar: 'قائمة الأمنيات', label_en: 'Wishlist', route: '/(stack)/wishlist' },
              { icon: <TrendingDown size={20} color={colors.systemGreen} />, label_ar: 'تنبيهات الأسعار', label_en: 'Price Alerts', route: '/(stack)/price-alerts' },
              { icon: <Bell size={20} color={colors.systemBlue} />, label_ar: 'الإشعارات', label_en: 'Notifications', route: '/(stack)/notifications' },
              { icon: <ShoppingCart size={20} color={colors.systemIndigo} />, label_ar: 'السلة', label_en: 'Cart', route: '/(stack)/cart' },
            ].map((item, i, arr) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [
                  styles.row,
                  { flexDirection: rtl.row },
                  i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
                  pressed && { backgroundColor: colors.quaternaryFill },
                ]}
              >
                <View style={[{ flexDirection: rtl.row, alignItems: 'center', flex: 1 }]}>
                  {item.icon}
                  <Text style={[typography.body, { color: colors.label, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                    {rtl.isRTL ? item.label_ar : item.label_en}
                  </Text>
                </View>
                <ChevronIcon size={18} color={colors.tertiaryLabel} />
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Language & Theme ── */}
        <SectionLabel text={t('settings.preferences')} colors={colors} rtl={rtl} />

        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <View style={styles.block}>
            <View style={[styles.labelLine, { flexDirection: rtl.row }]}>
              <IconBg color={colors.systemBlue}>
                <Globe size={16} color="#fff" strokeWidth={2} />
              </IconBg>
              <Text style={[typography.body, { color: colors.label, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {t('settings.language')}
              </Text>
            </View>
            <View style={[styles.cardRow, { flexDirection: rtl.row }]}>
              <LanguageCard label="العربية" active={locale === 'ar'} onPress={() => handleLanguageChange('ar')} colors={colors} rtl={rtl} />
              <LanguageCard label="English" active={locale === 'en'} onPress={() => handleLanguageChange('en')} colors={colors} rtl={rtl} />
            </View>
          </View>

          <Separator colors={colors} />

          <View style={styles.block}>
            <View style={[styles.labelLine, { flexDirection: rtl.row }]}>
              <IconBg color={colors.systemIndigo}>
                <Palette size={16} color="#fff" strokeWidth={2} />
              </IconBg>
              <Text style={[typography.body, { color: colors.label, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {t('settings.theme')}
              </Text>
            </View>
            <View style={[styles.cardRow, { flexDirection: rtl.row }]}>
              <ThemeCard icon={<Sun size={22} color={themePreference === 'light' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.light')} active={themePreference === 'light'} onPress={() => handleThemeChange('light')} colors={colors} rtl={rtl} />
              <ThemeCard icon={<Moon size={22} color={themePreference === 'dark' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.dark')} active={themePreference === 'dark'} onPress={() => handleThemeChange('dark')} colors={colors} rtl={rtl} />
              <ThemeCard icon={<Smartphone size={22} color={themePreference === 'system' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.system')} active={themePreference === 'system'} onPress={() => handleThemeChange('system')} colors={colors} rtl={rtl} />
            </View>
          </View>
        </View>

        {/* ── Notifications ── */}
        <SectionLabel text={t('settings.notifications')} colors={colors} rtl={rtl} />

        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <ToggleRow icon={<IconBg color={colors.systemOrange}><Bell size={16} color="#fff" strokeWidth={2} /></IconBg>} label={t('settings.pushNotifications')} value={pushEnabled} onValueChange={(v) => { setPushEnabled(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} />
          <Separator colors={colors} />
          <ToggleRow icon={<IconBg color={colors.systemGreen}><TrendingDown size={16} color="#fff" strokeWidth={2} /></IconBg>} label={t('settings.priceAlerts')} value={priceAlerts && pushEnabled} onValueChange={(v) => { setPriceAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
          <Separator colors={colors} />
          <ToggleRow icon={<IconBg color={colors.tertiary}><Tag size={16} color="#fff" strokeWidth={2} /></IconBg>} label={t('settings.dealAlerts')} value={dealAlerts && pushEnabled} onValueChange={(v) => { setDealAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
          <Separator colors={colors} />
          <ToggleRow icon={<IconBg color={colors.systemTeal}><Package size={16} color="#fff" strokeWidth={2} /></IconBg>} label={t('settings.stockAlerts')} value={stockAlerts && pushEnabled} onValueChange={(v) => { setStockAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
        </View>

        {/* ── Account (logged in only) ── */}
        {user && (
          <>
            <SectionLabel text={rtl.isRTL ? 'الحساب' : 'Account'} colors={colors} rtl={rtl} />
            <View style={[styles.group, { backgroundColor: colors.card }]}>
              <NavRow icon={<IconBg color={colors.systemCyan}><Pencil size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'} onPress={() => router.push('/(stack)/edit-profile')} colors={colors} rtl={rtl} />
              <Separator colors={colors} />
              <NavRow icon={<IconBg color={colors.systemGray}><Lock size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تغيير كلمة المرور' : 'Change Password'} onPress={() => router.push('/(auth)/forgot-password')} colors={colors} rtl={rtl} />
              <Separator colors={colors} />
              <NavRow icon={<IconBg color={colors.systemRed}><LogOut size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تسجيل الخروج' : 'Sign Out'} onPress={handleSignOut} colors={colors} rtl={rtl} destructive />
            </View>
          </>
        )}

        {/* ── About ── */}
        <SectionLabel text={rtl.isRTL ? 'حول التطبيق' : 'About'} colors={colors} rtl={rtl} />

        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <View style={[styles.row, { flexDirection: rtl.row }]}>
            <IconBg color={colors.systemGray2}><Info size={16} color="#fff" strokeWidth={2} /></IconBg>
            <Text style={[typography.body, { color: colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {rtl.isRTL ? 'الإصدار' : 'Version'}
            </Text>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>1.0.0</Text>
          </View>
          <Separator colors={colors} />
          <NavRow icon={<IconBg color={colors.systemBlue}><Shield size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'} onPress={() => Linking.openURL('https://tawveeri.com/privacy')} colors={colors} rtl={rtl} />
          <Separator colors={colors} />
          <NavRow icon={<IconBg color={colors.systemBlue}><FileText size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'الشروط والأحكام' : 'Terms of Service'} onPress={() => Linking.openURL('https://tawveeri.com/terms')} colors={colors} rtl={rtl} />
        </View>

        {/* ── Delete Account ── */}
        {user && (
          <>
            <View style={[styles.group, { backgroundColor: colors.card, marginTop: spacing.xl }]}>
              <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteRow, { flexDirection: rtl.row }, pressed && { backgroundColor: colors.quaternaryFill }]}>
                <Trash2 size={18} color={colors.error} strokeWidth={1.8} />
                <Text style={[typography.body, { color: colors.error, marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                  {t('settings.deleteAccount')}
                </Text>
              </Pressable>
            </View>
            <Text style={[typography.caption2, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl }]}>
              {t('settings.deleteAccountDescription')}
            </Text>
          </>
        )}

        <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center', marginTop: spacing.xl }]}>
          {rtl.isRTL ? 'توفيري' : 'Tawveeri'} v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

type RTLHook = ReturnType<typeof useRTL>;

function SectionLabel({ text, colors, rtl }: { text: string; colors: any; rtl: RTLHook }) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, alignItems: rtl.alignStart }}>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {text}
      </Text>
    </View>
  );
}

function IconBg({ color, children }: { color: string; children: React.ReactNode }) {
  return <View style={[styles.iconBg, { backgroundColor: color }]}>{children}</View>;
}

function Separator({ colors }: { colors: any }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 52 }} />;
}

function LanguageCard({ label, active, onPress, colors, rtl }: { label: string; active: boolean; onPress: () => void; colors: any; rtl: RTLHook }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageCard,
        { flexDirection: rtl.row, backgroundColor: active ? colors.primaryContainer : colors.secondaryBackground, borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.separator },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[typography.subheadline, { color: active ? colors.primary : colors.label, fontWeight: active ? '600' : '400', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {label}
      </Text>
      {active && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
    </Pressable>
  );
}

function ThemeCard({ icon, label, active, onPress, colors, rtl }: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void; colors: any; rtl: RTLHook }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeCard,
        { backgroundColor: active ? colors.primaryContainer : colors.secondaryBackground, borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.separator },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon}
      <Text style={[typography.caption1, { color: active ? colors.primary : colors.label, fontWeight: active ? '600' : '400', marginTop: spacing.xs, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {label}
      </Text>
      {active && <Check size={14} color={colors.primary} strokeWidth={2.5} style={{ marginTop: 4 }} />}
    </Pressable>
  );
}

function ToggleRow({ icon, label, value, onValueChange, colors, rtl, disabled }: { icon: React.ReactNode; label: string; value: boolean; onValueChange: (v: boolean) => void; colors: any; rtl: RTLHook; disabled?: boolean }) {
  return (
    <View style={[styles.row, { flexDirection: rtl.row }, disabled && { opacity: 0.5 }]}>
      {icon}
      <Text style={[typography.body, { color: colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.systemGray4, true: colors.systemGreen }} thumbColor="#fff" />
    </View>
  );
}

function NavRow({ icon, label, onPress, colors, rtl, destructive }: { icon: React.ReactNode; label: string; onPress: () => void; colors: any; rtl: RTLHook; destructive?: boolean }) {
  const ChevronIcon = rtl.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { flexDirection: rtl.row }, pressed && { backgroundColor: colors.quaternaryFill }]}>
      {icon}
      <Text style={[typography.body, { color: destructive ? colors.error : colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {label}
      </Text>
      {!destructive && <ChevronIcon size={18} color={colors.tertiaryLabel} />}
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
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
  group: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  block: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  labelLine: {
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
  cardRow: {
    gap: spacing.md,
  },
  languageCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minHeight: 80,
  },
  deleteRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
});
