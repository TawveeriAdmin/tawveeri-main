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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
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
  Eye,
  Download,
  Bookmark,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useTranslations, useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { supabase } from '@/src/lib/supabase/client';

type ThemePreference = 'light' | 'dark' | 'system';

export default function ProfileScreen() {
  const { colors, setColorScheme } = useTheme();
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { user, signOut } = useAuth();
  const rtl = useRTL();

  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dealAlerts, setDealAlerts] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);
  const [shareSearchHistory, setShareSearchHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const privacyDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Load privacy preferences
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('privacy_preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.privacy_preferences) {
          const prefs = data.privacy_preferences as any;
          setPublicProfile(!!prefs.public_profile);
          setShareSearchHistory(!!prefs.share_search_history);
        }
      } catch {}
    })();
  }, [user?.id]);

  const savePrivacyPreferences = useCallback(
    (prefs: { public_profile: boolean; share_search_history: boolean }) => {
      if (!user) return;
      if (privacyDebounceRef.current) clearTimeout(privacyDebounceRef.current);
      privacyDebounceRef.current = setTimeout(async () => {
        try {
          await supabase.from('user_preferences').upsert(
            { user_id: user.id, privacy_preferences: prefs },
            { onConflict: 'user_id' },
          );
        } catch {}
      }, 500);
    },
    [user?.id],
  );

  const handleExportData = useCallback(async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [wishlists, alerts, searches, profile] = await Promise.all([
        supabase.from('user_wishlists').select('*, products(name_ar, name_en, slug)').eq('user_id', user.id),
        supabase.from('price_alerts').select('*, products(name_ar, name_en, slug)').eq('user_id', user.id),
        supabase.from('saved_searches').select('*').eq('user_id', user.id),
        supabase.from('users').select('*').eq('id', user.id).single(),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profile.data,
        wishlists: wishlists.data || [],
        price_alerts: alerts.data || [],
        saved_searches: searches.data || [],
      };
      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: 'Tawveeri Data Export',
      });
    } catch {
      Alert.alert(
        rtl.isRTL ? 'خطأ' : 'Error',
        rtl.isRTL ? 'فشل تصدير البيانات' : 'Failed to export data',
      );
    } finally {
      setExporting(false);
    }
  }, [user, rtl.isRTL]);

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl }]}
      >
        {/* ── Profile Header (mock: centered avatar + Sign In when guest) ── */}
        {user ? (
          <Pressable
            onPress={() => router.push('/(stack)/edit-profile')}
            style={[styles.headerLoggedIn, { flexDirection: rtl.row, backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}
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
        ) : (
          <View style={styles.welcomeHeader}>
            <View style={styles.avatarWrapMock}>
              <View style={[styles.avatarMock, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.primary + '33' }]}>
                <User size={48} color={colors.secondaryLabel} strokeWidth={1.5} />
              </View>
              <View style={[styles.avatarBadgeMock, { backgroundColor: colors.primary, borderColor: colors.groupedBackground }]}>
                <Zap size={14} color="#fff" strokeWidth={2} />
              </View>
            </View>
            <Text style={[typography.title2, { color: colors.label, fontWeight: '700', marginTop: spacing.lg, textAlign: 'center', writingDirection: rtl.writingDirection }]}>
              {rtl.isRTL ? 'مرحباً بك في توفيري' : 'Welcome to Tawveeri'}
            </Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.xl, writingDirection: rtl.writingDirection }]}>
              {rtl.isRTL ? 'سجل دخولك لتتبع الأسعار وإنشاء التنبيهات ومزامنتها على أجهزتك' : 'Sign in to track prices, create alerts and sync across devices'}
            </Text>
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => [
                styles.signInButtonMock,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 8,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={[styles.signInButtonContent, { flexDirection: rtl.row }]}>
                <View style={styles.signInIconWrap}>
                  <LogOut size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={[typography.headline, { color: '#fff', fontWeight: '700', writingDirection: rtl.writingDirection }]}>
                  {rtl.isRTL ? 'تسجيل الدخول' : 'Sign In'}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

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
                accessibilityRole="button"
                accessibilityLabel={rtl.isRTL ? action.label_ar : action.label_en}
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
          <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
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

        {/* ── Preferences (mock: section label + Language card + Theme card) ── */}
        <SectionLabel text={t('settings.preferences')} colors={colors} rtl={rtl} />

        <View style={styles.mockSectionBlock}>
          <View style={[styles.mockCard, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
            <View style={[styles.mockCardRow, { flexDirection: rtl.row }]}>
              <View style={{ flexDirection: rtl.row, alignItems: 'center', flex: 1 }}>
                <View style={[styles.mockIconBox, { backgroundColor: colors.systemBlue + '1A' }]}>
                  <Globe size={20} color={colors.systemBlue} strokeWidth={2} />
                </View>
                <Text style={[typography.body, { color: colors.label, fontWeight: '600', marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                  {t('settings.language')}
                </Text>
              </View>
              <View style={[styles.mockSegmentedWrap, { flexDirection: rtl.row, backgroundColor: colors.background, borderColor: colors.separator }]}>
                <Pressable onPress={() => handleLanguageChange('ar')} style={[styles.mockSegmentedBtn, locale === 'ar' && { backgroundColor: colors.primary }, { flexDirection: rtl.row }]}>
                  <Text style={[typography.footnote, { fontWeight: '700', color: locale === 'ar' ? '#fff' : colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>العربية</Text>
                </Pressable>
                <Pressable onPress={() => handleLanguageChange('en')} style={[styles.mockSegmentedBtn, locale === 'en' && { backgroundColor: colors.primary }, { flexDirection: rtl.row }]}>
                  <Text style={[typography.footnote, { fontWeight: '700', color: locale === 'en' ? '#fff' : colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>English</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[styles.mockCard, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, marginTop: spacing.md }]}>
            <View style={[styles.mockCardRow, { flexDirection: rtl.row, marginBottom: spacing.md }]}>
              <View style={[styles.mockIconBox, { backgroundColor: colors.systemPurple + '1A' }]}>
                <Palette size={20} color={colors.systemPurple} strokeWidth={2} />
              </View>
              <Text style={[typography.body, { color: colors.label, fontWeight: '600', marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {t('settings.theme')}
              </Text>
            </View>
            <View style={[styles.mockThemeGrid, { flexDirection: rtl.row }]}>
              <ThemeCard icon={<Sun size={20} color={themePreference === 'light' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.light')} active={themePreference === 'light'} onPress={() => handleThemeChange('light')} colors={colors} rtl={rtl} />
              <ThemeCard icon={<Moon size={20} color={themePreference === 'dark' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.dark')} active={themePreference === 'dark'} onPress={() => handleThemeChange('dark')} colors={colors} rtl={rtl} />
              <ThemeCard icon={<Smartphone size={20} color={themePreference === 'system' ? colors.primary : colors.secondaryLabel} strokeWidth={1.8} />} label={t('settings.system')} active={themePreference === 'system'} onPress={() => handleThemeChange('system')} colors={colors} rtl={rtl} />
            </View>
          </View>
        </View>

        {/* ── Notifications (mock: single card with dividers) ── */}
        <SectionLabel text={t('settings.notifications')} colors={colors} rtl={rtl} />

        <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
          <ToggleRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.systemOrange + '1A' }]}><Bell size={20} color={colors.systemOrange} strokeWidth={2} /></View>} label={t('settings.pushNotifications')} value={pushEnabled} onValueChange={(v) => { setPushEnabled(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} />
          <SeparatorFull colors={colors} />
          <ToggleRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.systemGreen + '1A' }]}><TrendingDown size={20} color={colors.systemGreen} strokeWidth={2} /></View>} label={t('settings.priceAlerts')} value={priceAlerts && pushEnabled} onValueChange={(v) => { setPriceAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
          <SeparatorFull colors={colors} />
          <ToggleRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.tertiary + '1A' }]}><Tag size={20} color={colors.tertiary} strokeWidth={2} /></View>} label={t('settings.dealAlerts')} value={dealAlerts && pushEnabled} onValueChange={(v) => { setDealAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
          <SeparatorFull colors={colors} />
          <ToggleRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.systemTeal + '1A' }]}><Package size={20} color={colors.systemTeal} strokeWidth={2} /></View>} label={t('settings.stockAlerts')} value={stockAlerts && pushEnabled} onValueChange={(v) => { setStockAlerts(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} colors={colors} rtl={rtl} disabled={!pushEnabled} />
        </View>

        {/* ── Privacy (logged in only) ── */}
        {user && (
          <>
            <SectionLabel text={rtl.isRTL ? 'الخصوصية' : 'Privacy'} colors={colors} rtl={rtl} />
            <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
              <ToggleRow
                icon={<IconBg color={colors.systemIndigo}><Shield size={16} color="#fff" strokeWidth={2} /></IconBg>}
                label={rtl.isRTL ? 'ملف شخصي عام' : 'Public Profile'}
                value={publicProfile}
                onValueChange={(v) => {
                  setPublicProfile(v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  savePrivacyPreferences({ public_profile: v, share_search_history: shareSearchHistory });
                }}
                colors={colors}
                rtl={rtl}
              />
              <SeparatorFull colors={colors} />
              <ToggleRow
                icon={<IconBg color={colors.systemTeal}><Eye size={16} color="#fff" strokeWidth={2} /></IconBg>}
                label={rtl.isRTL ? 'مشاركة سجل البحث' : 'Share Search History'}
                value={shareSearchHistory}
                onValueChange={(v) => {
                  setShareSearchHistory(v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  savePrivacyPreferences({ public_profile: publicProfile, share_search_history: v });
                }}
                colors={colors}
                rtl={rtl}
              />
            </View>
          </>
        )}

        {/* ── Account (logged in only) ── */}
        {user && (
          <>
            <SectionLabel text={rtl.isRTL ? 'الحساب' : 'Account'} colors={colors} rtl={rtl} />
            <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
              <NavRow icon={<IconBg color={colors.systemCyan}><Pencil size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'} onPress={() => router.push('/(stack)/edit-profile')} colors={colors} rtl={rtl} />
              <SeparatorFull colors={colors} />
              <NavRow icon={<IconBg color={colors.systemPurple}><Bookmark size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'البحوث المحفوظة' : 'Saved Searches'} onPress={() => router.push('/(stack)/saved-searches')} colors={colors} rtl={rtl} />
              <SeparatorFull colors={colors} />
              <NavRow
                icon={<IconBg color={colors.systemGreen}><Download size={16} color="#fff" strokeWidth={2} /></IconBg>}
                label={rtl.isRTL ? 'تصدير بياناتي' : 'Export My Data'}
                onPress={handleExportData}
                colors={colors}
                rtl={rtl}
                trailing={exporting ? <ActivityIndicator size="small" color={colors.secondaryLabel} /> : undefined}
              />
              <SeparatorFull colors={colors} />
              <NavRow icon={<IconBg color={colors.systemGray}><Lock size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تغيير كلمة المرور' : 'Change Password'} onPress={() => router.push('/(auth)/forgot-password')} colors={colors} rtl={rtl} />
              <SeparatorFull colors={colors} />
              <NavRow icon={<IconBg color={colors.systemRed}><LogOut size={16} color="#fff" strokeWidth={2} /></IconBg>} label={rtl.isRTL ? 'تسجيل الخروج' : 'Sign Out'} onPress={handleSignOut} colors={colors} rtl={rtl} destructive />
            </View>
          </>
        )}

        {/* ── About (same single-block + divider style as Notifications) ── */}
        <SectionLabel text={rtl.isRTL ? 'حول التطبيق' : 'About'} colors={colors} rtl={rtl} />

        <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator }]}>
          <View style={[styles.row, { flexDirection: rtl.row }]}>
            <View style={[styles.mockIconBox, { backgroundColor: colors.systemGray2 + '1A' }]}>
              <Info size={20} color={colors.systemGray2} strokeWidth={2} />
            </View>
            <Text style={[typography.body, { color: colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {rtl.isRTL ? 'الإصدار' : 'Version'}
            </Text>
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>1.0.0</Text>
          </View>
          <SeparatorFull colors={colors} />
          <NavRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.systemBlue + '1A' }]}><Shield size={20} color={colors.systemBlue} strokeWidth={2} /></View>} label={rtl.isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'} onPress={() => Linking.openURL('https://tawveeri.com/privacy')} colors={colors} rtl={rtl} />
          <SeparatorFull colors={colors} />
          <NavRow icon={<View style={[styles.mockIconBox, { backgroundColor: colors.systemBlue + '1A' }]}><FileText size={20} color={colors.systemBlue} strokeWidth={2} /></View>} label={rtl.isRTL ? 'الشروط والأحكام' : 'Terms of Service'} onPress={() => Linking.openURL('https://tawveeri.com/terms')} colors={colors} rtl={rtl} />
        </View>

        {/* ── Delete Account ── */}
        {user && (
          <>
            <View style={[styles.mockCardNoPadding, { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, marginTop: spacing.xl }]}>
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
    <View style={[styles.mockSectionLabel, { alignItems: rtl.isRTL ? 'flex-end' : 'flex-start' }]}>
      <Text style={[styles.mockSectionLabelText, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={1}>
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

function SeparatorFull({ colors }: { colors: any }) {
  return <View style={[styles.separatorBar, { backgroundColor: colors.separator }]} />;
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

function NavRow({ icon, label, onPress, colors, rtl, destructive, trailing }: { icon: React.ReactNode; label: string; onPress: () => void; colors: any; rtl: RTLHook; destructive?: boolean; trailing?: React.ReactNode }) {
  const ChevronIcon = rtl.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { flexDirection: rtl.row }, pressed && { backgroundColor: colors.quaternaryFill }]}>
      {icon}
      <Text style={[typography.body, { color: destructive ? colors.error : colors.label, flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
        {label}
      </Text>
      {trailing || (!destructive && <ChevronIcon size={18} color={colors.tertiaryLabel} />)}
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const MOCK_CARD_RADIUS = 24;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  headerLoggedIn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: MOCK_CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingTop: spacing.xl * 1.25,
    paddingBottom: spacing.xl,
  },
  avatarWrapMock: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatarMock: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeMock: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonMock: {
    alignSelf: 'stretch',
    width: '100%',
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  mockSectionLabel: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  mockSectionLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  contentPad: {
    marginHorizontal: spacing.lg,
  },
  mockSectionBlock: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  mockCard: {
    borderRadius: MOCK_CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mockCardNoPadding: {
    borderRadius: MOCK_CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mockCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  mockIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockSegmentedWrap: {
    padding: 4,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  mockSegmentedBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  mockThemeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signInIconWrap: {
    transform: [{ rotate: '180deg' }],
  },
  separatorBar: {
    height: 1,
    width: '100%',
    alignSelf: 'stretch',
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
