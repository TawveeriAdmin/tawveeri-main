import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Trash2, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { getSavedSearches, deleteSavedSearch, type SavedSearch } from '@/src/lib/search/saved-searches';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { EmptyState } from '@/src/components/ui';

export default function SavedSearchesScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSearches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSavedSearches(user.id);
      setSearches(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadSearches(); }, [loadSearches]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSavedSearch(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      Alert.alert(
        locale === 'ar' ? 'خطأ' : 'Error',
        locale === 'ar' ? 'فشل حذف البحث' : 'Failed to delete search',
      );
    }
  }, [locale]);

  const handleExecute = useCallback((search: SavedSearch) => {
    router.push({
      pathname: '/(tabs)/search',
      params: { query: search.query, category: search.category || 'all' },
    });
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon={<Search size={48} color={colors.tertiaryLabel} strokeWidth={1.2} />}
          title={locale === 'ar' ? 'سجل دخولك أولاً' : 'Sign in first'}
          message={locale === 'ar' ? 'سجل دخولك لحفظ عمليات البحث' : 'Sign in to save your searches'}
          actionLabel={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          onAction={() => router.push('/(auth)/login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={[]}>
      <FlatList
        data={searches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Search size={48} color={colors.tertiaryLabel} strokeWidth={1.2} />}
              title={locale === 'ar' ? 'لا توجد بحوث محفوظة' : 'No saved searches'}
              message={locale === 'ar' ? 'احفظ عمليات البحث للرجوع إليها لاحقاً' : 'Save searches to revisit them later'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleExecute(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.card, flexDirection: rtl.row },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
              <Search size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: rtl.isRTL ? 0 : spacing.md, marginRight: rtl.isRTL ? spacing.md : 0 }}>
              <Text style={[typography.body, { color: colors.label, fontWeight: '500', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
                {item.query}
              </Text>
              <View style={{ flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                <Clock size={12} color={colors.tertiaryLabel} />
                <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
                  {formatDate(item.created_at)}
                </Text>
                {item.category && item.category !== 'all' && (
                  <View style={[styles.catBadge, { backgroundColor: colors.tertiaryFill }]}>
                    <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
                      {item.category}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              hitSlop={8}
              style={{ padding: spacing.xs }}
            >
              <Trash2 size={18} color={colors.systemRed} strokeWidth={1.5} />
            </Pressable>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
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
  catBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
});
