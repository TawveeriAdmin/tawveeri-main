/**
 * Price Alerts Screen
 *
 * HIG: Segmented control for Active/Triggered tabs, list with progress indicators.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Bell, Trash2, TrendingDown, Check } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { formatPrice } from '@/src/lib/utils';
import { SARSymbol } from '@/src/components/ui/SARSymbol';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Price, Badge, EmptyState, Skeleton, KeyedProductImage } from '@/src/components/ui';

type Tab = 'active' | 'triggered';

export default function PriceAlertsScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('price_alerts')
      .select('*, products(name, name_ar, name_en, slug, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const deleteAlert = async (id: string) => {
    await supabase.from('price_alerts').delete().eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      locale === 'ar' ? 'حذف التنبيه' : 'Delete Alert',
      locale === 'ar' ? 'هل تريد حذف هذا التنبيه؟' : 'Delete this price alert?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'حذف' : 'Delete', style: 'destructive', onPress: () => deleteAlert(id) },
      ],
    );
  };

  const filteredAlerts = alerts.filter((a) =>
    tab === 'active' ? !a.is_triggered : a.is_triggered
  );

  if (!user) {
    return (
      <EmptyState
        icon={<Bell size={48} color={colors.tertiaryLabel} />}
        title={locale === 'ar' ? 'سجل دخولك' : 'Sign in'}
        message={locale === 'ar' ? 'سجل دخولك لإنشاء تنبيهات الأسعار' : 'Sign in to create price alerts'}
        actionLabel={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
        onAction={() => router.push('/(auth)/login')}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Segmented Control */}
      <View style={[styles.segmented, { backgroundColor: colors.tertiaryFill, marginHorizontal: spacing.lg, marginTop: spacing.md }]}>
        {(['active', 'triggered'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            accessibilityLabel={t === 'active' ? (locale === 'ar' ? 'التنبيهات النشطة' : 'Active alerts') : (locale === 'ar' ? 'التنبيهات المفعّلة' : 'Triggered alerts')}
            style={[
              styles.segmentItem,
              tab === t && { backgroundColor: colors.card, borderRadius: radii.sm, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
            ]}
          >
            {t === 'active'
              ? <Bell size={14} color={tab === t ? colors.primary : colors.secondaryLabel} />
              : <Check size={14} color={tab === t ? colors.systemGreen : colors.secondaryLabel} />
            }
            <Text style={[typography.subheadline, { color: tab === t ? colors.label : colors.secondaryLabel, fontWeight: tab === t ? '600' : '400', marginLeft: 4 }]}>
              {t === 'active'
                ? (locale === 'ar' ? 'نشطة' : 'Active')
                : (locale === 'ar' ? 'تم تفعيلها' : 'Triggered')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={96} style={{ borderRadius: radii.lg }} />
          ))}
        </View>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<TrendingDown size={48} color={colors.tertiaryLabel} />}
          title={tab === 'active'
            ? (locale === 'ar' ? 'لا توجد تنبيهات نشطة' : 'No active alerts')
            : (locale === 'ar' ? 'لا توجد تنبيهات مفعّلة' : 'No triggered alerts')}
          message={locale === 'ar' ? 'أنشئ تنبيهات من صفحة المنتج' : 'Create alerts from the product page'}
        />
      ) : (
        <FlashList
          data={filteredAlerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}

          renderItem={({ item }) => {
            const product = item.products;
            const currentPrice = item.current_price || 0;
            const targetPrice = item.target_price || 0;
            const progress = currentPrice > 0 && targetPrice > 0
              ? Math.min(1, Math.max(0, 1 - (currentPrice - targetPrice) / currentPrice))
              : 0;

            return (
              <Pressable
                onPress={() => product?.slug && router.push(`/(stack)/product/${product.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name)}
                style={[styles.alertCard, { backgroundColor: colors.card, flexDirection: rtl.row }]}
              >
                {product?.image_url && (
                  <KeyedProductImage uri={product.image_url} style={styles.alertImage} contentFit="contain" />
                )}
                <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
                  <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600' }]} numberOfLines={2}>
                    {locale === 'ar' ? (product?.name_ar || product?.name) : (product?.name_en || product?.name)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                    <View>
                      <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                        {locale === 'ar' ? 'الحالي' : 'Current'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={[typography.subheadline, { color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                          {formatPrice(currentPrice)}
                        </Text>
                        <SARSymbol size={10} color={colors.primary} />
                      </View>
                    </View>
                    <View>
                      <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                        {locale === 'ar' ? 'المستهدف' : 'Target'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={[typography.subheadline, { color: colors.systemGreen, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                          {formatPrice(targetPrice)}
                        </Text>
                        <SARSymbol size={10} color={colors.primary} />
                      </View>
                    </View>
                  </View>
                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.tertiaryFill }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.systemGreen }]} />
                  </View>
                </View>
                <Pressable onPress={() => confirmDelete(item.id)} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'حذف التنبيه' : 'Delete alert'} style={styles.deleteBtn} hitSlop={8}>
                  <Trash2 size={18} color={colors.systemRed} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.md,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  alertCard: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  alertImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  deleteBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
