'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { GuestPrompt } from '@/components/auth/guest-prompt';
import { Bell, Mail, MessageSquare, Monitor, Smartphone } from 'lucide-react';
import { useWebPush } from '@/lib/push/use-web-push';

interface NotificationPreferences {
 email_enabled: boolean;
 sms_enabled: boolean;
 push_enabled: boolean;
 in_app_enabled: boolean;
 price_drop_email: boolean;
 price_drop_sms: boolean;
 price_drop_push: boolean;
 deals_email: boolean;
 deals_sms: boolean;
 deals_push: boolean;
 back_in_stock_email: boolean;
 back_in_stock_sms: boolean;
 back_in_stock_push: boolean;
 account_updates_email: boolean;
 account_updates_push: boolean;
 frequency: 'immediate' | 'daily' | 'weekly';
}

const defaultPreferences: NotificationPreferences = {
 email_enabled: true,
 sms_enabled: false,
 push_enabled: true,
 in_app_enabled: true,
 price_drop_email: true,
 price_drop_sms: false,
 price_drop_push: true,
 deals_email: true,
 deals_sms: false,
 deals_push: true,
 back_in_stock_email: true,
 back_in_stock_sms: false,
 back_in_stock_push: true,
 account_updates_email: true,
 account_updates_push: true,
 frequency: 'immediate',
};

export default function NotificationPreferencesPage() {
 const params = useParams();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user, loading: authLoading } = useAuth();
 const { toast } = useToast();
 const isRTL = locale === 'ar';

 const { status: pushStatus, isSupported: pushSupported, subscribe: subscribePush, unsubscribe: unsubscribePush } = useWebPush();
 const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 if (user) {
 loadPreferences();
 } else {
 setLoading(false);
 }
 }, [user]);

 const loadPreferences = async () => {
 if (!user) return;

 try {
 setLoading(true);
 // Load preferences from localStorage for now
 // In future, can be stored in a user_preferences table
 const stored = typeof window !== 'undefined' 
 ? localStorage.getItem(`notification_preferences_${user.id}`)
 : null;
 
 if (stored) {
 try {
 const parsed = JSON.parse(stored);
 setPreferences({
 ...defaultPreferences,
 ...parsed,
 });
 } catch {
 // Invalid JSON, use defaults
 }
 }
 } catch (error) {
 console.error('Error loading preferences:', error);
 } finally {
 setLoading(false);
 }
 };

 const savePreferences = async () => {
 if (!user) return;

 try {
 setSaving(true);
 // Save preferences to localStorage for now
 // In future, can be stored in a user_preferences table
 if (typeof window !== 'undefined') {
 localStorage.setItem(`notification_preferences_${user.id}`, JSON.stringify(preferences));
 }

 // No database operation needed for now

 toast({
 title: t('common.saved'),
 description: t('notifications.preferencesSaved'),
 });
 } catch (error) {
 console.error('Error saving preferences:', error);
 toast({
 title: t('common.error'),
 description: t('notifications.saveError'),
 variant: 'destructive',
 });
 } finally {
 setSaving(false);
 }
 };

 const updatePreference = <K extends keyof NotificationPreferences>(
 key: K,
 value: NotificationPreferences[K]
 ) => {
 setPreferences((prev) => ({ ...prev, [key]: value }));
 };

 if (authLoading) {
 return (
 <div className="space-y-6 max-w-4xl">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-64 w-full rounded-xl" />
 </div>
 );
 }

 if (!user) {
 return (
 <GuestPrompt
 title={t('notifications.title')}
 description={t('notifications.guestDescription')}
 locale={locale}
 />
 );
 }

 if (loading) {
 return (
 <div className="space-y-6 max-w-4xl">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-64 w-full rounded-xl" />
 </div>
 );
 }

 return (
 <div className="space-y-6 max-w-4xl">
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
 {t('notifications.title')}
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {t('notifications.subtitle')}
 </p>
 </div>

 {/* Channel Preferences */}
 <Card>
 <CardHeader>
 <CardTitle>{t('notifications.channels')}</CardTitle>
 <CardDescription>
 {t('notifications.channelsDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Mail className="h-5 w-5 text-on-surface-variant" />
 <div>
 <Label htmlFor="email_enabled">{t('notifications.email')}</Label>
 <p className="text-sm text-on-surface-variant">
 {t('notifications.emailDescription')}
 </p>
 </div>
 </div>
 <Switch
 id="email_enabled"
 checked={preferences.email_enabled}
 onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <MessageSquare className="h-5 w-5 text-on-surface-variant" />
 <div>
 <Label htmlFor="sms_enabled">{t('notifications.sms')}</Label>
 <p className="text-sm text-on-surface-variant">
 {t('notifications.smsDescription')}
 </p>
 </div>
 </div>
 <Switch
 id="sms_enabled"
 checked={preferences.sms_enabled}
 onCheckedChange={(checked) => updatePreference('sms_enabled', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Smartphone className="h-5 w-5 text-on-surface-variant" />
 <div>
 <Label htmlFor="push_enabled">
 {t('notifications.push')}
 </Label>
 <p className="text-sm text-on-surface-variant">
 {t('notifications.pushDescription')}
 </p>
 </div>
 </div>
 <Switch
 id="push_enabled"
 checked={preferences.push_enabled}
 onCheckedChange={(checked) => updatePreference('push_enabled', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Monitor className="h-5 w-5 text-on-surface-variant" />
 <div>
 <Label htmlFor="web_push_enabled">
 {t('notifications.webPush')}
 </Label>
 <p className="text-sm text-on-surface-variant">
 {pushStatus === 'subscribed'
 ? t('notifications.webPushSubscribed')
 : pushStatus === 'denied'
 ? t('notifications.webPushDenied')
 : pushStatus === 'unsupported'
 ? t('notifications.webPushUnsupported')
 : pushStatus === 'error'
 ? t('notifications.webPushError')
 : pushStatus === 'loading'
 ? t('notifications.webPushLoading')
 : t('notifications.webPushDescription')}
 </p>
 </div>
 </div>
 <Switch
 id="web_push_enabled"
 checked={pushStatus === 'subscribed'}
 disabled={!pushSupported || pushStatus === 'loading' || pushStatus === 'denied'}
 onCheckedChange={(checked) => {
 if (checked) subscribePush();
 else unsubscribePush();
 }}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Bell className="h-5 w-5 text-on-surface-variant" />
 <div>
 <Label htmlFor="in_app_enabled">
 {t('notifications.inApp')}
 </Label>
 <p className="text-sm text-on-surface-variant">
 {t('notifications.inAppDescription')}
 </p>
 </div>
 </div>
 <Switch
 id="in_app_enabled"
 checked={preferences.in_app_enabled}
 onCheckedChange={(checked) => updatePreference('in_app_enabled', checked)}
 />
 </div>
 </CardContent>
 </Card>

 {/* Notification Types */}
 <Card>
 <CardHeader>
 <CardTitle>{t('notifications.types')}</CardTitle>
 <CardDescription>
 {t('notifications.typesDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Price Drops */}
 <div className="space-y-3">
 <h3 className="font-semibold text-on-surface">
 {t('notifications.priceDropAlerts')}
 </h3>
 <div className="space-y-2 pl-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="price_drop_email">{t('notifications.email')}</Label>
 <Switch
 id="price_drop_email"
 checked={preferences.price_drop_email && preferences.email_enabled}
 disabled={!preferences.email_enabled}
 onCheckedChange={(checked) => updatePreference('price_drop_email', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="price_drop_sms">{t('notifications.sms')}</Label>
 <Switch
 id="price_drop_sms"
 checked={preferences.price_drop_sms && preferences.sms_enabled}
 disabled={!preferences.sms_enabled}
 onCheckedChange={(checked) => updatePreference('price_drop_sms', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="price_drop_push">{t('common.push')}</Label>
 <Switch
 id="price_drop_push"
 checked={preferences.price_drop_push && preferences.push_enabled}
 disabled={!preferences.push_enabled}
 onCheckedChange={(checked) => updatePreference('price_drop_push', checked)}
 />
 </div>
 </div>
 </div>

 {/* Deals */}
 <div className="space-y-3">
 <h3 className="font-semibold text-on-surface">
 {t('notifications.dealsDiscounts')}
 </h3>
 <div className="space-y-2 pl-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="deals_email">{t('notifications.email')}</Label>
 <Switch
 id="deals_email"
 checked={preferences.deals_email && preferences.email_enabled}
 disabled={!preferences.email_enabled}
 onCheckedChange={(checked) => updatePreference('deals_email', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="deals_sms">{t('notifications.sms')}</Label>
 <Switch
 id="deals_sms"
 checked={preferences.deals_sms && preferences.sms_enabled}
 disabled={!preferences.sms_enabled}
 onCheckedChange={(checked) => updatePreference('deals_sms', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="deals_push">{t('common.push')}</Label>
 <Switch
 id="deals_push"
 checked={preferences.deals_push && preferences.push_enabled}
 disabled={!preferences.push_enabled}
 onCheckedChange={(checked) => updatePreference('deals_push', checked)}
 />
 </div>
 </div>
 </div>

 {/* Back in Stock */}
 <div className="space-y-3">
 <h3 className="font-semibold text-on-surface">
 {t('notifications.backInStock')}
 </h3>
 <div className="space-y-2 pl-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="back_in_stock_email">{t('notifications.email')}</Label>
 <Switch
 id="back_in_stock_email"
 checked={preferences.back_in_stock_email && preferences.email_enabled}
 disabled={!preferences.email_enabled}
 onCheckedChange={(checked) => updatePreference('back_in_stock_email', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="back_in_stock_sms">{t('notifications.sms')}</Label>
 <Switch
 id="back_in_stock_sms"
 checked={preferences.back_in_stock_sms && preferences.sms_enabled}
 disabled={!preferences.sms_enabled}
 onCheckedChange={(checked) => updatePreference('back_in_stock_sms', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="back_in_stock_push">{t('common.push')}</Label>
 <Switch
 id="back_in_stock_push"
 checked={preferences.back_in_stock_push && preferences.push_enabled}
 disabled={!preferences.push_enabled}
 onCheckedChange={(checked) => updatePreference('back_in_stock_push', checked)}
 />
 </div>
 </div>
 </div>

 {/* Account Updates */}
 <div className="space-y-3">
 <h3 className="font-semibold text-on-surface">
 {t('notifications.accountUpdates')}
 </h3>
 <div className="space-y-2 pl-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="account_updates_email">{t('notifications.email')}</Label>
 <Switch
 id="account_updates_email"
 checked={preferences.account_updates_email && preferences.email_enabled}
 disabled={!preferences.email_enabled}
 onCheckedChange={(checked) => updatePreference('account_updates_email', checked)}
 />
 </div>
 <div className="flex items-center justify-between">
 <Label htmlFor="account_updates_push">{t('common.push')}</Label>
 <Switch
 id="account_updates_push"
 checked={preferences.account_updates_push && preferences.push_enabled}
 disabled={!preferences.push_enabled}
 onCheckedChange={(checked) => updatePreference('account_updates_push', checked)}
 />
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Frequency Settings */}
 <Card>
 <CardHeader>
 <CardTitle>{t('notifications.frequency')}</CardTitle>
 <CardDescription>
 {t('notifications.frequencyDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 <Label htmlFor="frequency">{t('notifications.frequencyLabel')}</Label>
 <Select
 value={preferences.frequency}
 onValueChange={(value: 'immediate' | 'daily' | 'weekly') =>
 updatePreference('frequency', value)
 }
 >
 <SelectTrigger id="frequency">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="immediate">
 {t('notifications.immediate')}
 </SelectItem>
 <SelectItem value="daily">
 {t('notifications.dailyDigest')}
 </SelectItem>
 <SelectItem value="weekly">
 {t('notifications.weeklyDigest')}
 </SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>

 {/* Save Button */}
 <div className="flex justify-end">
 <Button onClick={savePreferences} disabled={saving}>
 {saving ? t('notifications.saving') : t('notifications.savePreferences')}
 </Button>
 </div>
 </div>
 );
}

