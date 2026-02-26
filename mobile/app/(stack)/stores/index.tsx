/**
 * Stores List Screen
 *
 * HIG: Grid of store cards with logo, rating, and product count.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Star, ChevronRight, ChevronLeft, Store } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii } from '@/src/lib/theme/typography';
import { Skeleton } from '@/src/components/ui';

export default function StoresScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      setStores(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width="100%" height={80} style={{ borderRadius: radii.lg }} />
        ))}
      </View>
    );
  }

  return (
    <FlashList
      data={stores}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}

      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/(stack)/store/${item.slug}`)}
          style={[styles.card, { backgroundColor: colors.card, flexDirection: rtl.row }]}
        >
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.logo} contentFit="contain" />
          ) : (
            <View style={[styles.logo, { backgroundColor: colors.tertiaryFill, alignItems: 'center', justifyContent: 'center' }]}>
              <Store size={24} color={colors.tertiaryLabel} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? (item.name_ar || item.name) : (item.name_en || item.name)}
            </Text>
            {item.description && (
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]} numberOfLines={1}>
                {locale === 'ar' ? (item.description_ar || item.description) : (item.description_en || item.description)}
              </Text>
            )}
            {item.rating && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Star size={12} color={colors.systemYellow} fill={colors.systemYellow} />
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginLeft: 2 }]}>
                  {item.rating}
                </Text>
              </View>
            )}
          </View>
          {rtl.isRTL ? <ChevronLeft size={18} color={colors.tertiaryLabel} /> : <ChevronRight size={18} color={colors.tertiaryLabel} />}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
  },
});
