'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
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
 const [currentPassword, setCurrentPassword] = useState('');
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

   async function fetchPreferences() {
     try {
       const { data, error } = await supabase!
         .from('user_preferences')
         .select('notification_preferences, privacy_preferences')
         .eq('user_id', user!.id)
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
   ? new Date(user.created_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long' })
   : '';

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

 if (preferredLanguage !== locale) {
 const newPath = window.location.pathname.replace(`/${locale}`, `/${preferredLanguage}`);
 router.push(newPath);
 }
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
 setCurrentPassword('');
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
 <div className="space-y-6">
   {/* ── Profile Hero Card ── */}
   <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
     {/* Gradient banner */}
     <div className="h-28 bg-gradient-to-r from-primary-500/10 via-primary-400/5 to-primary-600/10" />

     {/* Profile info */}
     <div className="px-5 pb-5 -mt-12">
       <div className="flex flex-col sm:flex-row sm:items-end gap-4">
         {/* Avatar with hover overlay */}
         <div className="relative group shrink-0">
           <Avatar className="w-24 h-24 border-4 border-white dark:border-gray-900 shadow-lg">
             <AvatarImage src={avatarUrl || undefined} alt={fullName || 'User'} />
             <AvatarFallback className="bg-primary text-white text-2xl">
               {fullName
                 ? fullName
                   .split(' ')
                   .map((n) => n[0])
                   .join('')
                   .toUpperCase()
                   .slice(0, 2)
                 : email?.[0]?.toUpperCase() || 'U'}
             </AvatarFallback>
           </Avatar>
           <button
             type="button"
             onClick={() => fileInputRef.current?.click()}
             disabled={avatarUploading}
             className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
           >
             <Camera className="w-5 h-5 text-white" />
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

         {/* Name, badges, member since */}
         <div className="flex-1 min-w-0 sm:pb-1">
           <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
             {fullName || email?.split('@')[0] || t('profile.title')}
           </h1>
           <div className="flex flex-wrap items-center gap-2 mt-1.5">
             {email && (
               <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                 <Mail className="w-3.5 h-3.5" />
                 <span className="truncate max-w-[180px]">{email}</span>
                 {emailVerified ? (
                   <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                 ) : (
                   <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                 )}
               </span>
             )}
             {phone && (
               <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                 <Phone className="w-3.5 h-3.5" />
                 <span dir="ltr">{phone}</span>
                 {phoneVerified ? (
                   <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                 ) : (
                   <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                 )}
               </span>
             )}
             {memberSince && (
               <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                 <Clock3 className="w-3.5 h-3.5" />
                 {t('profile.memberSince', { date: memberSince })}
               </span>
             )}
           </div>
         </div>

         {/* Avatar action buttons */}
         <div className="flex gap-2 shrink-0">
           <Button
             type="button"
             variant="outline"
             size="sm"
             onClick={() => fileInputRef.current?.click()}
             disabled={avatarUploading}
             className="text-xs"
           >
             <Camera className="w-3.5 h-3.5 me-1.5" />
             {avatarUploading ? t('profile.uploading') : t('profile.changeAvatar')}
           </Button>
           {avatarUrl && (
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={handleRemoveAvatar}
               disabled={avatarUploading}
               className="text-xs"
             >
               <Trash2 className="w-3.5 h-3.5 me-1.5" />
               {avatarUploading ? t('profile.removing') : t('profile.removeAvatar')}
             </Button>
           )}
         </div>
       </div>
     </div>
   </div>

   {/* ── Quick Activity Stats ── */}
   <div className="grid grid-cols-3 gap-3">
     <Link
       href={`/${locale}/wishlist`}
       className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
     >
       <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
         <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
       </div>
       <div className="min-w-0">
         <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{wishlistCount}</p>
         <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('profile.wishlistItems')}</p>
       </div>
     </Link>
     <Link
       href={`/${locale}/price-alerts`}
       className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
     >
       <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
         <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
       </div>
       <div className="min-w-0">
         <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{alertsCount}</p>
         <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('profile.activePriceAlerts')}</p>
       </div>
     </Link>
     <Link
       href={`/${locale}/notifications`}
       className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
     >
       <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 relative">
         <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
         {unreadNotifCount > 0 && (
           <span className="absolute -top-1 -end-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
             {unreadNotifCount}
           </span>
         )}
       </div>
       <div className="min-w-0">
         <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{unreadNotifCount}</p>
         <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('profile.notificationsCount')}</p>
       </div>
     </Link>
   </div>

   {/* ── Bento Grid ── */}
   <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
     {/* Left column (col-span-3) */}
     <div className="lg:col-span-3 space-y-4">
       {/* Personal Information */}
       <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
         {/* Section header */}
         <div className="flex items-center gap-3 mb-5">
           <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
             <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.personalInformation')}</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.updatePersonalInfo')}</p>
           </div>
         </div>

         <div className="space-y-4">
           {/* Full Name */}
           <div className="space-y-1.5">
             <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.fullName')}</Label>
             <Input
               id="fullName"
               value={fullName}
               onChange={(e) => setFullName(e.target.value)}
               placeholder={t('profile.enterFullName')}
             />
           </div>

           {/* Email */}
           <div className="space-y-1.5">
             <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.email')}</Label>
             <div className="flex items-center gap-2">
               <Input
                 id="email"
                 type="email"
                 value={email}
                 disabled
                 className="bg-gray-50 dark:bg-gray-800/50 flex-1"
               />
               {emailVerified ? (
                 <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg shrink-0">
                   <CheckCircle2 className="w-3.5 h-3.5" />
                   {t('profile.verified')}
                 </span>
               ) : (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={handleResendEmail}
                   disabled={emailResendLoading}
                   className="text-xs shrink-0"
                 >
                   <AlertCircle className="w-3.5 h-3.5 me-1 text-amber-500" />
                   {emailResendLoading ? t('profile.sending') : emailOtpSent ? t('profile.resendCode') : t('profile.resendVerification')}
                 </Button>
               )}
             </div>
             {/* Email OTP input when sent */}
             {!emailVerified && emailOtpSent && (
               <div className="flex items-center gap-2 mt-2">
                 <Input
                   type="text"
                   value={emailOtp}
                   onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   placeholder={t('profile.enterVerificationCode')}
                   className="flex-1"
                   dir="ltr"
                   maxLength={6}
                 />
                 <Button
                   size="sm"
                   onClick={handleVerifyEmail}
                   disabled={emailVerifyLoading || emailOtp.trim().length === 0}
                 >
                   {emailVerifyLoading ? t('profile.verifying') : t('common.verify')}
                 </Button>
               </div>
             )}
           </div>

           {/* Phone */}
           <div className="space-y-1.5">
             <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.phone')}</Label>
             <div className="flex items-center gap-2">
               <Input
                 id="phone"
                 type="tel"
                 value={phone}
                 disabled
                 className="bg-gray-50 dark:bg-gray-800/50 flex-1"
                 dir="ltr"
               />
               {phoneVerified ? (
                 <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg shrink-0">
                   <CheckCircle2 className="w-3.5 h-3.5" />
                   {t('profile.verified')}
                 </span>
               ) : (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={handleResendPhone}
                   disabled={phoneResendLoading || !user?.phone}
                   className="text-xs shrink-0"
                 >
                   <AlertCircle className="w-3.5 h-3.5 me-1 text-amber-500" />
                   {phoneResendLoading ? t('profile.sending') : phoneOtpSent ? t('profile.resendCode') : t('profile.sendCode')}
                 </Button>
               )}
             </div>
             {/* OTP input when sent */}
             {!phoneVerified && phoneOtpSent && (
               <div className="flex items-center gap-2 mt-2">
                 <Input
                   type="text"
                   value={phoneOtp}
                   onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   placeholder={t('profile.enterVerificationCode')}
                   className="flex-1"
                   dir="ltr"
                   maxLength={6}
                 />
                 <Button
                   size="sm"
                   onClick={handleVerifyPhone}
                   disabled={phoneVerifyLoading || phoneOtp.trim().length === 0}
                 >
                   {phoneVerifyLoading ? t('profile.verifying') : t('common.verify')}
                 </Button>
               </div>
             )}
           </div>
         </div>

         {/* Save/Cancel footer */}
         <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
           <Button variant="outline" size="sm" onClick={() => router.back()}>
             <X className="w-3.5 h-3.5 me-1.5" />
             {t('profile.cancel')}
           </Button>
           <Button size="sm" onClick={handleSaveProfile} disabled={saving || !hasChanges}>
             <Save className="w-3.5 h-3.5 me-1.5" />
             {saving ? t('profile.saving') : t('profile.saveChanges')}
           </Button>
         </div>
       </div>

       {/* Notification Preferences */}
       <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
         <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
             <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.notificationPreferences')}</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.notificationPreferencesDesc')}</p>
           </div>
         </div>

         <div className="space-y-3">
           {([
             ['email', t('profile.emailNotif')],
             ['sms', t('profile.smsNotif')],
             ['push', t('profile.pushNotif')],
             ['price', t('profile.priceAlertsNotif')],
             ['stock', t('profile.stockAlerts')],
             ['deal', t('profile.dealAlerts')],
           ] as [keyof NotificationSettings, string][]).map(([key, label]) => (
             <div key={key} className="flex items-center justify-between gap-3">
               <Label className="text-sm text-gray-700 dark:text-gray-300">{label}</Label>
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
       </div>
     </div>

     {/* Right column (col-span-2) */}
     <div className="lg:col-span-2 space-y-4">
       {/* Preferences */}
       <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
         <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
             <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.preferencesTitle')}</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.customizeExperience')}</p>
           </div>
         </div>

         <div className="space-y-4">
           {/* Language pill toggle */}
           <div className="space-y-1.5">
             <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.language')}</Label>
             <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-1 flex">
               <button
                 type="button"
                 onClick={() => {
                   setPreferredLanguage('ar');
                   if (locale !== 'ar') {
                     const newPath = window.location.pathname.replace(`/${locale}`, '/ar');
                     router.push(newPath);
                   }
                 }}
                 className={cn(
                   'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                   preferredLanguage === 'ar'
                     ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                 )}
               >
                 العربية
               </button>
               <button
                 type="button"
                 onClick={() => {
                   setPreferredLanguage('en');
                   if (locale !== 'en') {
                     const newPath = window.location.pathname.replace(`/${locale}`, '/en');
                     router.push(newPath);
                   }
                 }}
                 className={cn(
                   'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                   preferredLanguage === 'en'
                     ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                 )}
               >
                 English
               </button>
             </div>
           </div>

           {/* Theme pill toggle */}
           <div className="space-y-1.5">
             <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.theme')}</Label>
             <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-1 flex">
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
                     'flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5',
                     currentTheme === value
                       ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                       : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                   )}
                 >
                   <Icon className="w-3.5 h-3.5" />
                   {label}
                 </button>
               ))}
             </div>
           </div>
         </div>
       </div>

       {/* Security */}
       <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
         <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
             <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.securityTitle')}</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.changePasswordDescription')}</p>
           </div>
         </div>

         {!showPasswordChange ? (
           <Button variant="outline" size="sm" onClick={() => setShowPasswordChange(true)} className="w-full">
             <Lock className="w-3.5 h-3.5 me-1.5" />
             {t('profile.changePassword')}
           </Button>
         ) : (
           <div className="space-y-3">
             <div className="space-y-1.5">
               <Label htmlFor="newPassword" className="text-sm">{t('profile.newPassword')}</Label>
               <div className="relative">
                 <Input
                   id="newPassword"
                   type={showNewPassword ? 'text' : 'password'}
                   value={newPassword}
                   onChange={(e) => setNewPassword(e.target.value)}
                   placeholder={t('profile.newPasswordPlaceholder')}
                   className="pe-9"
                 />
                 <button
                   type="button"
                   onClick={() => setShowNewPassword(!showNewPassword)}
                   className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" style={{ insetInlineEnd: '0.625rem' }}
                 >
                   {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                 </button>
               </div>
             </div>
             <div className="space-y-1.5">
               <Label htmlFor="confirmPassword" className="text-sm">{t('profile.confirmPassword')}</Label>
               <div className="relative">
                 <Input
                   id="confirmPassword"
                   type={showConfirmPassword ? 'text' : 'password'}
                   value={confirmPassword}
                   onChange={(e) => setConfirmPassword(e.target.value)}
                   placeholder={t('profile.confirmPasswordPlaceholder')}
                   className="pe-9"
                 />
                 <button
                   type="button"
                   onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                   className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" style={{ insetInlineEnd: '0.625rem' }}
                 >
                   {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                 </button>
               </div>
             </div>
             <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={() => setShowPasswordChange(false)} className="flex-1">
                 {t('profile.cancel')}
               </Button>
               <Button size="sm" onClick={handleChangePassword} disabled={saving} className="flex-1">
                 {saving ? t('profile.saving') : t('profile.saveChanges')}
               </Button>
             </div>
           </div>
         )}
       </div>

       {/* Privacy & Data */}
       <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
         <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
             <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.privacyAndData')}</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.privacyAndDataDesc')}</p>
           </div>
         </div>

         <div className="space-y-3">
           <div className="flex items-center justify-between gap-3">
             <Label className="text-sm text-gray-700 dark:text-gray-300">{t('profile.publicProfile')}</Label>
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
           <div className="flex items-center justify-between gap-3">
             <Label className="text-sm text-gray-700 dark:text-gray-300">{t('profile.shareSearchHistory')}</Label>
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

           <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.exportData')}</p>
                 <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.exportDataDesc')}</p>
               </div>
               <Button variant="outline" size="sm" onClick={handleExportData} disabled={exporting}>
                 <Download className="w-3.5 h-3.5 me-1.5" />
                 {exporting ? t('profile.exporting') : t('profile.exportData')}
               </Button>
             </div>
           </div>
         </div>
       </div>

       {/* Danger Zone */}
       <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-5">
         <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
             <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
           </div>
           <div>
             <h2 className="font-semibold text-red-700 dark:text-red-400">{t('profile.dangerZone')}</h2>
             <p className="text-xs text-red-500/70 dark:text-red-400/60">{t('profile.dangerZoneDescription')}</p>
           </div>
         </div>

         <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
           <DialogTrigger asChild>
             <Button variant="destructive" size="sm" className="w-full">
               <Trash2 className="w-3.5 h-3.5 me-1.5" />
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
       </div>
     </div>
   </div>
 </div>
 );
}
