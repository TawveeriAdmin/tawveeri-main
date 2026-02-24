'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Phone, ArrowLeft, Moon, Sun, Languages, CheckCircle, Loader2, Eye, EyeOff, Lock } from 'lucide-react';

type PhoneStep = 'phone' | 'otp' | 'password';

export default function ForgotPasswordPage() {
 const t = useTranslations();
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const isRTL = locale === 'ar';
 const { theme, setTheme } = useTheme();
 const { resetPassword } = useAuth();
 const { toast } = useToast();
 const [mounted, setMounted] = useState(false);
 const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
 const [resetSent, setResetSent] = useState(false);
 const [isLoading, setIsLoading] = useState(false);

 // Phone reset state
 const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
 const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [resendCooldown, setResendCooldown] = useState(0);
 const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

 const [formData, setFormData] = useState({
 email: '',
 phone: '',
 });

 useEffect(() => {
 setMounted(true);
 }, []);

 // Resend cooldown timer
 useEffect(() => {
 if (resendCooldown > 0) {
   const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
   return () => clearTimeout(timer);
 }
 }, [resendCooldown]);

 const handleSendReset = async (e: React.FormEvent) => {
 e.preventDefault();

 if (resetMethod === 'email' && !formData.email) {
 toast({
 title: t('auth.validation.emailRequired') || 'Email required',
 description: 'Please enter your email address',
 variant: 'destructive',
 });
 return;
 }

 if (resetMethod === 'phone' && !formData.phone) {
 toast({
 title: t('auth.validation.phoneRequired') || 'Phone required',
 description: 'Please enter your phone number',
 variant: 'destructive',
 });
 return;
 }

 setIsLoading(true);

 try {
 if (resetMethod === 'email') {
 const { error } = await resetPassword(formData.email);

 if (error) {
 throw error;
 }

 toast({
 title: t('auth.resetSent') || 'Reset link sent!',
 description: t('auth.checkEmail') || 'Please check your email for the password reset link',
 variant: 'default',
 });

 setResetSent(true);
 } else {
   // Phone reset: send OTP
   await handleSendPhoneOtp();
 }
 } catch (error) {
 console.error('Password reset error:', error);

 let errorMessage = t('auth.somethingWrong') || 'Failed to send reset link. Please try again.';

 const errorMessageText = error instanceof Error ? error.message : '';

 if (errorMessageText?.includes('User not found') || errorMessageText?.includes('not found')) {
 errorMessage = t('auth.emailNotRegistered');
 } else if (errorMessageText?.includes('Invalid email')) {
 errorMessage = t('auth.validation.emailInvalid');
 } else if (errorMessageText?.includes('rate limit')) {
 errorMessage = t('auth.tooManyAttempts');
 }

 toast({
 title: t('auth.resetError') || 'Reset failed',
 description: errorMessage,
 variant: 'destructive',
 });
 } finally {
 setIsLoading(false);
 }
 };

 const handleSendPhoneOtp = async () => {
  try {
    const response = await fetch('/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formData.phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send OTP');
    }

    toast({
      title: t('auth.otpSent'),
      description: t('auth.otpSentDescription'),
    });

    setPhoneStep('otp');
    setResendCooldown(60);
    setOtpDigits(['', '', '', '', '', '']);
    // Focus first OTP input
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send OTP';
    toast({
      title: t('auth.otpError'),
      description: msg,
      variant: 'destructive',
    });
    throw error;
  }
 };

 const handleOtpChange = (index: number, value: string) => {
  if (!/^\d*$/.test(value)) return;
  const digit = value.slice(-1);
  const newDigits = [...otpDigits];
  newDigits[index] = digit;
  setOtpDigits(newDigits);

  // Auto-advance to next input
  if (digit && index < 5) {
    otpRefs.current[index + 1]?.focus();
  }
 };

 const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
  if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
    otpRefs.current[index - 1]?.focus();
  }
 };

 const handleOtpPaste = (e: React.ClipboardEvent) => {
  e.preventDefault();
  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
  const newDigits = [...otpDigits];
  for (let i = 0; i < pasted.length; i++) {
    newDigits[i] = pasted[i];
  }
  setOtpDigits(newDigits);
  const nextFocusIdx = Math.min(pasted.length, 5);
  otpRefs.current[nextFocusIdx]?.focus();
 };

 const handleVerifyOtp = () => {
  const otp = otpDigits.join('');
  if (otp.length !== 6) {
    toast({
      title: t('auth.validation.otpRequired'),
      description: t('auth.validation.otpInvalid'),
      variant: 'destructive',
    });
    return;
  }
  setPhoneStep('password');
 };

 const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();

  if (newPassword.length < 8) {
    toast({
      title: t('auth.validation.passwordTooShort'),
      variant: 'destructive',
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    toast({
      title: t('auth.validation.passwordMismatch'),
      variant: 'destructive',
    });
    return;
  }

  setIsLoading(true);

  try {
    const response = await fetch('/api/auth/reset-password-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formData.phone,
        otp: otpDigits.join(''),
        newPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }

    toast({
      title: t('auth.phoneResetSuccess') || 'Password reset successful!',
      description: t('auth.phoneResetSuccessDesc') || 'You can now sign in with your new password.',
    });

    // Redirect to login after a short delay
    setTimeout(() => {
      router.push(`/${locale}/auth/login`);
    }, 2000);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to reset password';
    toast({
      title: t('auth.resetError'),
      description: msg,
      variant: 'destructive',
    });
  } finally {
    setIsLoading(false);
  }
 };

 const handleResendOtp = async () => {
  if (resendCooldown > 0) return;
  setIsLoading(true);
  try {
    await handleSendPhoneOtp();
  } catch {
    // Error already handled in handleSendPhoneOtp
  } finally {
    setIsLoading(false);
  }
 };

 const renderPhoneResetFlow = () => {
  switch (phoneStep) {
    case 'phone':
      return (
        <form onSubmit={handleSendReset} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-label-lg text-on-surface">
              {t('auth.phoneNumber')}
            </label>
            <div className="relative">
              <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
                <Phone className="w-5 h-5" />
              </div>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t('auth.phonePlaceholder')}
                className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                required
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ color: '#ffffff' }}
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            <span style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
              color: '#ffffff'
            }}>
              {isLoading ? t('auth.sendingOtp') : t('auth.sendVerificationCode')}
            </span>
          </button>
        </form>
      );

    case 'otp':
      return (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-on-surface-variant text-sm">
              {t('auth.otpSentDescription')}
            </p>
            <p className="text-on-surface font-medium text-sm" dir="ltr">
              {formData.phone}
            </p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-2" dir="ltr" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            ))}
          </div>

          <button
            onClick={handleVerifyOtp}
            disabled={otpDigits.join('').length !== 6}
            className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: '#ffffff' }}
          >
            <span style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
              color: '#ffffff'
            }}>
              {t('auth.verifyOtp') || 'Verify Code'}
            </span>
          </button>

          {/* Resend */}
          <div className="text-center">
            <p className="text-sm text-on-surface-variant">
              {t('auth.didntReceiveOtp')}{' '}
              {resendCooldown > 0 ? (
                <span className="text-on-surface-variant tabular-nums">({resendCooldown}s)</span>
              ) : (
                <button
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="font-semibold text-primary hover:text-primary-600 transition-colors"
                >
                  {t('auth.resendOtp')}
                </button>
              )}
            </p>
          </div>

          {/* Back to phone */}
          <button
            onClick={() => { setPhoneStep('phone'); setOtpDigits(['', '', '', '', '', '']); }}
            className="w-full text-center text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {t('auth.changePhoneNumber') || 'Change phone number'}
          </button>
        </div>
      );

    case 'password':
      return (
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto bg-success-container rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="text-sm text-on-surface-variant">
              {t('auth.phoneVerifiedSetPassword') || 'Phone verified! Set your new password.'}
            </p>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-label-lg text-on-surface">
              {t('auth.newPassword') || 'New Password'}
            </label>
            <div className="relative">
              <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors`}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-label-lg text-on-surface">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                required
                minLength={8}
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-error">{t('auth.validation.passwordMismatch')}</p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="text-xs text-success">{t('auth.validation.passwordMatch')}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
            className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ color: '#ffffff' }}
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            <span style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
              color: '#ffffff'
            }}>
              {isLoading
                ? (t('auth.resettingPassword') || 'Resetting...')
                : (t('auth.resetPasswordButton') || 'Reset Password')}
            </span>
          </button>
        </form>
      );
  }
 };

 return (
 <div className="h-screen flex overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
 {/* Left Side - Form */}
 <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface transition-colors duration-300 overflow-y-auto">
 <div className="w-full max-w-md space-y-8 py-8">
 {/* Header with Back Button, Logo, Theme & Language Toggle */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Link
 href={`/${locale}/auth/login`}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200 group"
 aria-label="Back to login"
 >
 <ArrowLeft className={`w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors ${isRTL ? 'rotate-180' : ''}`} />
 </Link>

 <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white font-bold text-xl">
 {t('app.initial')}
 </div>
 <span className="text-headline-md bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
 {t('app.name')}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200"
 aria-label="Toggle theme"
 >
 {mounted && (
 theme === 'dark' ? (
 <Sun className="w-5 h-5 text-featured-500" />
 ) : (
 <Moon className="w-5 h-5 text-primary" />
 )
 )}
 </button>

 <Link
 href={locale === 'ar' ? '/en/auth/forgot-password' : '/ar/auth/forgot-password'}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200"
 aria-label="Toggle language"
 >
 <Languages className="w-5 h-5 text-primary" />
 </Link>
 </div>
 </div>

 {/* Forgot Password Header */}
 {!resetSent ? (
 <>
 <div>
 <h1 className="text-4xl font-bold text-on-surface mb-2">
 {t('auth.forgotPassword')}
 </h1>
 <p className="text-on-surface-variant">
 {locale === 'ar'
 ? 'أدخل بريدك الإلكتروني أو رقم جوالك لإعادة تعيين كلمة المرور'
 : 'Enter your email or phone number to reset your password'}
 </p>
 </div>

 {/* Email/Phone Tabs */}
 <div className="flex gap-2 p-1 bg-surface-container-highest rounded-xl">
 <button
 type="button"
 onClick={() => { setResetMethod('email'); setPhoneStep('phone'); }}
 className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
 resetMethod === 'email'
 ? 'bg-surface-container-lowest text-primary'
 : 'text-on-surface-variant hover:text-on-surface'
 }`}
 >
 <Mail className="w-4 h-4" />
 {t('auth.emailTab')}
 </button>
 <button
 type="button"
 onClick={() => setResetMethod('phone')}
 className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
 resetMethod === 'phone'
 ? 'bg-surface-container-lowest text-primary'
 : 'text-on-surface-variant hover:text-on-surface'
 }`}
 >
 <Phone className="w-4 h-4" />
 {t('auth.phoneTab')}
 </button>
 </div>

 {/* Form content */}
 {resetMethod === 'email' ? (
 <form onSubmit={handleSendReset} className="space-y-6">
 <div className="space-y-2">
 <label htmlFor="email" className="block text-label-lg text-on-surface">
 {t('auth.emailAddress')}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <Mail className="w-5 h-5" />
 </div>
 <input
 id="email"
 type="email"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 placeholder={t('auth.emailPlaceholder')}
 className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
 required
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={isLoading}
 className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ color: '#ffffff' }}
 >
 <span style={{
 textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
 color: '#ffffff'
 }}>
 {isLoading ? t('auth.sending') : t('auth.sendResetLink')}
 </span>
 </button>

 <p className="text-center text-sm text-on-surface-variant">
 {t('auth.rememberPassword')}{' '}
 <Link
 href={`/${locale}/auth/login`}
 className="font-semibold text-primary hover:text-primary transition-colors"
 >
 {t('auth.signInLink')}
 </Link>
 </p>
 </form>
 ) : (
   <>
     {renderPhoneResetFlow()}
     <p className="text-center text-sm text-on-surface-variant">
       {t('auth.rememberPassword')}{' '}
       <Link
         href={`/${locale}/auth/login`}
         className="font-semibold text-primary hover:text-primary transition-colors"
       >
         {t('auth.signInLink')}
       </Link>
     </p>
   </>
 )}
 </>
 ) : (
 /* Success Message */
 <div className="text-center space-y-6 py-8">
 <div className="flex justify-center">
 <div className="w-20 h-20 bg-success-container rounded-full flex items-center justify-center">
 <CheckCircle className="w-12 h-12 text-success" />
 </div>
 </div>

 <div className="space-y-2">
 <h2 className="text-headline-lg text-on-surface">
 {t('auth.sentSuccessfully')}
 </h2>
 <p className="text-on-surface-variant max-w-sm mx-auto">
 {resetMethod === 'email'
 ? t('auth.resetLinkSent', { email: formData.email })
 : t('auth.verificationCodeSent', { phone: formData.phone })}
 </p>
 </div>

 <div className="space-y-3">
 <button
 onClick={() => setResetSent(false)}
 className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 transform hover:scale-[1.02] transition-all duration-300"
 style={{ color: '#ffffff' }}
 >
 <span style={{
 textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
 color: '#ffffff'
 }}>
 {t('auth.sendAgain')}
 </span>
 </button>

 <Link
 href={`/${locale}/auth/login`}
 className="block w-full py-3.5 bg-surface-container-highest text-on-surface rounded-xl font-semibold hover:bg-surface-container-high transition-all duration-200 text-center"
 >
 {t('auth.backToSignIn')}
 </Link>
 </div>
 </div>
 )}
 </div>
 </main>

 {/* Right Side - Branding */}
 <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 items-center justify-center p-12 relative overflow-hidden">
 <div className="absolute inset-0 opacity-10">
 <div className="absolute top-0 right-0 w-96 h-96">
 <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-transparent rounded-full blur-3xl"></div>
 </div>
 <div className="absolute bottom-0 left-0 w-96 h-96">
 <div className="absolute inset-0 bg-gradient-to-tr from-success-500 to-transparent rounded-full blur-3xl"></div>
 </div>
 </div>

 <div className="absolute top-12 left-12 right-12">
 <div className="w-32 h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl flex items-center justify-center shadow-2xl">
 <div className="text-6xl font-black text-primary/30">
 {t('app.initial')}
 </div>
 </div>
 </div>

 <div className="relative z-10 max-w-lg space-y-8">
 <div className="mb-12">
 <h2 className="text-title-lg mb-4" style={{ color: '#ffffff' }}>{t('app.name')}</h2>
 <h1 className="text-5xl font-bold leading-tight mb-6" style={{ color: '#ffffff' }}>
 {t('auth.resetPassword')}
 </h1>
 <p className="text-lg leading-relaxed" style={{ color: '#d1d5db' }}>
 {t('auth.resetPasswordDescription')}
 </p>
 </div>

 <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
 <h3 className="text-headline-md mb-4" style={{ color: '#ffffff' }}>
 {t('auth.secureAccount')}
 </h3>
 <p className="text-base mb-6" style={{ color: '#d1d5db' }}>
 {t('auth.secureAccountDescription')}
 </p>

 <div className="space-y-3">
 <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
 <CheckCircle className="w-5 h-5 text-success" />
 <span>{t('auth.endToEndEncryption')}</span>
 </div>
 <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
 <CheckCircle className="w-5 h-5 text-success" />
 <span>{t('auth.twoFactorAuth')}</span>
 </div>
 <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
 <CheckCircle className="w-5 h-5 text-success" />
 <span>{t('auth.secureResetLinks')}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
