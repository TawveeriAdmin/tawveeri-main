'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { navigateToLocale } from '@/lib/i18n/switch-locale';
import { formatDate } from '@/lib/formatting';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  User, Mail, Phone, Globe, Moon, Sun, Monitor, Camera, Trash2,
  AlertTriangle, Save, X, CheckCircle2, AlertCircle, Clock3,
  Lock, Heart, Bell, TrendingUp, Eye, EyeOff, Download,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { Database } from '@/lib/database/types';
import { updateAvatar, deleteAvatar, deleteAccount, resendEmailVerification, resendPhoneVerification, verifyPhoneOTP, verifyEmailOTPCode } from '@/lib/auth/profile';


interface NotificationSettings {
 email: boolean;
 sms: boolean;
 push: boolean;
 price: boolean;
 stock: boolean;
 deal: boolean;
}

interface PrivacySettings {
 publicProfile: boolean;
 shareSearchHistory: boolean;
}

const LOCAL_STORAGE_KEY_PREFIX = 'tawveeri.preferences.';

export default function ProfilePage() {
 const supabase = useMemo(
 () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
 []
 );
 const params = useParams();
 const router = useRouter();
 const locale = (params?.locale as string) || 'ar';
 const t = useTranslations();
 const { user, loading: authLoading, updateProfile, updatePassword, refreshSession } = useAuth();
 const { theme, setTheme } = useTheme();
 const { toast } = useToast();

 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [deleteLoading, setDeleteLoading] = useState(false);

 // Form state
 const [fullName, setFullName] = useState('');
 const [email, setEmail] = useState('');
 const [phone, setPhone] = useState('');
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
 const [preferredLanguage, setPreferredLanguage] = useState<'ar' | 'en'>('ar');
 const [currentTheme, setCurrentTheme] = useState<string>('system');
 const [avatarUploading, setAvatarUploading] = useState(false);
 const [emailResendLoading, setEmailResendLoading] = useState(false);
 const [phoneResendLoading, setPhoneResendLoading] = useState(false);
 const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
 const [phoneOtp, setPhoneOtp] = useState('');
 const [phoneOtpSent, setPhoneOtpSent] = useState(false);
 const [emailOtp, setEmailOtp] = useState('');
 const [emailOtpSent, setEmailOtpSent] = useState(false);
 const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
 const [emailVerified, setEmailVerified] = useState(false);
 const [phoneVerified, setPhoneVerified] = useState(false);
 const fileInputRef = useRef<HTMLInputElement | null>(null);

 // Activity stats
 const [wishlistCount, setWishlistCount] = useState(0);
 const [alertsCount, setAlertsCount] = useState(0);
 const [unreadNotifCount, setUnreadNotifCount] = useState(0);

 // Password change state
 const [showPasswordChange, setShowPasswordChange] = useState(false);
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);

 // Notification & privacy settings
 const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
   email: true, sms: false, push: true, price: true, stock: true, deal: true,
 });
 const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
   publicProfile: true, shareSearchHistory: false,
 });
 const [settingsSaving, setSettingsSaving] = useState(false);
 const [exporting, setExporting] = useState(false);

 const localStorageKey = useMemo(() => {
   if (!user?.id) return null;
   return `${LOCAL_STORAGE_KEY_PREFIX}${user.id}`;
 }, [user?.id]);

 // Original values for change detection
 const originalFullName = user?.full_name || user?.user_metadata?.full_name || '';
 const hasChanges = fullName !== originalFullName;

 // Load user data
 useEffect(() => {
 if (authLoading) return;

 if (!user) {
 router.push(`/${locale}/auth/login`);
 return;
 }

 setFullName(user.full_name || user.user_metadata?.full_name || '');
 setEmail(user.email || '');
 setPhone(user.phone || user.user_metadata?.phone || '');
 setAvatarUrl(user.avatar_url || null);
 setPreferredLanguage((user.preferred_language as 'ar' | 'en') || locale);
 setCurrentTheme(theme || 'system');
 setEmailVerified(user.email_verified ?? !!user.email_confirmed_at);
 setPhoneVerified(user.phone_verified ?? !!user.phone_confirmed_at);
 setPhoneOtp('');
 setPhoneOtpSent(false);
 setLoading(false);
 }, [user, authLoading, router, locale, theme]);

 // Fetch activity stats
 useEffect(() => {
   if (!supabase || authLoading || !user?.id) return;

   Promise.all([
     supabase.from('user_wishlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
     supabase.from('price_alerts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
     supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
   ]).then(([wishlistRes, alertsRes, notifRes]) => {
     setWishlistCount(wishlistRes.count || 0);
     setAlertsCount(alertsRes.count || 0);
     setUnreadNotifCount(notifRes.count || 0);
   });
 }, [supabase, authLoading, user?.id]);

 // Fetch notification & privacy preferences
 useEffect(() => {
   if (!supabase || authLoading || !user?.id) return;
   const userId = user.id;

   async function fetchPreferences() {
     try {
       const { data, error } = await supabase!
         .from('user_preferences')
         .select('notification_preferences, privacy_preferences')
         .eq('user_id', userId)
         .single<Database['public']['Tables']['user_preferences']['Row']>();

       if (error) {
         // Fall back to localStorage
         if (localStorageKey) {
           try {
             const raw = localStorage.getItem(localStorageKey);
             if (raw) {
               const parsed = JSON.parse(raw);
               if (parsed.notification_preferences) setNotificationSettings(parsed.notification_preferences);
               if (parsed.privacy_preferences) setPrivacySettings(parsed.privacy_preferences);
             }
           } catch {}
         }
       } else if (data) {
         if (data.notification_preferences) {
           setNotificationSettings({
             email: !!data.notification_preferences.email,
             sms: !!data.notification_preferences.sms,
             push: !!data.notification_preferences.push,
             price: !!data.notification_preferences.price,
             stock: !!data.notification_preferences.stock,
             deal: !!data.notification_preferences.deal,
           });
         }
         if (data.privacy_preferences) {
           setPrivacySettings({
             publicProfile: !!data.privacy_preferences.publicProfile,
             shareSearchHistory: !!data.privacy_preferences.shareSearchHistory,
           });
         }
       }
     } catch {}
   }

   fetchPreferences();
 }, [supabase, authLoading, user?.id, localStorageKey]);

 // Loading skeleton
 if (authLoading || loading) {
 return (
   <div className="space-y-6">
     <Skeleton className="h-8 w-48" />
     {/* Hero skeleton */}
     <Skeleton className="h-48 w-full rounded-2xl" />
     {/* Stats skeleton */}
     <div className="grid grid-cols-3 gap-3">
       {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
     </div>
     {/* Bento grid skeleton */}
     <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
       <Skeleton className="lg:col-span-3 h-80 rounded-2xl" />
       <div className="lg:col-span-2 space-y-4">
         <Skeleton className="h-36 rounded-2xl" />
         <Skeleton className="h-36 rounded-2xl" />
         <Skeleton className="h-28 rounded-2xl" />
       </div>
     </div>
   </div>
 );
 }

 if (!user) {
 return null;
 }

 const memberSince = user.created_at
   ? formatDate(user.created_at, locale)
   : '';
 const avatarFallback = fullName
   ? fullName
     .split(' ')
     .map((namePart) => namePart[0])
     .join('')
     .toUpperCase()
     .slice(0, 2)
   : email?.[0]?.toUpperCase() || 'U';
 const displayName = fullName || email?.split('@')[0] || t('profile.title');
 const verificationBadges = [
   { label: t('profile.email'), verified: emailVerified },
   { label: t('profile.phone'), verified: phoneVerified },
 ];
 const activityCards = [
   {
     href: `/${locale}/wishlist`,
     label: t('profile.wishlistItems'),
     value: wishlistCount,
     icon: Heart,
     className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
   },
   {
     href: `/${locale}/price-alerts`,
     label: t('profile.activePriceAlerts'),
     value: alertsCount,
     icon: TrendingUp,
     className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
   },
   {
     href: `/${locale}/notifications`,
     label: t('profile.notificationsCount'),
     value: unreadNotifCount,
     icon: Bell,
     className: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
   },
 ];
 const notificationRows = [
   ['email', t('profile.emailNotif')],
   ['sms', t('profile.smsNotif')],
   ['push', t('profile.pushNotif')],
   ['price', t('profile.priceAlertsNotif')],
   ['stock', t('profile.stockAlerts')],
   ['deal', t('profile.dealAlerts')],
 ] as [keyof NotificationSettings, string][];

 const handleSaveProfile = async () => {
 setSaving(true);
 try {
 const { error } = await updateProfile({
 full_name: fullName,
 preferred_language: preferredLanguage,
 });

 if (error) {
 toast({
 title: t('profile.updateError'),
 description: error.message,
 variant: 'destructive',
 });
 } else {
 toast({
 title: t('profile.updateSuccess'),
 variant: 'default',
 });

 // Document load, not `router.push` — see `navigateToLocale`.
 navigateToLocale(locale, preferredLanguage, window.location.pathname);
 }
 } catch (error) {
 toast({
 title: t('profile.updateError'),
 description: error instanceof Error ? error.message : 'Unknown error',
 variant: 'destructive',
 });
 } finally {
 setSaving(false);
 }
 };

 const handleChangePassword = async () => {
 if (newPassword !== confirmPassword) {
 toast({
 title: t('profile.passwordError'),
 description: t('profile.passwordsDoNotMatch'),
 variant: 'destructive',
 });
 return;
 }

 if (newPassword.length < 6) {
 toast({
 title: t('profile.passwordError'),
 description: t('profile.passwordMinLength'),
 variant: 'destructive',
 });
 return;
 }

 setSaving(true);
 try {
 const { error } = await updatePassword(newPassword);

 if (error) {
 toast({
 title: t('profile.passwordError'),
 description: error.message,
 variant: 'destructive',
 });
 } else {
 toast({
 title: t('profile.passwordUpdated'),
 variant: 'default',
 });
 setShowPasswordChange(false);
 setNewPassword('');
 setConfirmPassword('');

 // Send email notification + in-app notification + audit log
 fetch('/api/auth/password-changed-notify', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
     userId: user.id,
     email: user.email,
     language: locale,
   }),
 }).catch(() => {});
 }
 } catch (error) {
 toast({
 title: t('profile.passwordError'),
 description: error instanceof Error ? error.message : 'Unknown error',
 variant: 'destructive',
 });
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteAccount = async () => {
 if (!supabase) return;
 setDeleteLoading(true);
 try {
 // Delete account via server-side API (handles email, audit, DB, auth deletion)
 const { error: deleteError } = await deleteAccount(user?.id || '');
 if (deleteError) throw deleteError;

 // Sign out locally (session is already invalid after auth user deletion)
 await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

 toast({
 title: t('profile.accountDeleted'),
 variant: 'default',
 });

 router.push(`/${locale}`);
 } catch (error) {
 toast({
 title: t('profile.deleteError'),
 description: error instanceof Error ? error.message : 'Unknown error',
 variant: 'destructive',
 });
 } finally {
 setDeleteLoading(false);
 setDeleteDialogOpen(false);
 }
 };

 const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !user) return;

 setAvatarUploading(true);
 try {
 const { data, error } = await updateAvatar(user.id, file);
 if (error) throw error;

 setAvatarUrl(data);
 toast({
 title: t('profile.avatarUpdated'),
 variant: 'default',
 });

 await refreshSession();
 } catch (error) {
 toast({
 title: t('profile.updateFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setAvatarUploading(false);
 }
 };

 const handleRemoveAvatar = async () => {
 if (!user || !avatarUrl) return;

 setAvatarUploading(true);
 try {
 const { error } = await deleteAvatar(user.id);
 if (error) throw error;

 setAvatarUrl(null);
 toast({
 title: t('profile.avatarRemoved'),
 variant: 'default',
 });

 await refreshSession();
 } catch (error) {
 toast({
 title: t('profile.removalFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setAvatarUploading(false);
 }
 };

 const handleResendEmail = async () => {
 if (!user?.email) return;

 setEmailResendLoading(true);
 try {
 const { error } = await resendEmailVerification(user.email);
 if (error) throw error;

 setEmailOtpSent(true);
 toast({
 title: t('profile.verificationSent'),
 description: t('profile.emailCodeSent'),
 variant: 'default',
 });
 } catch (error) {
 toast({
 title: t('profile.sendFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setEmailResendLoading(false);
 }
 };

 const handleVerifyEmail = async () => {
 if (!user?.email) return;

 if (!emailOtp.trim()) {
 toast({
 title: t('profile.enterOtp'),
 variant: 'destructive',
 });
 return;
 }

 setEmailVerifyLoading(true);
 try {
 const { error } = await verifyEmailOTPCode(user.email, emailOtp.trim());
 if (error) throw error;

 setEmailVerified(true);
 setEmailOtp('');
 setEmailOtpSent(false);
 toast({
 title: t('profile.emailVerified'),
 variant: 'default',
 });

 await refreshSession();
 } catch (error) {
 toast({
 title: t('profile.verificationFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setEmailVerifyLoading(false);
 }
 };

 const handleResendPhone = async () => {
 if (!user?.phone) {
 toast({
 title: t('profile.phoneNumberMissing'),
 variant: 'destructive',
 });
 return;
 }

 setPhoneResendLoading(true);
 try {
 const { error } = await resendPhoneVerification(user.phone);
 if (error) throw error;

 setPhoneOtpSent(true);
 toast({
 title: t('profile.otpSent'),
 description: t('profile.otpSentDescription'),
 variant: 'default',
 });
 } catch (error) {
 toast({
 title: t('profile.sendFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setPhoneResendLoading(false);
 }
 };

 const handleVerifyPhone = async () => {
 if (!user?.phone) {
 toast({
 title: t('profile.phoneNumberMissing'),
 variant: 'destructive',
 });
 return;
 }

 if (!phoneOtp.trim()) {
 toast({
 title: t('profile.enterOtp'),
 variant: 'destructive',
 });
 return;
 }

 setPhoneVerifyLoading(true);
 try {
 const { error } = await verifyPhoneOTP(user.phone, phoneOtp.trim());
 if (error) throw error;

 setPhoneVerified(true);
 setPhoneOtp('');
 setPhoneOtpSent(false);
 toast({
 title: t('profile.phoneVerified'),
 variant: 'default',
 });

 await refreshSession();
 } catch (error) {
 toast({
 title: t('profile.verificationFailed'),
 description: error instanceof Error ? error.message : undefined,
 variant: 'destructive',
 });
 } finally {
 setPhoneVerifyLoading(false);
 }
 };

 const handleSaveSettings = async (
   updatedNotif?: NotificationSettings,
   updatedPrivacy?: PrivacySettings,
 ) => {
   if (!user || !supabase) return;
   setSettingsSaving(true);
   const notif = updatedNotif || notificationSettings;
   const priv = updatedPrivacy || privacySettings;

   try {
     const upsertPayload: Database['public']['Tables']['user_preferences']['Insert'] = {
       user_id: user.id,
       notification_preferences: { ...notif },
       privacy_preferences: { ...priv },
       updated_at: new Date().toISOString(),
     };

     const { error } = await supabase
       .from('user_preferences')
       .upsert(upsertPayload, { onConflict: 'user_id' });

     if (error) throw error;

     // Persist to localStorage as fallback
     if (localStorageKey) {
       try {
         const existing = localStorage.getItem(localStorageKey);
         const parsed = existing ? JSON.parse(existing) : {};
         localStorage.setItem(localStorageKey, JSON.stringify({
           ...parsed,
           notification_preferences: notif,
           privacy_preferences: priv,
         }));
       } catch {}
     }

     toast({ title: t('profile.settingsSaved'), variant: 'default' });
   } catch (error) {
     // Still persist to localStorage on error
     if (localStorageKey) {
       try {
         const existing = localStorage.getItem(localStorageKey);
         const parsed = existing ? JSON.parse(existing) : {};
         localStorage.setItem(localStorageKey, JSON.stringify({
           ...parsed,
           notification_preferences: notif,
           privacy_preferences: priv,
         }));
       } catch {}
     }
     toast({
       title: t('profile.updateError'),
       description: error instanceof Error ? error.message : undefined,
       variant: 'destructive',
     });
   } finally {
     setSettingsSaving(false);
   }
 };

 const handleExportData = async () => {
   if (!user || !supabase) return;
   setExporting(true);
   try {
     const [{ data: profile }, { data: wishlists }, { data: alerts }, { data: searches }] =
       await Promise.all([
         supabase.from('users').select('*').eq('id', user.id).single(),
         supabase.from('user_wishlists').select('*').eq('user_id', user.id),
         supabase.from('price_alerts').select('*').eq('user_id', user.id),
         supabase.from('search_history').select('*').eq('user_id', user.id),
       ]);

     const exportPayload = {
       exported_at: new Date().toISOString(),
       user: profile,
       wishlist: wishlists,
       price_alerts: alerts,
       search_history: searches,
     };

     const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const anchor = document.createElement('a');
     anchor.href = url;
     anchor.download = `tawveeri-export-${new Date().toISOString()}.json`;
     document.body.appendChild(anchor);
     anchor.click();
     document.body.removeChild(anchor);
     URL.revokeObjectURL(url);

     toast({ title: t('profile.dataExported'), variant: 'default' });
   } catch (error) {
     toast({
       title: t('profile.dataExportFailed'),
       description: error instanceof Error ? error.message : undefined,
       variant: 'destructive',
     });
   } finally {
     setExporting(false);
   }
 };

 return (
   <div className="mx-auto w-full max-w-[1600px] space-y-6">
     <section className="overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
       <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(244,249,247,1))] p-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,178,139,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(3,7,18,1))] md:p-7 lg:grid-cols-[minmax(0,1fr)_420px]">
         <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
           <div className="group relative shrink-0">
             <Avatar className="h-28 w-28 border-4 border-white shadow-xl dark:border-gray-900">
               <AvatarImage src={avatarUrl || undefined} alt={displayName} />
               <AvatarFallback className="bg-primary text-3xl font-semibold text-white">
                 {avatarFallback}
               </AvatarFallback>
             </Avatar>
             <button
               type="button"
               onClick={() => fileInputRef.current?.click()}
               disabled={avatarUploading}
               className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100"
             >
               <Camera className="h-5 w-5 text-white" />
             </button>
             <input
               ref={fileInputRef}
               id="avatar-upload"
               type="file"
               accept="image/*"
               className="hidden"
               onChange={handleAvatarUpload}
             />
           </div>

           <div className="min-w-0 flex-1">
             <div className="mb-3 flex flex-wrap items-center gap-2">
               {verificationBadges.map((badge) => (
                 <span
                   key={badge.label}
                   className={cn(
                     'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                     badge.verified
                       ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                       : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                   )}
                 >
                   {badge.verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                   {badge.verified ? `${badge.label} ${t('profile.verified')}` : `${badge.label} ${t('profile.unverified')}`}
                 </span>
               ))}
             </div>
             <h1 className="truncate text-3xl font-bold tracking-normal text-gray-950 dark:text-white md:text-4xl">
               {displayName}
             </h1>
             <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
               {email && (
                 <span className="inline-flex min-w-0 items-center gap-2">
                   <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                   <span className="truncate" dir="ltr">{email}</span>
                 </span>
               )}
               {phone && (
                 <span className="inline-flex items-center gap-2">
                   <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                   <span dir="ltr">{phone}</span>
                 </span>
               )}
               {memberSince && (
                 <span className="inline-flex items-center gap-2">
                   <Clock3 className="h-4 w-4 shrink-0 text-gray-400" />
                   {t('profile.memberSince', { date: memberSince })}
                 </span>
               )}
             </div>
             <div className="mt-5 flex flex-wrap gap-2">
               <Button
                 type="button"
                 size="sm"
                 onClick={() => fileInputRef.current?.click()}
                 disabled={avatarUploading}
               >
                 <Camera className="me-1.5 h-4 w-4" />
                 {avatarUploading ? t('profile.uploading') : t('profile.changeAvatar')}
               </Button>
               {avatarUrl && (
                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                   onClick={handleRemoveAvatar}
                   disabled={avatarUploading}
                 >
                   <Trash2 className="me-1.5 h-4 w-4" />
                   {avatarUploading ? t('profile.removing') : t('profile.removeAvatar')}
                 </Button>
               )}
             </div>
           </div>
         </div>

         <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
           {activityCards.map(({ href, label, value, icon: Icon, className }) => (
             <Link
               key={label}
               href={href}
               className="group flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-900/80 dark:hover:bg-gray-900"
             >
               <div className="min-w-0">
                 <p className="text-2xl font-bold tabular-nums text-gray-950 dark:text-white">{value}</p>
                 <p className="mt-1 truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
               </div>
               <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', className)}>
                 <Icon className="h-5 w-5" />
               </span>
             </Link>
           ))}
         </div>
       </div>
     </section>

     <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
       <div className="space-y-5">
         <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 md:p-6">
           <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
             <div className="flex items-center gap-3">
               <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                 <User className="h-5 w-5" />
               </span>
               <div>
                 <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('profile.personalInformation')}</h2>
                 <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.updatePersonalInfo')}</p>
               </div>
             </div>
             <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={() => router.back()}>
                 <X className="me-1.5 h-4 w-4" />
                 {t('profile.cancel')}
               </Button>
               <Button size="sm" onClick={handleSaveProfile} disabled={saving || !hasChanges}>
                 <Save className="me-1.5 h-4 w-4" />
                 {saving ? t('profile.saving') : t('profile.saveChanges')}
               </Button>
             </div>
           </div>

           <div className="grid gap-4 md:grid-cols-2">
             <div className="space-y-2 md:col-span-2">
               <Label htmlFor="fullName" className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.fullName')}</Label>
               <Input
                 id="fullName"
                 value={fullName}
                 onChange={(e) => setFullName(e.target.value)}
                 placeholder={t('profile.enterFullName')}
                 className="h-12 rounded-2xl"
               />
             </div>

             <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60">
               <Label htmlFor="email" className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.email')}</Label>
               <div className="flex flex-col gap-2 sm:flex-row">
                 <Input
                   id="email"
                   type="email"
                   value={email}
                   disabled
                   className="h-11 flex-1 rounded-xl bg-white dark:bg-gray-950"
                   dir="ltr"
                 />
                 {emailVerified ? (
                   <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                     <CheckCircle2 className="h-3.5 w-3.5" />
                     {t('profile.verified')}
                   </span>
                 ) : (
                   <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={emailResendLoading} className="h-11 rounded-xl">
                     <AlertCircle className="me-1.5 h-3.5 w-3.5 text-amber-500" />
                     {emailResendLoading ? t('profile.sending') : emailOtpSent ? t('profile.resendCode') : t('profile.resendVerification')}
                   </Button>
                 )}
               </div>
               {!emailVerified && emailOtpSent && (
                 <div className="flex gap-2">
                   <Input
                     type="text"
                     value={emailOtp}
                     onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                     placeholder={t('profile.enterVerificationCode')}
                     className="h-11 flex-1 rounded-xl"
                     dir="ltr"
                     maxLength={6}
                   />
                   <Button size="sm" onClick={handleVerifyEmail} disabled={emailVerifyLoading || emailOtp.trim().length === 0} className="h-11 rounded-xl">
                     {emailVerifyLoading ? t('profile.verifying') : t('common.verify')}
                   </Button>
                 </div>
               )}
             </div>

             <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60">
               <Label htmlFor="phone" className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.phone')}</Label>
               <div className="flex flex-col gap-2 sm:flex-row">
                 <Input
                   id="phone"
                   type="tel"
                   value={phone}
                   disabled
                   className="h-11 flex-1 rounded-xl bg-white dark:bg-gray-950"
                   dir="ltr"
                 />
                 {phoneVerified ? (
                   <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                     <CheckCircle2 className="h-3.5 w-3.5" />
                     {t('profile.verified')}
                   </span>
                 ) : (
                   <Button variant="outline" size="sm" onClick={handleResendPhone} disabled={phoneResendLoading || !user?.phone} className="h-11 rounded-xl">
                     <AlertCircle className="me-1.5 h-3.5 w-3.5 text-amber-500" />
                     {phoneResendLoading ? t('profile.sending') : phoneOtpSent ? t('profile.resendCode') : t('profile.sendCode')}
                   </Button>
                 )}
               </div>
               {!phoneVerified && phoneOtpSent && (
                 <div className="flex gap-2">
                   <Input
                     type="text"
                     value={phoneOtp}
                     onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                     placeholder={t('profile.enterVerificationCode')}
                     className="h-11 flex-1 rounded-xl"
                     dir="ltr"
                     maxLength={6}
                   />
                   <Button size="sm" onClick={handleVerifyPhone} disabled={phoneVerifyLoading || phoneOtp.trim().length === 0} className="h-11 rounded-xl">
                     {phoneVerifyLoading ? t('profile.verifying') : t('common.verify')}
                   </Button>
                 </div>
               )}
             </div>
           </div>
         </section>

         <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 md:p-6">
           <div className="mb-5 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
               <Bell className="h-5 w-5" />
             </span>
             <div>
               <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('profile.notificationPreferences')}</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.notificationPreferencesDesc')}</p>
             </div>
           </div>

           <div className="grid gap-3 sm:grid-cols-2">
             {notificationRows.map(([key, label]) => (
               <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                 <Label className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</Label>
                 <Switch
                   checked={notificationSettings[key]}
                   onCheckedChange={(value) => {
                     const updated = { ...notificationSettings, [key]: value };
                     setNotificationSettings(updated);
                     handleSaveSettings(updated, undefined);
                   }}
                   disabled={settingsSaving}
                 />
               </div>
             ))}
           </div>
         </section>
       </div>

       <aside className="space-y-5">
         <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
           <div className="mb-5 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
               <Globe className="h-5 w-5" />
             </span>
             <div>
               <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('profile.preferencesTitle')}</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.customizeExperience')}</p>
             </div>
           </div>

           <div className="space-y-5">
             <div className="space-y-2">
               <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.language')}</Label>
               <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-900">
                 <button
                   type="button"
                   onClick={() => {
                     setPreferredLanguage('ar');
                     navigateToLocale(locale, 'ar', window.location.pathname);
                   }}
                   className={cn(
                     'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                     preferredLanguage === 'ar'
                       ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white'
                       : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                   )}
                 >
                   العربية
                 </button>
                 <button
                   type="button"
                   onClick={() => {
                     setPreferredLanguage('en');
                     navigateToLocale(locale, 'en', window.location.pathname);
                   }}
                   className={cn(
                     'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                     preferredLanguage === 'en'
                       ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white'
                       : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                   )}
                 >
                   English
                 </button>
               </div>
             </div>

             <div className="space-y-2">
               <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.theme')}</Label>
               <div className="grid grid-cols-3 rounded-2xl bg-gray-100 p-1 dark:bg-gray-900">
                 {[
                   { value: 'light', icon: Sun, label: t('profile.light') },
                   { value: 'dark', icon: Moon, label: t('profile.dark') },
                   { value: 'system', icon: Monitor, label: t('profile.system') },
                 ].map(({ value, icon: Icon, label }) => (
                   <button
                     key={value}
                     type="button"
                     onClick={() => { setCurrentTheme(value); setTheme(value); }}
                     className={cn(
                       'inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition',
                       currentTheme === value
                         ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white'
                         : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                     )}
                   >
                     <Icon className="h-3.5 w-3.5" />
                     {label}
                   </button>
                 ))}
               </div>
             </div>
           </div>
         </section>

         <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
           <div className="mb-5 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
               <Lock className="h-5 w-5" />
             </span>
             <div>
               <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('profile.securityTitle')}</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.changePasswordDescription')}</p>
             </div>
           </div>

           {!showPasswordChange ? (
             <Button variant="outline" size="sm" onClick={() => setShowPasswordChange(true)} className="h-11 w-full rounded-2xl">
               <Lock className="me-1.5 h-4 w-4" />
               {t('profile.changePassword')}
             </Button>
           ) : (
             <div className="space-y-3">
               <div className="space-y-1.5">
                 <Label htmlFor="newPassword" className="text-sm font-semibold">{t('profile.newPassword')}</Label>
                 <div className="relative">
                   <Input
                     id="newPassword"
                     type={showNewPassword ? 'text' : 'password'}
                     value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     placeholder={t('profile.newPasswordPlaceholder')}
                     className="h-11 rounded-xl pe-10"
                   />
                   <button
                     type="button"
                     onClick={() => setShowNewPassword(!showNewPassword)}
                     className="absolute top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
                     style={{ insetInlineEnd: '0.75rem' }}
                   >
                     {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </button>
                 </div>
               </div>
               <div className="space-y-1.5">
                 <Label htmlFor="confirmPassword" className="text-sm font-semibold">{t('profile.confirmPassword')}</Label>
                 <div className="relative">
                   <Input
                     id="confirmPassword"
                     type={showConfirmPassword ? 'text' : 'password'}
                     value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                     placeholder={t('profile.confirmPasswordPlaceholder')}
                     className="h-11 rounded-xl pe-10"
                   />
                   <button
                     type="button"
                     onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                     className="absolute top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
                     style={{ insetInlineEnd: '0.75rem' }}
                   >
                     {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </button>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <Button variant="outline" size="sm" onClick={() => setShowPasswordChange(false)} className="h-10 rounded-xl">
                   {t('profile.cancel')}
                 </Button>
                 <Button size="sm" onClick={handleChangePassword} disabled={saving} className="h-10 rounded-xl">
                   {saving ? t('profile.saving') : t('profile.saveChanges')}
                 </Button>
               </div>
             </div>
           )}
         </section>

         <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
           <div className="mb-5 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
               <Eye className="h-5 w-5" />
             </span>
             <div>
               <h2 className="text-lg font-bold text-gray-950 dark:text-white">{t('profile.privacyAndData')}</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.privacyAndDataDesc')}</p>
             </div>
           </div>

           <div className="space-y-3">
             <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/70">
               <Label className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('profile.publicProfile')}</Label>
               <Switch
                 checked={privacySettings.publicProfile}
                 onCheckedChange={(value) => {
                   const updated = { ...privacySettings, publicProfile: value };
                   setPrivacySettings(updated);
                   handleSaveSettings(undefined, updated);
                 }}
                 disabled={settingsSaving}
               />
             </div>
             <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/70">
               <Label className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('profile.shareSearchHistory')}</Label>
               <Switch
                 checked={privacySettings.shareSearchHistory}
                 onCheckedChange={(value) => {
                   const updated = { ...privacySettings, shareSearchHistory: value };
                   setPrivacySettings(updated);
                   handleSaveSettings(undefined, updated);
                 }}
                 disabled={settingsSaving}
               />
             </div>
             <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
               <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('profile.exportData')}</p>
               <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('profile.exportDataDesc')}</p>
               <Button variant="outline" size="sm" onClick={handleExportData} disabled={exporting} className="mt-3 h-10 w-full rounded-xl">
                 <Download className="me-1.5 h-4 w-4" />
                 {exporting ? t('profile.exporting') : t('profile.exportData')}
               </Button>
             </div>
           </div>
         </section>

         <section className="rounded-[1.75rem] border border-red-200 bg-red-50/70 p-5 shadow-sm dark:border-red-900/60 dark:bg-red-950/20">
           <div className="mb-4 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300">
               <AlertTriangle className="h-5 w-5" />
             </span>
             <div>
               <h2 className="text-lg font-bold text-red-700 dark:text-red-300">{t('profile.dangerZone')}</h2>
               <p className="text-sm text-red-600/75 dark:text-red-300/70">{t('profile.dangerZoneDescription')}</p>
             </div>
           </div>

           <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
             <DialogTrigger asChild>
               <Button variant="destructive" size="sm" className="h-11 w-full rounded-2xl">
                 <Trash2 className="me-1.5 h-4 w-4" />
                 {t('profile.deleteAccount')}
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>{t('profile.deleteAccount')}</DialogTitle>
                 <DialogDescription>{t('profile.deleteAccountWarning')}</DialogDescription>
               </DialogHeader>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                   {t('profile.cancel')}
                 </Button>
                 <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading}>
                   {deleteLoading ? t('profile.deleting') : t('profile.deleteAccountConfirm')}
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
         </section>
       </aside>
     </div>
   </div>
 );
}
