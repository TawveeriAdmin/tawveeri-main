'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Lock, Eye, EyeOff, Moon, Sun, Languages, Phone, ArrowLeft, User } from 'lucide-react';

// Social auth icons
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

export default function LoginPage() {
 const t = useTranslations();
 const params = useParams();
 const router = useRouter();
 const searchParams = useSearchParams();
 const locale = (params?.locale as string) || 'ar';
 const isRTL = locale === 'ar';
 const { theme, setTheme } = useTheme();
 const { signInWithEmail, signInWithPhone, signInWithOAuth, sendPhoneOtp, user, loading: authLoading } = useAuth();
 const { toast } = useToast();
 const [mounted, setMounted] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [otpLoading, setOtpLoading] = useState(false);
 const [isNewUser, setIsNewUser] = useState(false);

 const [otpSent, setOtpSent] = useState(false);
 const [formData, setFormData] = useState({
 phone: '',
 otp: '',
 fullName: '',
 rememberMe: false,
 });

 // Fix hydration mismatch
 useEffect(() => {
 setMounted(true);
 }, []);

 const handleSendOtp = async () => {
 if (!formData.phone) {
 toast({
 title: t('auth.validation.phoneRequired') || 'Phone number required',
 variant: 'destructive',
 });
 return;
 }

 try {
 setOtpLoading(true);
 const { error } = await sendPhoneOtp(formData.phone);
 if (error) throw error;

 setOtpSent(true);
 toast({
 title: t('auth.otpSent') || 'OTP sent',
 description: t('auth.otpSentDescription') || 'Check your phone for the verification code.',
 variant: 'default',
 });
 } catch (error: any) {
 console.error('OTP send error:', error);
 toast({
 title: t('auth.otpError') || 'Unable to send OTP',
 description: error?.message || t('auth.somethingWrong') || 'Please try again in a moment.',
 variant: 'destructive',
 });
 } finally {
 setOtpLoading(false);
 }
 };

 const handleOAuthLogin = async (provider: 'google' | 'facebook' | 'apple') => {
 setIsLoading(true);
 try {
 const { error } = await signInWithOAuth(provider);

 if (error) {
 throw error;
 }

 // OAuth will redirect to callback, so no need to handle success here
 } catch (error: any) {
 console.error(`${provider} login error:`, error);

 // Translate common OAuth error messages
 let errorMessage = t('auth.somethingWrong') || 'Something went wrong. Please try again.';

 if (error.message?.includes('popup') || error.message?.includes('window')) {
 errorMessage = t('auth.popupBlocked');
 } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
 errorMessage = t('auth.networkError');
 }

 toast({
 title: t('auth.loginError') || 'Login failed',
 description: errorMessage,
 variant: 'destructive',
 });
 setIsLoading(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!otpSent) {
 toast({
 title: t('auth.otpRequired') || 'OTP Required',
 description: 'Please send OTP first',
 variant: 'destructive',
 });
 return;
 }

 if (!formData.otp) {
 toast({
 title: t('auth.otpRequired') || 'OTP Required',
 description: 'Please enter OTP',
 variant: 'destructive',
 });
 return;
 }

 // If it's a new user and we're showing the name field, validate name
 if (isNewUser && !formData.fullName) {
 toast({
 title: t('auth.validation.fullNameRequired') || 'Full name required',
 description: 'Please enter your full name to continue',
 variant: 'destructive',
 });
 return;
 }

 setIsLoading(true);

 try {
 if (!formData.phone || !formData.otp) {
 throw new Error('Phone and OTP are required');
 }

 // Verify OTP - check if user exists first
 const result = await signInWithPhone(formData.phone, formData.otp, {
 fullName: isNewUser ? formData.fullName : undefined,
 preferredLanguage: locale as 'ar' | 'en',
 });

 if (result.error) {
 throw result.error;
 }

 // Check if this is a new user (from API response)
 if (result.data?.isNewUser) {
 if (!formData.fullName) {
 // Show name field, don't proceed yet
 setIsNewUser(true);
 setIsLoading(false);
 return;
 }
 // Name provided, proceed with account creation (already handled in API)
 }

 // Show success message
 toast({
 title: isNewUser 
 ? (t('auth.signupSuccess') || 'Account created successfully')
 : (t('auth.loginSuccess') || 'Welcome back!'),
 description: isNewUser
 ? (t('auth.phoneVerified') || 'Your phone number has been verified successfully.')
 : (t('auth.loginSuccessDesc') || 'You have successfully logged in'),
 variant: 'default',
 });

 // Wait a moment for cookies to be set and session to be available
 await new Promise(resolve => setTimeout(resolve, 500));
 
 // Determine redirect path (defaults to home)
 const redirectParam = searchParams.get('redirect');
 const sanitizedRedirect = redirectParam
 ? `${redirectParam.startsWith('/') ? redirectParam : `/${redirectParam}`}`
 : '';
 const targetPath = sanitizedRedirect ? `/${locale}${sanitizedRedirect}` : `/${locale}`;

 // Stop loading before redirect
 setIsLoading(false);
 
 // Use window.location.href for full page reload to ensure cookies are read
 // This ensures the auth context properly initializes with the session
 window.location.href = targetPath;
 } catch (error: any) {
 console.error('Login error:', error);

 // Check if error indicates user doesn't exist (new user)
 if (error.message?.includes('User not found') || error.message?.includes('not found')) {
 setIsNewUser(true);
 setIsLoading(false);
 return;
 }

 // Translate common error messages
 let errorMessage = t('auth.somethingWrong') || 'Something went wrong. Please try again.';

 if (error.message?.includes('Invalid') || error.message?.includes('invalid')) {
 errorMessage = t('auth.invalidCredentials') || 'Invalid OTP code';
 }

 toast({
 title: t('auth.loginError') || 'Login failed',
 description: errorMessage,
 variant: 'destructive',
 });
 setIsLoading(false);
 }
 };

 return (
 <div className="h-screen flex overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
 {/* Left Side - Form */}
 <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface transition-colors duration-300 overflow-y-auto">
 <div className="w-full max-w-md space-y-8 py-8">
 {/* Header with Back Button, Logo and Theme Toggle */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {/* Back to Home Button */}
 <Link
 href={`/${locale}`}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200 group"
 aria-label={t('auth.backToHome')}
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
 href={locale === 'ar' ? '/en/auth/login' : '/ar/auth/login'}
 className="p-2 rounded-lg bg-surface-container-highest hover:bg-surface-container-high transition-all duration-200"
 aria-label="Toggle language"
 >
 <Languages className="w-5 h-5 text-primary" />
 </Link>
 </div>
 </div>

 {/* Sign In Header */}
 <div>
 <h1 className="text-4xl font-bold text-on-surface mb-2">
 {isNewUser ? (t('auth.signUp') || 'Sign Up') : (t('auth.signIn') || 'Sign In')}
 </h1>
 {isNewUser && (
 <p className="text-sm text-on-surface-variant mt-2">
 {t('auth.createAccountWithPhone') || 'Create your account with your phone number'}
 </p>
 )}
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Phone Field */}
 {!otpSent && (
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
 disabled={otpSent}
 />
 </div>
 </div>
 )}

 {/* Send OTP Button */}
 {!otpSent && (
 <button
 type="button"
 onClick={handleSendOtp}
 disabled={otpLoading || !formData.phone}
 className="w-full py-3.5 bg-gradient-to-r from-success-600 to-success-700 rounded-xl font-bold text-lg hover:shadow-success-600/30 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ color: '#ffffff' }}
 >
 <span style={{
 textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
 color: '#ffffff'
 }}>
 {otpLoading ? t('auth.sendingOtp') || 'Sending...' : t('auth.sendOtp') || 'Send OTP'}
 </span>
 </button>
 )}

 {/* Full Name Field (only shown for new users after OTP sent) */}
 {isNewUser && otpSent && (
 <div className="space-y-2">
 <label htmlFor="fullName" className="block text-label-lg text-on-surface">
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
 placeholder={t('auth.fullNamePlaceholder')}
 className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
 required
 />
 </div>
 </div>
 )}

 {/* OTP Field */}
 {otpSent && (
 <div className="space-y-2">
 <label htmlFor="otp" className="block text-label-lg text-on-surface">
 {t('auth.enterOtp') || 'Enter OTP'}
 </label>
 <div className="relative">
 <div className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-outline`}>
 <Lock className="w-5 h-5" />
 </div>
 <input
 id="otp"
 type="text"
 value={formData.otp}
 onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/[^0-9]/g, '') })}
 placeholder="123456"
 maxLength={6}
 className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono`}
 required
 />
 </div>
 <p className="text-body-sm text-on-surface-variant text-center">
 {t('auth.didntReceiveOtp') || "Didn't receive OTP?"}{' '}
 <button
 type="button"
 onClick={handleSendOtp}
 disabled={otpLoading}
 className="text-primary hover:underline font-semibold disabled:opacity-50"
 >
 {t('auth.resendOtp') || 'Resend'}
 </button>
 </p>
 </div>
 )}

 {/* Remember Me & Forgot Password */}
 <div className="flex items-center justify-between">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={formData.rememberMe}
 onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
 className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary-500 focus:ring-2"
 />
 <span className="text-sm text-on-surface-variant">
 {t('auth.rememberMe')}
 </span>
 </label>
 <Link
 href={`/${locale}/auth/forgot-password`}
 className="text-label-lg text-primary hover:text-primary transition-colors"
 >
 {t('auth.forgotPassword')}
 </Link>
 </div>

 {/* Sign In Button */}
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
 {isLoading ? (t('auth.signingIn') || 'Signing in...') : t('auth.signIn')}
 </span>
 </button>

 {/* Continue with Email Button */}
 <Link
 href={`/${locale}/auth/signup`}
 className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 text-on-surface-variant font-medium"
 >
 <Mail className="w-4 h-4" />
 {t('auth.continueWithEmail') || 'Continue with Email'}
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

 {/* Social Login Buttons */}
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => handleOAuthLogin('google')}
 disabled={isLoading}
 className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <GoogleIcon />
 </button>
 <button
 type="button"
 onClick={() => handleOAuthLogin('facebook')}
 disabled={isLoading}
 className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <FacebookIcon />
 </button>
 </div>
 </form>
 </div>
 </div>

 {/* Right Side - Branding */}
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
 <p className="text-sm mt-4" style={{ color: '#9ca3af' }}>
 {t('auth.joinMessage')}
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

 {/* Avatar Group */}
 <div className="flex items-center gap-2">
 <div className="flex -space-x-3">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border-2 border-gray-800 flex items-center justify-center text-sm font-bold" style={{ color: '#ffffff' }}>
 A
 </div>
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success-500 to-success-700 border-2 border-gray-800 flex items-center justify-center text-sm font-bold" style={{ color: '#ffffff' }}>
 M
 </div>
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-featured-500 to-featured-700 border-2 border-gray-800 flex items-center justify-center text-sm font-bold" style={{ color: '#ffffff' }}>
 S
 </div>
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning-500 to-warning-700 border-2 border-gray-800 flex items-center justify-center text-sm font-bold" style={{ color: '#ffffff' }}>
 +
 </div>
 </div>
 <span className="text-sm" style={{ color: '#9ca3af' }}>{t('auth.stats.users')}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
