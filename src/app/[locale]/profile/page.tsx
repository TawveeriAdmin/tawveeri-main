'use client';

import { useEffect, useState, useRef } from 'react';
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
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { User, Mail, Phone, Globe, Moon, Sun, Monitor, Camera, Trash2, AlertTriangle, Save, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/database';
import { updateAvatar, deleteAvatar, resendEmailVerification, resendPhoneVerification, verifyPhoneOTP } from '@/lib/auth/profile';

export default function ProfilePage() {
  const supabase = getSupabaseBrowserClient();
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
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
        description: locale === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('profile.passwordError'),
        description: locale === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters',
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
        title: locale === 'ar' ? 'تم تحديث الصورة' : 'Avatar updated',
        variant: 'default',
      });

      await refreshSession();
    } catch (error) {
      toast({
        title: locale === 'ar' ? 'فشل التحديث' : 'Update failed',
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
        title: locale === 'ar' ? 'تمت إزالة الصورة' : 'Avatar removed',
        variant: 'default',
      });

      await refreshSession();
    } catch (error) {
      toast({
        title: locale === 'ar' ? 'فشل الإزالة' : 'Removal failed',
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
        title: locale === 'ar' ? 'تم الإرسال' : 'Verification sent',
        description: locale === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Check your inbox for the verification email',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: locale === 'ar' ? 'فشل الإرسال' : 'Send failed',
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
        title: locale === 'ar' ? 'رقم الهاتف غير موجود' : 'Phone number missing',
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
        title: locale === 'ar' ? 'تم إرسال الرمز' : 'OTP sent',
        description: locale === 'ar' ? 'تم إرسال رمز التحقق عبر الرسائل القصيرة' : 'Verification code sent via SMS',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: locale === 'ar' ? 'فشل الإرسال' : 'Send failed',
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
        title: locale === 'ar' ? 'رقم الهاتف غير موجود' : 'Phone number missing',
        variant: 'destructive',
      });
      return;
    }

    if (!phoneOtp.trim()) {
      toast({
        title: locale === 'ar' ? 'أدخل الرمز' : 'Enter OTP',
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
        title: locale === 'ar' ? 'تم التحقق من الهاتف' : 'Phone verified',
        variant: 'default',
      });

      await refreshSession();
    } catch (error) {
      toast({
        title: locale === 'ar' ? 'فشل التحقق' : 'Verification failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPhoneVerifyLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{locale === 'ar' ? 'الرئيسية' : 'Home'}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('profile.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('profile.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {locale === 'ar' ? 'إدارة ملفك الشخصي وإعداداتك' : 'Manage your profile and settings'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.personalInfo')}</CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'حدّث معلوماتك الشخصية' : 'Update your personal information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={avatarUrl || undefined} alt={fullName || 'User'} />
                  <AvatarFallback className="bg-primary-600 text-white text-2xl">
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
                      {avatarUploading
                        ? locale === 'ar'
                          ? 'جاري التحميل...'
                          : 'Uploading...'
                        : t('profile.changeAvatar')}
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
                        {avatarUploading
                          ? locale === 'ar'
                            ? 'جاري الإزالة...'
                            : 'Removing...'
                          : t('profile.removeAvatar')}
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
                  placeholder={locale === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'}
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
                  className="bg-gray-100 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'لا يمكن تغيير البريد الإلكتروني' : 'Email cannot be changed'}
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Badge variant={emailVerified ? 'success' : 'secondary'}>
                    {emailVerified ? (locale === 'ar' ? 'تم التحقق' : 'Verified') : locale === 'ar' ? 'غير متحقق' : 'Unverified'}
                  </Badge>
                  {!emailVerified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendEmail}
                      disabled={emailResendLoading}
                    >
                      {emailResendLoading ? (locale === 'ar' ? 'جاري الإرسال...' : 'Sending...') : locale === 'ar' ? 'إعادة إرسال التحقق' : 'Resend verification'}
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
                  className="bg-gray-100 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? 'لا يمكن تغيير رقم الهاتف' : 'Phone number cannot be changed'}
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={phoneVerified ? 'success' : 'secondary'}>
                      {phoneVerified ? (locale === 'ar' ? 'تم التحقق' : 'Verified') : locale === 'ar' ? 'غير متحقق' : 'Unverified'}
                    </Badge>
                    {!phoneVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResendPhone}
                        disabled={phoneResendLoading || !user?.phone}
                      >
                        {phoneResendLoading ? (locale === 'ar' ? 'جاري الإرسال...' : 'Sending...') : phoneOtpSent ? (locale === 'ar' ? 'إعادة إرسال الرمز' : 'Resend code') : locale === 'ar' ? 'إرسال الرمز' : 'Send code'}
                      </Button>
                    )}
                  </div>
                  {!phoneVerified && phoneOtpSent && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type="text"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value)}
                        placeholder={locale === 'ar' ? 'أدخل رمز التحقق' : 'Enter verification code'}
                        className="sm:w-60"
                      />
                      <Button
                        onClick={handleVerifyPhone}
                        disabled={phoneVerifyLoading || phoneOtp.trim().length === 0}
                      >
                        {phoneVerifyLoading ? (locale === 'ar' ? 'جاري التحقق...' : 'Verifying...') : locale === 'ar' ? 'تحقق' : 'Verify'}
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
                  {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('profile.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.preferences')}</CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'تخصيص تجربتك' : 'Customize your experience'}
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
                {locale === 'ar' ? 'تغيير كلمة المرور' : 'Change your password'}
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
                      placeholder={locale === 'ar' ? 'كلمة المرور الجديدة' : 'New password'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
                      {t('profile.cancel')}
                    </Button>
                    <Button onClick={handleChangePassword} disabled={saving}>
                      {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('profile.saveChanges')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">{t('profile.deleteAccount')}</CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'احذف حسابك بشكل دائم' : 'Permanently delete your account'}
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
                      {deleteLoading
                        ? locale === 'ar'
                          ? 'جاري الحذف...'
                          : 'Deleting...'
                        : t('profile.deleteAccountConfirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

