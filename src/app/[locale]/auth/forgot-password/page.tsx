'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Phone, ArrowLeft, Moon, Sun, Languages, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { theme, setTheme } = useTheme();
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [resetSent, setResetSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
  });

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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
        // Phone reset is not directly supported by Supabase auth.resetPasswordForEmail
        // You'd need to implement a custom OTP system for phone reset
        toast({
          title: t('auth.phoneResetNotSupported') || 'Phone reset coming soon',
          description: 'Phone-based password reset is not yet available. Please use email.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);

      // Translate common Supabase error messages
      let errorMessage = t('auth.somethingWrong') || 'Failed to send reset link. Please try again.';

      const errorMessageText = error instanceof Error ? error.message : '';

      if (errorMessageText?.includes('User not found') || errorMessageText?.includes('not found')) {
        errorMessage = locale === 'ar' ? 'البريد الإلكتروني غير مسجل' : 'Email not registered';
      } else if (errorMessageText?.includes('Invalid email')) {
        errorMessage = locale === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      } else if (errorMessageText?.includes('rate limit')) {
        errorMessage = locale === 'ar' ? 'تم تجاوز الحد المسموح. الرجاء المحاولة لاحقاً' : 'Too many attempts. Please try again later';
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

  return (
    <div className="h-screen flex overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-gray-900 transition-colors duration-300 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-8">
          {/* Header with Back Button, Logo, Theme & Language Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Back to Login Button */}
              <Link
                href={`/${locale}/auth/login`}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 group"
                aria-label="Back to login"
              >
                <ArrowLeft className={`w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
              </Link>

              {/* Logo */}
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {t('app.initial')}
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                {t('app.name')}
              </span>
            </div>

            {/* Theme & Language Toggle */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {mounted && (
                  theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-featured-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-primary-600" />
                  )
                )}
              </button>

              {/* Language Toggle */}
              <Link
                href={locale === 'ar' ? '/en/auth/forgot-password' : '/ar/auth/forgot-password'}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                aria-label="Toggle language"
              >
                <Languages className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </Link>
            </div>
          </div>

          {/* Forgot Password Header */}
          {!resetSent ? (
            <>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('auth.forgotPassword')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {locale === 'ar'
                    ? 'أدخل بريدك الإلكتروني أو رقم جوالك لإعادة تعيين كلمة المرور'
                    : 'Enter your email or phone number to reset your password'}
                </p>
              </div>

              {/* Email/Phone Tabs */}
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setResetMethod('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    resetMethod === 'email'
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  {t('auth.phoneTab')}
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendReset} className="space-y-6">
                {/* Email or Phone Field */}
                {resetMethod === 'email' ? (
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative">
                      <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t('auth.emailPlaceholder')}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {t('auth.phoneNumber')}
                    </label>
                    <div className="relative">
                      <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`}>
                        <Phone className="w-5 h-5" />
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t('auth.phonePlaceholder')}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Send Reset Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-[1.02] transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: '#ffffff' }}
                >
                  <span style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                    color: '#ffffff'
                  }}>
                    {isLoading
                      ? (locale === 'ar' ? 'جاري الإرسال...' : 'Sending...')
                      : resetMethod === 'email'
                        ? (locale === 'ar' ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link')
                        : (locale === 'ar' ? 'إرسال رمز التحقق' : 'Send Verification Code')}
                  </span>
                </button>

                {/* Back to Sign In Link */}
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {locale === 'ar' ? 'تذكرت كلمة المرور؟' : 'Remember your password?'}{' '}
                  <Link
                    href={`/${locale}/auth/login`}
                    className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    {t('auth.signInLink')}
                  </Link>
                </p>
              </form>
            </>
          ) : (
            /* Success Message */
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-success-600 dark:text-success-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {locale === 'ar' ? 'تم الإرسال!' : 'Sent Successfully!'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                  {resetMethod === 'email'
                    ? (locale === 'ar'
                      ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${formData.email}`
                      : `A password reset link has been sent to ${formData.email}`)
                    : (locale === 'ar'
                      ? `تم إرسال رمز التحقق إلى ${formData.phone}`
                      : `A verification code has been sent to ${formData.phone}`)}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setResetSent(false)}
                  className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-[1.02] transition-all duration-300 shadow-lg"
                  style={{ color: '#ffffff' }}
                >
                  <span style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                    color: '#ffffff'
                  }}>
                    {locale === 'ar' ? 'أرسل مرة أخرى' : 'Send Again'}
                  </span>
                </button>

                <Link
                  href={`/${locale}/auth/login`}
                  className="block w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-center"
                >
                  {locale === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Branding (same as login/signup) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 dark:from-black dark:via-gray-950 dark:to-gray-900 items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-transparent rounded-full blur-3xl"></div>
          </div>
          <div className="absolute bottom-0 left-0 w-96 h-96">
            <div className="absolute inset-0 bg-gradient-to-tr from-success-500 to-transparent rounded-full blur-3xl"></div>
          </div>
        </div>

        {/* Large Logo */}
        <div className="absolute top-12 left-12 right-12">
          <div className="w-32 h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl flex items-center justify-center shadow-2xl">
            <div className="text-6xl font-black text-primary-400/30">
              {t('app.initial')}
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-8">
          {/* Brand Name */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4" style={{ color: '#ffffff' }}>{t('app.name')}</h2>
            <h1 className="text-5xl font-bold leading-tight mb-6" style={{ color: '#ffffff' }}>
              {locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password'}
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: '#d1d5db' }}>
              {locale === 'ar'
                ? 'لا تقلق! يحدث هذا للجميع. سنساعدك على استعادة حسابك بسرعة وأمان.'
                : "Don't worry! This happens to everyone. We'll help you recover your account quickly and securely."}
            </p>
          </div>

          {/* Feature Card */}
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4" style={{ color: '#ffffff' }}>
              {locale === 'ar' ? 'حساب آمن' : 'Secure Account'}
            </h3>
            <p className="text-base mb-6" style={{ color: '#d1d5db' }}>
              {locale === 'ar'
                ? 'نستخدم أحدث معايير الأمان لحماية بياناتك الشخصية ومعلومات حسابك.'
                : 'We use the latest security standards to protect your personal data and account information.'}
            </p>

            {/* Security Features */}
            <div className="space-y-3">
              <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
                <CheckCircle className="w-5 h-5 text-success-400" />
                <span>{locale === 'ar' ? 'تشفير من طرف إلى طرف' : 'End-to-end encryption'}</span>
              </div>
              <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
                <CheckCircle className="w-5 h-5 text-success-400" />
                <span>{locale === 'ar' ? 'مصادقة ثنائية' : 'Two-factor authentication'}</span>
              </div>
              <div className="flex items-center gap-3" style={{ color: '#d1d5db' }}>
                <CheckCircle className="w-5 h-5 text-success-400" />
                <span>{locale === 'ar' ? 'روابط آمنة لإعادة التعيين' : 'Secure reset links'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
