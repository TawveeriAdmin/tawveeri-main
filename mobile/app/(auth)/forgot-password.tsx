/**
 * Forgot Password Screen - 3-step phone-based flow
 *
 * Step 1: Enter phone number
 * Step 2: Verify OTP
 * Step 3: Set new password
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { apiClient } from '@/src/lib/api/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button, Input } from '@/src/components/ui';

type Step = 'phone' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { sendPhoneOtp } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhone = (p: string) => p.startsWith('+') ? p : `+966${p.replace(/^0/, '')}`;

  const handleSendOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await sendPhoneOtp(formatPhone(phone));
    setLoading(false);
    if (error) setError(error.message);
    else setStep('otp');
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return;
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      setError(locale === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError(locale === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await apiClient.post('/api/auth/reset-password-phone', {
        phone: formatPhone(phone),
        otp,
        newPassword: password,
      });
      router.dismiss();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Step, { ar: string; en: string }> = {
    phone: { ar: 'استعادة كلمة المرور', en: 'Reset Password' },
    otp: { ar: 'رمز التحقق', en: 'Verification Code' },
    password: { ar: 'كلمة مرور جديدة', en: 'New Password' },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Back Button */}
          <Pressable
            onPress={() => step === 'phone' ? router.back() : setStep(step === 'password' ? 'otp' : 'phone')}
            accessibilityRole="button"
            accessibilityLabel={locale === 'ar' ? 'رجوع' : 'Go back'}
            style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', alignSelf: rtl.alignStart, marginLeft: rtl.isRTL ? 0 : spacing.sm, marginRight: rtl.isRTL ? spacing.sm : 0 }}
            hitSlop={8}
          >
            {rtl.isRTL ? <ArrowRight size={24} color={colors.label} /> : <ArrowLeft size={24} color={colors.label} />}
          </Pressable>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>
              {locale === 'ar' ? titles[step].ar : titles[step].en}
            </Text>

            {error ? (
              <View style={{ backgroundColor: colors.errorContainer, padding: spacing.md, borderRadius: radii.md, marginTop: spacing.md }}>
                <Text style={[typography.footnote, { color: colors.error, textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }]}>{error}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              {step === 'phone' && (
                <>
                  <Input
                    label={locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="05xxxxxxxx"
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoFocus
                  />
                  <Button title={locale === 'ar' ? 'إرسال الرمز' : 'Send Code'} onPress={handleSendOtp} loading={loading} fullWidth style={{ marginTop: spacing.lg }} />
                </>
              )}

              {step === 'otp' && (
                <>
                  <Input
                    label={locale === 'ar' ? 'رمز التحقق' : 'OTP Code'}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="000000"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    autoFocus
                  />
                  <Button title={locale === 'ar' ? 'تحقق' : 'Verify'} onPress={handleVerifyOtp} loading={loading} fullWidth style={{ marginTop: spacing.lg }} />
                </>
              )}

              {step === 'password' && (
                <>
                  <Input
                    label={locale === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="newPassword"
                    autoFocus
                  />
                  <View style={{ marginTop: spacing.md }}>
                    <Input
                      label={locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                  </View>
                  <Button title={locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'} onPress={handleResetPassword} loading={loading} fullWidth style={{ marginTop: spacing.lg }} />
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
