'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Lock, Eye, EyeOff, User, Moon, Sun, Languages, Phone, ArrowLeft, AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import { validateEmail, validatePassword, validatePasswordMatch, validateFullName } from '@/lib/auth-validation';

// Social auth icons (same as login page)
const GoogleIcon = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24">
 <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
 <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
 <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
 </svg>
);

const GitHubIcon = () => (
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.430.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
 </svg>
);

const FacebookIcon = () => (
 <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
 <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
 </svg>
);

// Helper component for error messages
function ErrorMessage({ message, t }: { message: string; t: ReturnType<typeof useTranslations> }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-error" role="alert" aria-live="polite">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{t(`auth.validation.${message}`)}</span>
    </div>
  );
}

// Helper component for success messages
function SuccessMessage({ message, t }: { message: string; t: ReturnType<typeof useTranslations> }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-success">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      <span>{t(`auth.validation.${message}`)}</span>
    </div>
  );
}

export default function SignupPage() {
 const t = useTranslations();
 const params = useParams();
 const locale = (params?.locale as string) || 'ar';
 const isRTL = locale === 'ar';
 const router = useRouter();
 const { theme, setTheme } = useTheme();
 const { signUp, signInWithOAuth } = useAuth();
 const { toast } = useToast();
 const [mounted, setMounted] = useState(false);
 const [isLoading, setIsLoading] = useState(false);

 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [formData, setFormData] = useState({
 fullName: '',
 email: '',
 password: '',
 confirmPassword: '',
 agreeToTerms: false,
 });

 // Validation errors
 const [errors, setErrors] = useState({
 fullName: '',
 email: '',
 password: '',
 confirmPassword: '',
 terms: '',
 });

 // Touched fields (for showing errors only after user interaction)
 const [touched, setTouched] = useState({
 fullName: false,
 email: false,
 password: false,
 confirmPassword: false,
 });

 // Fix hydration mismatch
 useEffect(() => {
 setMounted(true);
 }, []);

 // Real-time validation for full name
 useEffect(() => {
 if (touched.fullName) {
 const result = validateFullName(formData.fullName);
 setErrors(prev => ({ ...prev, fullName: result.isValid ? '' : result.message || '' }));
 }
 }, [formData.fullName, touched.fullName]);

 // Real-time validation for email
 useEffect(() => {
 if (touched.email) {
 const result = validateEmail(formData.email);
 setErrors(prev => ({ ...prev, email: result.isValid ? '' : result.message || '' }));
 }
 }, [formData.email, touched.email]);


 // Real-time validation for password (validate while typing, no need for touch)
 useEffect(() => {
 if (formData.password) {
 const result = validatePassword(formData.password);
 setErrors(prev => ({ ...prev, password: result.isValid ? '' : result.message || '' }));
 } else {
 setErrors(prev => ({ ...prev, password: '' }));
 }
 }, [formData.password]);

 // Real-time validation for password confirmation (validate while typing)
 useEffect(() => {
 if (formData.confirmPassword) {
 const result = validatePasswordMatch(formData.password, formData.confirmPassword);
 setErrors(prev => ({ ...prev, confirmPassword: result.isValid ? '' : result.message || '' }));
 } else {
 setErrors(prev => ({ ...prev, confirmPassword: '' }));
 }
 }, [formData.password, formData.confirmPassword]);


 const handleOAuthSignup = async (provider: 'google' | 'facebook' | 'apple') => {
 setIsLoading(true);
 try {
 const { error } = await signInWithOAuth(provider);

 if (error) {
 throw error;
 }

 // OAuth will redirect to callback, so no need to handle success here
 } catch (error: any) {
 console.error(`${provider} signup error:`, error);

 // Translate common OAuth error messages
 let errorMessage = t('auth.somethingWrong') || 'Something went wrong. Please try again.';

 if (error.message?.includes('popup') || error.message?.includes('window')) {
 errorMessage = t('auth.popupBlocked');
 } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
 errorMessage = t('auth.networkError');
 }

 toast({
 title: t('auth.oauthError') || 'Authentication failed',
 description: errorMessage,
 variant: 'destructive',
 });
 setIsLoading(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 // Mark all fields as touched to show validation errors
 setTouched({
 fullName: true,
 email: true,
 password: true,
 confirmPassword: true,
 });

 // Validate full name
 const fullNameValidation = validateFullName(formData.fullName);
 if (!fullNameValidation.isValid) {
 setErrors(prev => ({ ...prev, fullName: fullNameValidation.message || '' }));
 return;
 }

 // Validate email
 const emailValidation = validateEmail(formData.email);
 if (!emailValidation.isValid) {
 setErrors(prev => ({ ...prev, email: emailValidation.message || '' }));
 return;
 }

 // Validate password
 const passwordValidation = validatePassword(formData.password);
 if (!passwordValidation.isValid) {
 setErrors(prev => ({ ...prev, password: passwordValidation.message || '' }));
 return;
 }

 // Validate password match
 const passwordMatchValidation = validatePasswordMatch(formData.password, formData.confirmPassword);
 if (!passwordMatchValidation.isValid) {
 setErrors(prev => ({ ...prev, confirmPassword: passwordMatchValidation.message || '' }));
 return;
 }

 // Validate terms agreement
 if (!formData.agreeToTerms) {
 setErrors(prev => ({ ...prev, terms: 'termsRequired' }));
 return;
 }

 // All validation passed, proceed with signup
 setIsLoading(true);

 try {
 const signupParams = {
 full_name: formData.fullName,
 password: formData.password,
 preferred_language: locale as 'ar' | 'en',
 email: formData.email,
 };

 const { data, error } = await signUp(signupParams);

 if (error) {
 throw error;
 }

 toast({
 title: t('auth.signupSuccess') || 'Account created successfully',
 description: t('auth.checkEmail') || 'Please check your email to verify your account',
 variant: 'default',
 });

 router.push(`/${locale}`);
 } catch (error: any) {
 console.error('Signup error:', error);

 // Translate common Supabase error messages
 let errorMessage = t('auth.somethingWrong') || 'Something went wrong. Please try again.';

 if (error.message?.includes('User already registered')) {
 errorMessage = t('auth.userAlreadyRegistered');
 } else if (error.message?.includes('Email already exists') || error.message?.includes('already been registered')) {
 errorMessage = t('auth.emailAlreadyRegistered');
 } else if (error.message?.includes('Password should be at least')) {
 errorMessage = locale === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password should be at least 6 characters';
 } else if (error.message?.includes('Invalid email')) {
 errorMessage = locale === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
 }

 toast({
 title: t('auth.signupError') || 'Signup failed',
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
 <main className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface transition-colors duration-300 overflow-y-auto">
 <div className="w-full max-w-md space-y-8 py-8">
 {/* Header with Logo, Back Button, Theme & Language Toggle */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {/* Back Button */}
 <Link
 href={`/${locale}`}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200 group"
 aria-label={t('auth.backToHome')}
 >
 <ArrowLeft className={`w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors ${isRTL ? 'rotate-180' : ''}`} />
 </Link>

 {/* Logo */}
 <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white font-bold text-xl">
 {t('app.initial')}
 </div>
 <span className="text-headline-md bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
 {t('app.name')}
 </span>
 </div>

 {/* Theme & Language Toggle */}
 <div className="flex items-center gap-2">
 {/* Theme Toggle */}
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

 {/* Language Toggle */}
 <Link
 href={locale === 'ar' ? '/en/auth/signup' : '/ar/auth/signup'}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200"
 aria-label="Toggle language"
 >
 <Languages className="w-5 h-5 text-primary" />
 </Link>
 </div>
 </div>

 {/* Sign Up Header */}
 <div>
 <h1 className="text-4xl font-bold text-on-surface mb-2">
 {t('auth.signUp')}
 </h1>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-5">

 {/* Full Name Field */}
 <div>
 <label htmlFor="fullName" className="block text-label-lg text-on-surface mb-2">
 {t('auth.fullName')}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <User className="w-5 h-5" />
 </div>
 <input
 id="fullName"
 type="text"
 value={formData.fullName}
 onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
 onBlur={() => setTouched(prev => ({ ...prev, fullName: true }))}
 placeholder={t('auth.fullNamePlaceholder')}
 className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border ${errors.fullName && touched.fullName ? 'border-warning-500' : 'border-outline-variant'} rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 ${errors.fullName && touched.fullName ? 'focus:ring-warning-500' : 'focus:ring-primary-500'} focus:border-transparent transition-all`}
 />
 </div>
 {touched.fullName && <ErrorMessage message={errors.fullName} t={t} />}
 </div>

 {/* Email Field */}
 <div>
 <label htmlFor="email" className="block text-label-lg text-on-surface mb-2">
 {t('auth.emailAddress')}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <Mail className="w-5 h-5" />
 </div>
 <input
 id="email"
 type="text"
 autoComplete="email"
 inputMode="email"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
 placeholder={t('auth.emailPlaceholder')}
 className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border ${errors.email && touched.email ? 'border-warning-500' : 'border-outline-variant'} rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 ${errors.email && touched.email ? 'focus:ring-warning-500' : 'focus:ring-primary-500'} focus:border-transparent transition-all`}
 />
 </div>
 {touched.email && <ErrorMessage message={errors.email} t={t} />}
 </div>

 {/* Password Field */}
 <div>
 <label htmlFor="password" className="block text-label-lg text-on-surface mb-2">
 {t('auth.password')}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <Lock className="w-5 h-5" />
 </div>
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
 onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
 placeholder={t('auth.passwordPlaceholder')}
 className={`w-full px-12 py-3.5 bg-surface-container border ${errors.password && formData.password ? 'border-warning-500' : 'border-outline-variant'} rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 ${errors.password && formData.password ? 'focus:ring-warning-500' : 'focus:ring-primary-500'} focus:border-transparent transition-all`}
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors`}
 aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
 >
 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 {formData.password && <ErrorMessage message={errors.password} t={t} />}
 </div>

 {/* Confirm Password Field */}
 <div>
 <label htmlFor="confirmPassword" className="block text-label-lg text-on-surface mb-2">
 {t('auth.confirmPassword')}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <Lock className="w-5 h-5" />
 </div>
 <input
 id="confirmPassword"
 type={showConfirmPassword ? 'text' : 'password'}
 value={formData.confirmPassword}
 onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
 onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
 placeholder={t('auth.passwordPlaceholder')}
 className={`w-full px-12 py-3.5 bg-surface-container border ${errors.confirmPassword && formData.confirmPassword ? 'border-warning-500' : formData.confirmPassword && !errors.confirmPassword ? 'border-success-500' : 'border-outline-variant'} rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 ${errors.confirmPassword && formData.confirmPassword ? 'focus:ring-warning-500' : formData.confirmPassword && !errors.confirmPassword ? 'focus:ring-success-500' : 'focus:ring-primary-500'} focus:border-transparent transition-all`}
 />
 <button
 type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors`}
 aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
 >
 {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 {formData.confirmPassword && errors.confirmPassword && <ErrorMessage message={errors.confirmPassword} t={t} />}
 {formData.confirmPassword && !errors.confirmPassword && <SuccessMessage message="passwordMatch" t={t} />}
 </div>

 {/* Terms Agreement */}
 <div>
 <div className="flex items-start gap-2">
 <input
 type="checkbox"
 id="agreeToTerms"
 checked={formData.agreeToTerms}
 onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
 className="w-4 h-4 mt-0.5 rounded border-outline-variant text-primary focus:ring-primary-500 focus:ring-2"
 />
 <label htmlFor="agreeToTerms" className="text-body-sm text-on-surface-variant leading-relaxed">
 {t('auth.termsAgreement')}
 </label>
 </div>
 {errors.terms && <ErrorMessage message={errors.terms} t={t} />}
 </div>

 {/* Sign Up Button */}
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
 {isLoading ? (t('auth.signingUp') || 'Signing up...') : t('auth.signUp')}
 </span>
 </button>

 {/* Continue with Phone Button */}
 <Link
 href={`/${locale}/auth/login`}
 className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 text-on-surface-variant font-medium"
 >
 <Phone className="w-4 h-4" />
 {t('auth.continueWithPhone') || 'Continue with Phone'}
 </Link>

 {/* Divider */}
 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-outline-variant"></div>
 </div>
 <div className="relative flex justify-center text-sm">
 <span className="px-4 bg-surface text-on-surface-variant">
 {t('auth.orContinueWith')}
 </span>
 </div>
 </div>

 {/* Social Sign Up Buttons */}
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => handleOAuthSignup('google')}
 disabled={isLoading}
 className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
 aria-label={t('auth.continueWithGoogle')}
 >
 <GoogleIcon />
 </button>
 <button
 type="button"
 onClick={() => handleOAuthSignup('facebook')}
 disabled={isLoading}
 className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
 aria-label={t('auth.continueWithFacebook')}
 >
 <FacebookIcon />
 </button>
 </div>

 {/* Already have an account? Sign In */}
 <p className="text-center text-sm text-on-surface-variant">
 {t('auth.hasAccount') || 'Already have an account?'}{' '}
 <Link
 href={`/${locale}/auth/login`}
 className="text-primary font-semibold hover:underline"
 >
 {t('auth.signIn')}
 </Link>
 </p>
 </form>
 </div>
 </main>

 {/* Right Side - Branding (same as login) */}
 <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 items-center justify-center p-12 relative overflow-hidden">
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
 <div className="text-6xl font-black text-primary/30">
 {t('app.initial')}
 </div>
 </div>
 </div>

 <div className="relative z-10 max-w-lg space-y-8">
 {/* Brand Name */}
 <div className="mb-12">
 <h2 className="text-title-lg mb-4" style={{ color: '#ffffff' }}>{t('app.name')}</h2>
 <h1 className="text-5xl font-bold leading-tight mb-6" style={{ color: '#ffffff' }}>
 {t('auth.welcome')}
 </h1>
 <p className="text-lg leading-relaxed" style={{ color: '#d1d5db' }}>
 {t('auth.welcomeDescription')}
 </p>
 </div>

 {/* Feature Card */}
 <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
 <h3 className="text-headline-md mb-4" style={{ color: '#ffffff' }}>
 {t('auth.ctaTitle')}
 </h3>
 <p className="text-base mb-6" style={{ color: '#d1d5db' }}>
 {t('auth.ctaDescription')}
 </p>

 {/* Real, current comparison stat — no fabricated user/avatar count */}
 <div className="flex items-center gap-2">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
 <Tag className="w-5 h-5" style={{ color: '#ffffff' }} />
 </div>
 <span className="text-sm" style={{ color: '#9ca3af' }}>{t('auth.stats.comparableProducts')}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
