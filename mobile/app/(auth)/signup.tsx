/**
 * Signup Screen - Name + email collection for new phone OTP users
 */

import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useAuth } from '@/src/lib/auth/auth-context';
import { typography, spacing } from '@/src/lib/theme/typography';
import { Button, Input } from '@/src/components/ui';

export default function SignupScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const { signInWithPhone } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; otp?: string }>();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !params.phone || !params.otp) return;

    if (!isEmailValid) {
      setError(locale === 'ar' ? 'الرجاء إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await signInWithPhone(params.phone, params.otp, {
      fullName: fullName.trim(),
      email: email.trim(),
      preferredLanguage: locale as 'ar' | 'en',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.dismiss();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
          <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', textAlign: 'center' }]}>
            {locale === 'ar' ? 'مرحباً!' : 'Welcome!'}
          </Text>
          <Text style={[typography.body, { color: colors.secondaryLabel, textAlign: 'center', marginTop: spacing.sm }]}>
            {locale === 'ar' ? 'أكمل بياناتك للمتابعة' : 'Complete your details to continue'}
          </Text>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Input
              label={locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}
              value={fullName}
              onChangeText={setFullName}
              placeholder={locale === 'ar' ? 'أدخل اسمك' : 'Enter your name'}
              textContentType="name"
              autoFocus
            />

            <Input
              label={locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              value={email}
              onChangeText={(text) => { setEmail(text); setError(''); }}
              placeholder="example@gmail.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              error={error || undefined}
            />

            <Text style={[typography.caption1, { color: colors.secondaryLabel, textAlign: 'center' }]}>
              {locale === 'ar'
                ? 'نحتاج بريدك الإلكتروني لإرسال تنبيهات الأسعار والإشعارات'
                : 'We need your email to send you price alerts and notifications'}
            </Text>
          </View>

          <Button
            title={locale === 'ar' ? 'متابعة' : 'Continue'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!fullName.trim() || !email.trim()}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
