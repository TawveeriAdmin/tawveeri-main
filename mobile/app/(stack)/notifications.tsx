/**
 * Notifications Screen
 *
 * HIG: .insetGrouped list, filter tabs, swipe actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Bell, TrendingDown, Package, Tag, AlertCircle, CheckCheck } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { formatDate } from '@/src/lib/formatting';
import { EmptyState, Skeleton } from '@/src/components/ui';
import { router } from 'expo-router';

type FilterType = 'all' | 'unread' | 'price_drop' | 'back_in_stock' | 'deal' | 'system';

const ICON_MAP: Record<string, any> = {
  price_drop: TrendingDown,
  back_in_stock: Package,
  deal: Tag,
  system: AlertCircle,
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'unread') query = query.eq('is_read', false);
    else if (filter !== 'all') query = query.eq('type', filter);

    const { data } = await query;
    setNotifications(data || []);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: locale === 'ar' ? 'الكل' : 'All' },
    { key: 'unread', label: locale === 'ar' ? 'غير مقروء' : 'Unread' },
    { key: 'price_drop', label: locale === 'ar' ? 'انخفاض سعر' : 'Price Drop' },
    { key: 'deal', label: locale === 'ar' ? 'عروض' : 'Deals' },
    { key: 'system', label: locale === 'ar' ? 'النظام' : 'System' },
  ];

  if (!user) {
    return (
      <EmptyState
        icon={<Bell size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'سجل دخولك' : 'Sign in'}
        message={locale === 'ar' ? 'سجل دخولك لعرض الإشعارات' : 'Sign in to view notifications'}
        actionLabel={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Filter chips */}
      <FlashList
        data={filters}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f.key}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}

        renderItem={({ item: f }) => (
          <Pressable
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            style={[
              styles.chip,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.secondaryBackground,
                borderRadius: radii.full,
              },
            ]}
          >
            <Text style={[typography.subheadline, { color: filter === f.key ? '#fff' : colors.secondaryLabel }]}>
              {f.label}
            </Text>
          </Pressable>
        )}
      />

      {/* Mark all as read */}
      {notifications.some((n) => !n.is_read) && (
        <Pressable onPress={markAllAsRead} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Text style={[typography.subheadline, { color: colors.primary }]}>
            <CheckCheck size={14} color={colors.primary} /> {locale === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
          </Text>
        </Pressable>
      )}

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={72} style={{ borderRadius: radii.lg }} />
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={48} color={colors.tertiaryLabel} />}
          title={locale === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
          message={locale === 'ar' ? 'ستظهر الإشعارات هنا' : 'Notifications will appear here'}
        />
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
  
          renderItem={({ item }) => {
            const Icon = ICON_MAP[item.type] || Bell;
            const iconColor = item.type === 'price_drop' ? colors.systemGreen
              : item.type === 'deal' ? colors.tertiary
              : colors.secondaryLabel;

            return (
              <Pressable
                onPress={() => markAsRead(item.id)}
                accessibilityRole="button"
                accessibilityLabel={locale === 'ar' ? item.title_ar : item.title_en}
                style={[
                  styles.notifCard,
                  { backgroundColor: item.is_read ? colors.card : colors.primaryContainer, flexDirection: rtl.row },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
                  <Icon size={20} color={iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
                  <Text style={[typography.subheadline, { color: colors.label, fontWeight: item.is_read ? '400' : '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                    {locale === 'ar' ? item.title_ar : item.title_en}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={2}>
                    {locale === 'ar' ? item.message_ar : item.message_en}
                  </Text>
                  <Text style={[typography.caption2, { color: colors.tertiaryLabel, marginTop: 4, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                    {formatDate(item.created_at, locale)}
                  </Text>
                </View>
                {!item.is_read && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  notifCard: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
