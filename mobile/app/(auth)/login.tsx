/**
 * Login Screen
 *
 * HIG: Sign in with Apple must be same size or larger than other sign-in buttons.
 * Primary: Phone OTP (Saudi market), Secondary: Email/password, OAuth options.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Phone, Mail, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Button, Input } from '@/src/components/ui';

type Tab = 'phone' | 'email';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { sendPhoneOtp, signInWithPhone, signInWithEmail, signInWithOAuth } = useAuth();

  const [tab, setTab] = useState<Tab>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    const formatted = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;
    const { error } = await sendPhoneOtp(formatted);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setOtpSent(true);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    const formatted = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;
    const { data, error } = await signInWithPhone(formatted, otp);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else if (data?.isNewUser && !data?.fullName) {
      // New user without name — go to signup
      router.replace({ pathname: '/(auth)/signup', params: { phone: formatted, otp } });
    } else {
      router.dismiss();
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.dismiss();
    }
  };

  const handleOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setLoading(true);
    setError('');
    const { error } = await signInWithOAuth(provider);
    setLoading(false);
    if (error) setError(error.message);
    else router.dismiss();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Close button */}
          <View style={styles.closeRow}>
            <Pressable onPress={() => router.dismiss()} hitSlop={8} style={styles.closeButton}>
              <X size={24} color={colors.label} />
            </Pressable>
          </View>

          {/* Title */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Text style={[typography.largeTitle, { color: colors.label, fontWeight: '700' }]}>
              {locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </Text>
            <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
              {locale === 'ar' ? 'سجل دخولك لتتبع الأسعار والعروض' : 'Sign in to track prices and deals'}
            </Text>
          </View>

          {/* Tab Switcher (HIG: segmented control) */}
          <View style={[styles.tabBar, { backgroundColor: colors.tertiaryFill, borderRadius: radii.md, marginHorizontal: spacing.lg, marginTop: spacing.lg }]}>
            {(['phone', 'email'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => { setTab(t); setError(''); }}
                accessibilityRole="button"
                accessibilityLabel={t === 'phone' ? (locale === 'ar' ? 'الهاتف' : 'Phone') : (locale === 'ar' ? 'البريد الإلكتروني' : 'Email')}
                style={[
                  styles.tabItem,
                  tab === t && { backgroundColor: colors.card, borderRadius: radii.sm, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
                ]}
              >
                {t === 'phone' ? <Phone size={16} color={tab === t ? colors.primary : colors.secondaryLabel} /> : <Mail size={16} color={tab === t ? colors.primary : colors.secondaryLabel} />}
                <Text style={[typography.subheadline, { color: tab === t ? colors.label : colors.secondaryLabel, fontWeight: tab === t ? '600' : '400', marginLeft: 4 }]}>
                  {t === 'phone' ? (locale === 'ar' ? 'الهاتف' : 'Phone') : (locale === 'ar' ? 'البريد' : 'Email')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Form */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]}>
                <Text style={[typography.footnote, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {tab === 'phone' ? (
              <>
                {!otpSent ? (
                  <>
                    <Input
                      label={locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="05xxxxxxxx"
                      keyboardType="phone-pad"
                      textContentType="telephoneNumber"
                    />
                    <Button
                      title={locale === 'ar' ? 'إرسال رمز التحقق' : 'Send OTP'}
                      onPress={handleSendOtp}
                      loading={loading}
                      fullWidth
                      style={{ marginTop: spacing.lg }}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[typography.body, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
                      {locale === 'ar' ? `أدخل الرمز المرسل إلى ${phone}` : `Enter the code sent to ${phone}`}
                    </Text>
                    <Input
                      label={locale === 'ar' ? 'رمز التحقق' : 'Verification Code'}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="000000"
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      maxLength={6}
                    />
                    <Button
                      title={locale === 'ar' ? 'تحقق' : 'Verify'}
                      onPress={handleVerifyOtp}
                      loading={loading}
                      fullWidth
                      style={{ marginTop: spacing.lg }}
                    />
                    <Pressable onPress={() => { setOtpSent(false); setOtp(''); }} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'تغيير الرقم' : 'Change number'} style={{ marginTop: spacing.md, alignSelf: 'center' }}>
                      <Text style={[typography.subheadline, { color: colors.primary }]}>
                        {locale === 'ar' ? 'تغيير الرقم' : 'Change number'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              <>
                <Input
                  label={locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoCapitalize="none"
                />
                <View style={{ marginTop: spacing.md }}>
                  <Input
                    label={locale === 'ar' ? 'كلمة المرور' : 'Password'}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    textContentType="password"
                  />
                </View>
                <Pressable onPress={() => router.push('/(auth)/forgot-password')} accessibilityRole="button" accessibilityLabel={locale === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'} style={{ marginTop: spacing.sm, alignSelf: 'flex-end' }}>
                  <Text style={[typography.subheadline, { color: colors.primary }]}>
                    {locale === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Text>
                </Pressable>
                <Button
                  title={locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                  onPress={handleEmailLogin}
                  loading={loading}
                  fullWidth
                  style={{ marginTop: spacing.lg }}
                />
              </>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.dividerRow, { marginTop: spacing.xl }]}>
            <View style={[styles.divider, { backgroundColor: colors.separator }]} />
            <Text style={[typography.footnote, { color: colors.tertiaryLabel, marginHorizontal: spacing.md }]}>
              {locale === 'ar' ? 'أو' : 'or'}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.separator }]} />
          </View>

          {/* OAuth Buttons - Apple first (HIG requirement) */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm }}>
            <Button
              title={locale === 'ar' ? 'متابعة مع Apple' : 'Continue with Apple'}
              variant="outlined"
              onPress={() => handleOAuth('apple')}
              fullWidth
            />
            <Button
              title={locale === 'ar' ? 'متابعة مع Google' : 'Continue with Google'}
              variant="outlined"
              onPress={() => handleOAuth('google')}
              fullWidth
            />
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
