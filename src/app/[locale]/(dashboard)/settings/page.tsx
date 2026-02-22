'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { Database } from '@/lib/database/types';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Download, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface NotificationSettings {
 email: boolean;
 sms: boolean;
 push: boolean;
 price: boolean;
 stock: boolean;
 deal: boolean;
}

interface PrivacySettings {
 publicProfile: boolean;
 shareSearchHistory: boolean;
}

interface AppPreferences {
 language: 'ar' | 'en';
 theme: 'light' | 'dark' | 'system';
}

interface StoredPreferences {
 notification_preferences: NotificationSettings;
 privacy_preferences: PrivacySettings;
 app_preferences: AppPreferences;
}

const LOCAL_STORAGE_KEY_PREFIX = 'tawveeri.preferences.';

export default function SettingsPage() {
 const supabase = useMemo(
 () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
 []
 );
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user, loading: authLoading } = useAuth();
 const { toast } = useToast();
 const { theme, setTheme } = useTheme();

 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [exporting, setExporting] = useState(false);

 const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
 email: true,
 sms: false,
 push: true,
 price: true,
 stock: true,
 deal: true,
 });

 const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
 publicProfile: true,
 shareSearchHistory: false,
 });

 const [appPreferences, setAppPreferences] = useState<AppPreferences>({
 language: locale === 'ar' ? 'ar' : 'en',
 theme: (theme as AppPreferences['theme']) || 'system',
 });

 const localStorageKey = useMemo(() => {
 if (!user?.id) return null;
 return `${LOCAL_STORAGE_KEY_PREFIX}${user.id}`;
 }, [user?.id]);

 const loadFromLocalStorage = () => {
 if (!localStorageKey) return null;
 try {
 const raw = localStorage.getItem(localStorageKey);
 if (!raw) return null;
 const parsed = JSON.parse(raw) as StoredPreferences;
 return parsed;
 } catch (error) {
 console.error('Failed to parse stored preferences:', error);
 return null;
 }
 };

 useEffect(() => {
 if (authLoading || !supabase) return;
 if (!user) {
 router.push(`/${locale}/auth/login`);
 return;
 }

 const targetUserId = user.id;

 async function fetchPreferences(userId: string) {
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from('user_preferences')
 .select(
 `notification_preferences, privacy_preferences, app_preferences`
 )
 .eq('user_id', userId)
 .single<Database['public']['Tables']['user_preferences']['Row']>();

 if (error) {
 const stored = loadFromLocalStorage();
 if (stored) {
 setNotificationSettings(stored.notification_preferences);
 setPrivacySettings(stored.privacy_preferences);
 setAppPreferences(stored.app_preferences);
 setTheme(stored.app_preferences.theme);
 }
 } else if (data) {
 setNotificationSettings({
 email: !!data.notification_preferences?.email,
 sms: !!data.notification_preferences?.sms,
 push: !!data.notification_preferences?.push,
 price: !!data.notification_preferences?.price,
 stock: !!data.notification_preferences?.stock,
 deal: !!data.notification_preferences?.deal,
 });
 setPrivacySettings({
 publicProfile: !!data.privacy_preferences?.publicProfile,
 shareSearchHistory: !!data.privacy_preferences?.shareSearchHistory,
 });
 const themeValue =
 data.app_preferences?.theme === 'light' ||
 data.app_preferences?.theme === 'dark' ||
 data.app_preferences?.theme === 'system'
 ? data.app_preferences.theme
 : 'system';
 setAppPreferences({
 language: data.app_preferences?.language === 'en' ? 'en' : 'ar',
 theme: themeValue,
 });
 setTheme(themeValue);
 } else {
 const stored = loadFromLocalStorage();
 if (stored) {
 setNotificationSettings(stored.notification_preferences);
 setPrivacySettings(stored.privacy_preferences);
 setAppPreferences(stored.app_preferences);
 }
 }
 } catch (error) {
 console.error('Failed to load preferences:', error);
 const stored = loadFromLocalStorage();
 if (stored) {
 setNotificationSettings(stored.notification_preferences);
 setPrivacySettings(stored.privacy_preferences);
 setAppPreferences(stored.app_preferences);
 setTheme(stored.app_preferences.theme);
 }
 } finally {
 setLoading(false);
 }
 }

 fetchPreferences(targetUserId);
 }, [authLoading, user, router, locale, localStorageKey]);

 const persistToLocalStorage = (prefs: StoredPreferences) => {
 if (!localStorageKey) return;
 try {
 localStorage.setItem(localStorageKey, JSON.stringify(prefs));
 } catch (error) {
 console.error('Failed to persist preferences to local storage:', error);
 }
 };

 const handleSave = async () => {
 if (!user || !supabase) return;
 setSaving(true);
 const payload: StoredPreferences = {
 notification_preferences: notificationSettings,
 privacy_preferences: privacySettings,
 app_preferences: appPreferences,
 };

 try {
 const upsertPayload: Database['public']['Tables']['user_preferences']['Insert'] = {
 user_id: user.id,
 notification_preferences: { ...notificationSettings },
 privacy_preferences: { ...privacySettings },
 app_preferences: { ...appPreferences },
 updated_at: new Date().toISOString(),
 };

 const { error } = await supabase
 .from('user_preferences')
 .upsert(upsertPayload, { onConflict: 'user_id' });

 if (error) throw error;

 persistToLocalStorage(payload);
 setTheme(appPreferences.theme);
 toast({
 title: t('settings.saved'),
 variant: 'default',
 });
 } catch (error) {
 console.error('Failed to save preferences:', error);
 persistToLocalStorage(payload);
 toast({
 title: t('profile.updateError'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setSaving(false);
 }
 };

 const handleExportData = async () => {
 if (!user || !supabase) return;
 setExporting(true);
 try {
 const [{ data: profile }, { data: wishlists }, { data: alerts }, { data: searches }] =
 await Promise.all([
 supabase.from('users').select('*').eq('id', user.id).single(),
 supabase.from('user_wishlists').select('*').eq('user_id', user.id),
 supabase.from('price_alerts').select('*').eq('user_id', user.id),
 supabase.from('search_history').select('*').eq('user_id', user.id),
 ]);

 const exportPayload = {
 exported_at: new Date().toISOString(),
 user: profile,
 wishlist: wishlists,
 price_alerts: alerts,
 search_history: searches,
 };

 const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
 type: 'application/json',
 });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = `tawveeri-export-${new Date().toISOString()}.json`;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(url);

 toast({
 title: t('settings.dataExported'),
 variant: 'default',
 });
 } catch (error) {
 console.error('Failed to export data:', error);
 toast({
 title: t('settings.dataExportFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setExporting(false);
 }
 };

 if (authLoading || !supabase || loading) {
 return (
 <div className="space-y-6 max-w-5xl">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-32 w-full rounded-xl" />
 <Skeleton className="h-64 w-full rounded-xl" />
 </div>
 );
 }

 if (!user) {
 return null;
 }

 return (
 <div className="space-y-6 max-w-5xl">
 <PageBreadcrumbs items={[{ label: t('dashboard.profileMenu.settings') }]} />

 {/* Header */}
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
 {t('settings.title')}
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.description')}</p>
 </div>

 <div className="space-y-6">
 {/* Notification Preferences */}
 <Card>
 <CardHeader>
 <CardTitle>{t('settings.notifications')}</CardTitle>
 <CardDescription>
 {t('settings.notificationsDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {(
 [
 ['email', t('settings.emailNotifications')],
 ['sms', t('settings.smsNotifications')],
 ['push', t('settings.pushNotifications')],
 ['price', t('settings.priceAlerts')],
 ['stock', t('settings.stockAlerts')],
 ['deal', t('settings.dealAlerts')],
 ] satisfies Array<[keyof NotificationSettings, string]>
 ).map(([key, label]) => (
 <div key={key} className="flex items-center justify-between gap-4">
 <Label className="text-label-lg text-on-surface-variant">
 {label}
 </Label>
 <Switch
 checked={notificationSettings[key]}
 onCheckedChange={(value) =>
 setNotificationSettings((prev) => ({ ...prev, [key]: value }))
 }
 />
 </div>
 ))}
 </CardContent>
 </Card>

 {/* Privacy Settings */}
 <Card>
 <CardHeader>
 <CardTitle>{t('settings.privacy')}</CardTitle>
 <CardDescription>
 {t('settings.privacyDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between gap-4">
 <Label className="text-label-lg text-on-surface-variant">
 {t('settings.profileVisibility')}
 </Label>
 <Switch
 checked={privacySettings.publicProfile}
 onCheckedChange={(value) =>
 setPrivacySettings((prev) => ({ ...prev, publicProfile: value }))
 }
 />
 </div>
 <div className="flex items-center justify-between gap-4">
 <Label className="text-label-lg text-on-surface-variant">
 {t('settings.searchHistory')}
 </Label>
 <Switch
 checked={privacySettings.shareSearchHistory}
 onCheckedChange={(value) =>
 setPrivacySettings((prev) => ({ ...prev, shareSearchHistory: value }))
 }
 />
 </div>
 </CardContent>
 </Card>

 {/* Application Preferences */}
 <Card>
 <CardHeader>
 <CardTitle>{t('settings.preferences')}</CardTitle>
 <CardDescription>
 {t('settings.preferencesDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>{t('settings.language')}</Label>
 <Select
 value={appPreferences.language}
 onValueChange={(value) =>
 setAppPreferences((prev) => ({ ...prev, language: value as 'ar' | 'en' }))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="ar">{t('settings.arabic')}</SelectItem>
 <SelectItem value="en">{t('settings.english')}</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>{t('settings.theme')}</Label>
 <Select
 value={appPreferences.theme}
 onValueChange={(value) =>
 setAppPreferences((prev) => ({ ...prev, theme: value as AppPreferences['theme'] }))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="light">{t('settings.light')}</SelectItem>
 <SelectItem value="dark">{t('settings.dark')}</SelectItem>
 <SelectItem value="system">{t('settings.system')}</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Data Management */}
 <Card>
 <CardHeader>
 <CardTitle>{t('settings.dataManagement')}</CardTitle>
 <CardDescription>
 {t('settings.dataManagementDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-sm text-on-surface-variant font-medium">
 {t('settings.exportData')}
 </p>
 <p className="text-body-sm text-on-surface-variant">
 {t('settings.exportDataDescription')}
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={handleExportData}
 disabled={exporting}
 className="flex items-center gap-2"
 >
 <Download className="w-4 h-4" />
 {exporting ? t('settings.exporting') : t('settings.exportData')}
 </Button>
 </div>

 <Alert className="border-red-200 bg-red-50">
 <AlertTriangle className="h-4 w-4 text-red-600" />
 <AlertDescription className="flex flex-col gap-3">
 <div>
 <p className="text-label-lg text-red-700">
 {t('settings.deleteAccount')}
 </p>
 <p className="text-body-sm text-red-600">
 {t('settings.deleteAccountDescription')}
 </p>
 </div>
 <div className="flex gap-2">
 <Button
 variant="destructive"
 size="sm"
 onClick={() => router.push(`/${locale}/profile`)}
 className="flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 {t('settings.deleteAccount')}
 </Button>
 <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/profile`)}>
 {t('settings.cancel')}
 </Button>
 </div>
 </AlertDescription>
 </Alert>
 </CardContent>
 </Card>

 <div className="flex justify-end">
 <Button
 size="lg"
 onClick={handleSave}
 disabled={saving}
 className="flex items-center gap-2"
 >
 <Save className="w-4 h-4" />
 {saving ? t('settings.saving') : t('settings.savePreferences')}
 </Button>
 </div>
 </div>
 </div>
 );
}
