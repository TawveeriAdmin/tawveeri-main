'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { User, Mail, Phone, Globe, Moon, Sun, Monitor, Camera, Trash2, AlertTriangle, Save, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/database';
import { updateAvatar, deleteAvatar, resendEmailVerification, resendPhoneVerification, verifyPhoneOTP } from '@/lib/auth/profile';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

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
 const [emailVerified, setEmailVerified] = useState(false);
 const [phoneVerified, setPhoneVerified] = useState(false);
 const fileInputRef = useRef<HTMLInputElement | null>(null);


 // Password change state
 const [showPasswordChange, setShowPasswordChange] = useState(false);
 const [currentPassword, setCurrentPassword] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');

 // Load user data
 useEffect(() => {
 if (authLoading) return;

 if (!user) {
 router.push(`/${locale}/auth/login`);
 return;
 }

 setFullName(user.full_name || '');
 setEmail(user.email || '');
 setPhone(user.phone || '');
 setAvatarUrl(user.avatar_url || null);
 setPreferredLanguage((user.preferred_language as 'ar' | 'en') || locale);
 setCurrentTheme(theme || 'system');
 setEmailVerified(user.email_verified ?? !!user.email_confirmed_at);
 setPhoneVerified(user.phone_verified ?? false);
 setPhoneOtp('');
 setPhoneOtpSent(false);
 setLoading(false);
 }, [user, authLoading, router, locale, theme]);

 // Redirect if not authenticated
 if (authLoading || loading) {
 return (
 <div className="space-y-6 max-w-4xl">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-96 w-full rounded-xl" />
 </div>
 );
 }

 if (!user) {
 return null; // Will redirect
 }

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
 
 // Update language in URL if changed
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
 // First, sign out the user
 const { error: signOutError } = await supabase.auth.signOut();

 if (signOutError) throw signOutError;

 // Then delete the user record (this should be handled by a database function/trigger)
 // For now, we'll just sign out and show a message
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

 toast({
 title: t('profile.verificationSent'),
 description: t('profile.checkInbox'),
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


 return (
 <div className="space-y-6 max-w-4xl">
 <PageBreadcrumbs items={[{ label: t('dashboard.profileMenu.profile') }]} />

 {/* Header */}
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
 {t('profile.title')}
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {t('profile.manageProfile')}
 </p>
 </div>

 <div className="space-y-6">
 {/* Profile Information */}
 <Card>
 <CardHeader>
 <CardTitle>{t('profile.personalInfo')}</CardTitle>
 <CardDescription>
 {t('profile.updatePersonalInfo')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Avatar */}
 <div className="flex items-center gap-6">
 <Avatar className="w-24 h-24">
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
 <div className="flex gap-2">
 <input
 ref={fileInputRef}
 id="avatar-upload"
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleAvatarUpload}
 />
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => fileInputRef.current?.click()}
 disabled={avatarUploading}
 >
 <Camera className="w-4 h-4 mr-2" />
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
 <Trash2 className="w-4 h-4 mr-2" />
 {avatarUploading ? t('profile.removing') : t('profile.removeAvatar')}
 </Button>
 )}
 </div>
 </div>
 </div>

 {/* Full Name */}
 <div className="space-y-2">
 <Label htmlFor="fullName" className="flex items-center gap-2">
 <User className="w-4 h-4" />
 {t('profile.fullName')}
 </Label>
 <Input
 id="fullName"
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 placeholder={t('profile.enterFullName')}
 />
 </div>

 {/* Email */}
 <div className="space-y-2">
 <Label htmlFor="email" className="flex items-center gap-2">
 <Mail className="w-4 h-4" />
 {t('profile.email')}
 </Label>
 <Input
 id="email"
 type="email"
 value={email}
 disabled
 className="bg-surface-container-highest"
 />
 <p className="text-body-sm text-on-surface-variant">
 {t('profile.emailCannotChange')}
 </p>
 <div className="flex items-center gap-3 pt-2">
 <Badge variant={emailVerified ? 'success' : 'secondary'}>
 {emailVerified ? t('profile.verified') : t('profile.unverified')}
 </Badge>
 {!emailVerified && (
 <Button
 variant="outline"
 size="sm"
 onClick={handleResendEmail}
 disabled={emailResendLoading}
 >
 {emailResendLoading ? t('profile.sending') : t('profile.resendVerification')}
 </Button>
 )}
 </div>
 </div>

 {/* Phone */}
 <div className="space-y-2">
 <Label htmlFor="phone" className="flex items-center gap-2">
 <Phone className="w-4 h-4" />
 {t('profile.phone')}
 </Label>
 <Input
 id="phone"
 type="tel"
 value={phone}
 disabled
 className="bg-surface-container-highest"
 />
 <p className="text-body-sm text-on-surface-variant">
 {t('profile.phoneCannotChange')}
 </p>
 <div className="space-y-3 pt-2">
 <div className="flex items-center gap-3">
 <Badge variant={phoneVerified ? 'success' : 'secondary'}>
 {phoneVerified ? t('profile.verified') : t('profile.unverified')}
 </Badge>
 {!phoneVerified && (
 <Button
 variant="outline"
 size="sm"
 onClick={handleResendPhone}
 disabled={phoneResendLoading || !user?.phone}
 >
 {phoneResendLoading ? t('profile.sending') : phoneOtpSent ? t('profile.resendCode') : t('profile.sendCode')}
 </Button>
 )}
 </div>
 {!phoneVerified && phoneOtpSent && (
 <div className="flex flex-col sm:flex-row sm:items-center gap-2">
 <Input
 type="text"
 value={phoneOtp}
 onChange={(e) => setPhoneOtp(e.target.value)}
 placeholder={t('profile.enterVerificationCode')}
 className="sm:w-60"
 />
 <Button
 onClick={handleVerifyPhone}
 disabled={phoneVerifyLoading || phoneOtp.trim().length === 0}
 >
 {phoneVerifyLoading ? t('profile.verifying') : t('common.verify')}
 </Button>
 </div>
 )}
 </div>
 </div>

 {/* Save Button */}
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => router.back()}>
 <X className="w-4 h-4 mr-2" />
 {t('profile.cancel')}
 </Button>
 <Button onClick={handleSaveProfile} disabled={saving}>
 <Save className="w-4 h-4 mr-2" />
 {saving ? t('profile.saving') : t('profile.saveChanges')}
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Preferences */}
 <Card>
 <CardHeader>
 <CardTitle>{t('profile.preferences')}</CardTitle>
 <CardDescription>
 {t('profile.customizeExperience')}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Language */}
 <div className="space-y-2">
 <Label htmlFor="language" className="flex items-center gap-2">
 <Globe className="w-4 h-4" />
 {t('profile.language')}
 </Label>
 <Select
 value={preferredLanguage}
 onValueChange={(value) => setPreferredLanguage(value as 'ar' | 'en')}
 >
 <SelectTrigger id="language">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="ar">العربية</SelectItem>
 <SelectItem value="en">English</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Theme */}
 <div className="space-y-2">
 <Label htmlFor="theme" className="flex items-center gap-2">
 {currentTheme === 'dark' ? (
 <Moon className="w-4 h-4" />
 ) : currentTheme === 'light' ? (
 <Sun className="w-4 h-4" />
 ) : (
 <Monitor className="w-4 h-4" />
 )}
 {t('profile.theme')}
 </Label>
 <Select
 value={currentTheme}
 onValueChange={(value) => {
 setCurrentTheme(value);
 setTheme(value);
 }}
 >
 <SelectTrigger id="theme">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="light">
 <div className="flex items-center gap-2">
 <Sun className="w-4 h-4" />
 {t('profile.light')}
 </div>
 </SelectItem>
 <SelectItem value="dark">
 <div className="flex items-center gap-2">
 <Moon className="w-4 h-4" />
 {t('profile.dark')}
 </div>
 </SelectItem>
 <SelectItem value="system">
 <div className="flex items-center gap-2">
 <Monitor className="w-4 h-4" />
 {t('profile.system')}
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>

 {/* Change Password */}
 <Card>
 <CardHeader>
 <CardTitle>{t('profile.password')}</CardTitle>
 <CardDescription>
 {t('profile.changePasswordDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent>
 {!showPasswordChange ? (
 <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
 {t('profile.changePassword')}
 </Button>
 ) : (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
 <Input
 id="newPassword"
 type="password"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder={t('profile.newPasswordPlaceholder')}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
 <Input
 id="confirmPassword"
 type="password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 placeholder={t('profile.confirmPasswordPlaceholder')}
 />
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
 {t('profile.cancel')}
 </Button>
 <Button onClick={handleChangePassword} disabled={saving}>
 {saving ? t('profile.saving') : t('profile.saveChanges')}
 </Button>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Delete Account */}
 <Card className="border-red-200">
 <CardHeader>
 <CardTitle className="text-red-600">{t('profile.deleteAccount')}</CardTitle>
 <CardDescription>
 {t('profile.deleteAccountDescription')}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Alert variant="destructive">
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription>{t('profile.deleteAccountWarning')}</AlertDescription>
 </Alert>
 <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <DialogTrigger asChild>
 <Button variant="destructive" className="mt-4">
 <Trash2 className="w-4 h-4 mr-2" />
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
 </CardContent>
 </Card>
 </div>
 </div>
 );
}

