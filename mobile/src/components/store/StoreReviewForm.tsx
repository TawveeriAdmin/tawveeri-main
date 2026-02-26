import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button } from '@/src/components/ui';

interface StoreReviewFormProps {
  storeId: string;
  userId: string;
  locale: string;
  onSubmitted: () => void;
  onCancel: () => void;
}

const SUB_RATINGS = [
  { key: 'delivery', label_ar: 'التوصيل', label_en: 'Delivery' },
  { key: 'quality', label_ar: 'الجودة', label_en: 'Quality' },
  { key: 'service', label_ar: 'الخدمة', label_en: 'Service' },
];

export function StoreReviewForm({ storeId, userId, locale, onSubmitted, onCancel }: StoreReviewFormProps) {
  const { colors } = useTheme();
  const rtl = useRTL();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (value: number) => {
    setRating(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubRating = (key: string, value: number) => {
    setSubRatings((prev) => ({ ...prev, [key]: value }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(
        locale === 'ar' ? 'تنبيه' : 'Notice',
        locale === 'ar' ? 'يرجى اختيار تقييم' : 'Please select a rating',
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('store_reviews').insert({
        store_id: storeId,
        user_id: userId,
        rating,
        comment: reviewText.trim() || null,
        sub_ratings: Object.keys(subRatings).length > 0 ? subRatings : null,
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert(
            locale === 'ar' ? 'تنبيه' : 'Notice',
            locale === 'ar' ? 'لقد قمت بتقييم هذا المتجر مسبقاً' : 'You have already reviewed this store',
          );
        } else {
          throw error;
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSubmitted();
      }
    } catch {
      Alert.alert(
        locale === 'ar' ? 'خطأ' : 'Error',
        locale === 'ar' ? 'فشل إرسال التقييم' : 'Failed to submit review',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[typography.title3, { color: colors.label, fontWeight: '600', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection, marginBottom: spacing.lg }]}>
        {locale === 'ar' ? 'اكتب تقييم' : 'Write a Review'}
      </Text>

      {/* Star Rating */}
      <Text style={[typography.subheadline, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection, marginBottom: spacing.sm }]}>
        {locale === 'ar' ? 'التقييم العام' : 'Overall Rating'}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => handleStarPress(s)} hitSlop={4}>
            <Star
              size={32}
              color={s <= rating ? colors.systemYellow : colors.systemGray4}
              fill={s <= rating ? colors.systemYellow : 'none'}
            />
          </Pressable>
        ))}
      </View>

      {/* Sub Ratings */}
      {SUB_RATINGS.map((sub) => (
        <View key={sub.key} style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection, marginBottom: spacing.xs }]}>
            {locale === 'ar' ? sub.label_ar : sub.label_en}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => handleSubRating(sub.key, s)} hitSlop={2}>
                <Star
                  size={20}
                  color={s <= (subRatings[sub.key] || 0) ? colors.systemYellow : colors.systemGray4}
                  fill={s <= (subRatings[sub.key] || 0) ? colors.systemYellow : 'none'}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Review Text */}
      <TextInput
        value={reviewText}
        onChangeText={setReviewText}
        placeholder={locale === 'ar' ? 'اكتب تجربتك مع هذا المتجر...' : 'Share your experience with this store...'}
        placeholderTextColor={colors.tertiaryLabel}
        multiline
        numberOfLines={4}
        style={[
          typography.body,
          {
            color: colors.label,
            backgroundColor: colors.secondaryBackground,
            borderRadius: radii.md,
            padding: spacing.md,
            minHeight: 100,
            textAlignVertical: 'top',
            textAlign: rtl.textAlign,
            writingDirection: rtl.writingDirection,
            marginBottom: spacing.lg,
          },
        ]}
      />

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title={locale === 'ar' ? 'إلغاء' : 'Cancel'}
          variant="ghost"
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <Button
          title={locale === 'ar' ? 'إرسال' : 'Submit'}
          variant="filled"
          onPress={handleSubmit}
          loading={submitting}
          disabled={rating === 0}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
});
