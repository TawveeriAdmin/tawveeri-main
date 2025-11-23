'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
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
import { GuestPrompt } from '@/components/auth/guest-prompt';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const isRTL = locale === 'ar';
  const supabase = getSupabaseBrowserClient();

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
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ تفضيلات الإشعارات بنجاح' : 'Notification preferences saved successfully',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل حفظ التفضيلات' : 'Failed to save preferences',
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <GuestPrompt
            title={isRTL ? 'إعدادات الإشعارات' : 'Notification Settings'}
            description={
              isRTL
                ? 'قم بإنشاء حساب لتخصيص تفضيلات الإشعارات الخاصة بك.'
                : 'Create an account to customize your notification preferences.'
            }
            locale={locale}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isRTL ? 'إعدادات الإشعارات' : 'Notification Settings'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isRTL
                ? 'اختر كيف ومتى تريد تلقي الإشعارات'
                : 'Choose how and when you want to receive notifications'}
            </p>
          </div>

          {/* Channel Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'قنوات الإشعارات' : 'Notification Channels'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'اختر القنوات التي تريد تلقي الإشعارات عليها'
                  : 'Choose the channels you want to receive notifications on'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <Label htmlFor="email_enabled">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL ? 'تلقي إشعارات عبر البريد الإلكتروني' : 'Receive notifications via email'}
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
                  <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <Label htmlFor="sms_enabled">{isRTL ? 'الرسائل النصية (SMS)' : 'SMS'}</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL ? 'تلقي إشعارات عبر الرسائل النصية' : 'Receive notifications via SMS'}
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
                  <Smartphone className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <Label htmlFor="push_enabled">
                      {isRTL ? 'الإشعارات الفورية (Push)' : 'Push Notifications'}
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL ? 'تلقي إشعارات فورية على جهازك' : 'Receive push notifications on your device'}
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
                  <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <Label htmlFor="in_app_enabled">
                      {isRTL ? 'الإشعارات داخل التطبيق' : 'In-App Notifications'}
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL
                        ? 'تلقي إشعارات داخل التطبيق'
                        : 'Receive notifications within the app'}
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
              <CardTitle>{isRTL ? 'أنواع الإشعارات' : 'Notification Types'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'اختر أنواع الإشعارات التي تريد تلقيها'
                  : 'Choose the types of notifications you want to receive'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Drops */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {isRTL ? 'تنبيهات انخفاض الأسعار' : 'Price Drop Alerts'}
                </h3>
                <div className="space-y-2 pl-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="price_drop_email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <Switch
                      id="price_drop_email"
                      checked={preferences.price_drop_email && preferences.email_enabled}
                      disabled={!preferences.email_enabled}
                      onCheckedChange={(checked) => updatePreference('price_drop_email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="price_drop_sms">{isRTL ? 'الرسائل النصية' : 'SMS'}</Label>
                    <Switch
                      id="price_drop_sms"
                      checked={preferences.price_drop_sms && preferences.sms_enabled}
                      disabled={!preferences.sms_enabled}
                      onCheckedChange={(checked) => updatePreference('price_drop_sms', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="price_drop_push">{isRTL ? 'الإشعارات الفورية' : 'Push'}</Label>
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
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {isRTL ? 'العروض والتخفيضات' : 'Deals & Discounts'}
                </h3>
                <div className="space-y-2 pl-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deals_email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <Switch
                      id="deals_email"
                      checked={preferences.deals_email && preferences.email_enabled}
                      disabled={!preferences.email_enabled}
                      onCheckedChange={(checked) => updatePreference('deals_email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deals_sms">{isRTL ? 'الرسائل النصية' : 'SMS'}</Label>
                    <Switch
                      id="deals_sms"
                      checked={preferences.deals_sms && preferences.sms_enabled}
                      disabled={!preferences.sms_enabled}
                      onCheckedChange={(checked) => updatePreference('deals_sms', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deals_push">{isRTL ? 'الإشعارات الفورية' : 'Push'}</Label>
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
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {isRTL ? 'الإشعارات عن التوفر' : 'Back in Stock'}
                </h3>
                <div className="space-y-2 pl-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="back_in_stock_email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <Switch
                      id="back_in_stock_email"
                      checked={preferences.back_in_stock_email && preferences.email_enabled}
                      disabled={!preferences.email_enabled}
                      onCheckedChange={(checked) => updatePreference('back_in_stock_email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="back_in_stock_sms">{isRTL ? 'الرسائل النصية' : 'SMS'}</Label>
                    <Switch
                      id="back_in_stock_sms"
                      checked={preferences.back_in_stock_sms && preferences.sms_enabled}
                      disabled={!preferences.sms_enabled}
                      onCheckedChange={(checked) => updatePreference('back_in_stock_sms', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="back_in_stock_push">{isRTL ? 'الإشعارات الفورية' : 'Push'}</Label>
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
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {isRTL ? 'تحديثات الحساب' : 'Account Updates'}
                </h3>
                <div className="space-y-2 pl-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="account_updates_email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
                    <Switch
                      id="account_updates_email"
                      checked={preferences.account_updates_email && preferences.email_enabled}
                      disabled={!preferences.email_enabled}
                      onCheckedChange={(checked) => updatePreference('account_updates_email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="account_updates_push">{isRTL ? 'الإشعارات الفورية' : 'Push'}</Label>
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
              <CardTitle>{isRTL ? 'تكرار الإشعارات' : 'Notification Frequency'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'اختر عدد مرات تلقي الإشعارات'
                  : 'Choose how often you want to receive notifications'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="frequency">{isRTL ? 'التكرار' : 'Frequency'}</Label>
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
                      {isRTL ? 'فوري' : 'Immediate'}
                    </SelectItem>
                    <SelectItem value="daily">
                      {isRTL ? 'ملخص يومي' : 'Daily Digest'}
                    </SelectItem>
                    <SelectItem value="weekly">
                      {isRTL ? 'ملخص أسبوعي' : 'Weekly Digest'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={savePreferences} disabled={saving}>
              {saving
                ? isRTL
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : isRTL
                ? 'حفظ التفضيلات'
                : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

