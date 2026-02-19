/**
 * Edit Profile Screen
 *
 * HIG: Form with grouped sections, avatar with image picker overlay,
 * verification badges, save button in header.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Mail, Phone, Shield } from 'lucide-react-native';
import { useTheme } from '@/src/lib/theme/theme-context';
import { useLocale } from '@/src/lib/i18n/provider';
import { useRTL } from '@/src/lib/rtl/useRTL';
import { useAuth } from '@/src/lib/auth/auth-context';
import { supabase } from '@/src/lib/supabase/client';
import { typography, spacing, radii, MIN_TOUCH_TARGET } from '@/src/lib/theme/typography';
import { Input, Button } from '@/src/components/ui';

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const rtl = useRTL();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasChanges = fullName !== (user?.full_name || '') || avatarUrl !== (user?.avatar_url || '');

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        locale === 'ar' ? 'صلاحية مطلوبة' : 'Permission Required',
        locale === 'ar' ? 'يرجى السماح بالوصول إلى الصور' : 'Please allow access to your photos',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    await uploadAvatar(result.assets[0].uri);
  }, [locale]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        locale === 'ar' ? 'صلاحية مطلوبة' : 'Permission Required',
        locale === 'ar' ? 'يرجى السماح بالوصول إلى الكاميرا' : 'Please allow camera access',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    await uploadAvatar(result.assets[0].uri);
  }, [locale]);

  const showImageOptions = () => {
    Alert.alert(
      locale === 'ar' ? 'صورة الملف الشخصي' : 'Profile Photo',
      undefined,
      [
        { text: locale === 'ar' ? 'الكاميرا' : 'Take Photo', onPress: takePhoto },
        { text: locale === 'ar' ? 'معرض الصور' : 'Choose from Library', onPress: pickImage },
        ...(avatarUrl ? [{ text: locale === 'ar' ? 'إزالة الصورة' : 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatarUrl('') }] : []),
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    setError('');

    try {
      // Read file and upload to Supabase Storage
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to ArrayBuffer for Supabase
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        // If storage bucket doesn't exist, just use the local URI as a preview
        console.error('Upload error:', uploadError);
        setAvatarUrl(uri);
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
      // Fallback: use local URI
      setAvatarUrl(uri);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    setError('');

    const updates: { full_name?: string; avatar_url?: string } = {};
    if (fullName !== (user?.full_name || '')) updates.full_name = fullName.trim();
    if (avatarUrl !== (user?.avatar_url || '')) updates.avatar_url = avatarUrl || undefined;

    const { error: saveError } = await updateProfile(updates);
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
    } else {
      router.back();
    }
  };

  const initial = fullName?.charAt(0)?.toUpperCase() || '?';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <Pressable onPress={showImageOptions} style={styles.avatarSection}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primaryContainer }]}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={[typography.largeTitle, { color: colors.primary }]}>{initial}</Text>
            )}

            {/* Camera overlay */}
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={16} color="#fff" />
              )}
            </View>
          </View>

          <Text style={[typography.subheadline, { color: colors.primary, marginTop: spacing.sm }]}>
            {locale === 'ar' ? 'تغيير الصورة' : 'Change Photo'}
          </Text>
        </Pressable>

        {/* Error */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, marginHorizontal: spacing.lg }]}>
            <Text style={[typography.footnote, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* Name Field */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Input
            label={locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}
            value={fullName}
            onChangeText={setFullName}
            placeholder={locale === 'ar' ? 'أدخل اسمك' : 'Enter your name'}
            textContentType="name"
            autoCapitalize="words"
          />
        </View>

        {/* Email (read-only) */}
        {user?.email && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Input
              label={locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              value={user.email}
              editable={false}
              icon={
                user.email_verified
                  ? <Check size={16} color={colors.systemGreen} />
                  : <Mail size={16} color={colors.tertiaryLabel} />
              }
            />
            {user.email_verified && (
              <View style={styles.verifiedRow}>
                <Shield size={12} color={colors.systemGreen} />
                <Text style={[typography.caption2, { color: colors.systemGreen, marginLeft: 4 }]}>
                  {locale === 'ar' ? 'تم التحقق' : 'Verified'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Phone (read-only) */}
        {user?.phone && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Input
              label={locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
              value={user.phone}
              editable={false}
              icon={
                user.phone_verified
                  ? <Check size={16} color={colors.systemGreen} />
                  : <Phone size={16} color={colors.tertiaryLabel} />
              }
            />
            {user.phone_verified && (
              <View style={styles.verifiedRow}>
                <Shield size={12} color={colors.systemGreen} />
                <Text style={[typography.caption2, { color: colors.systemGreen, marginLeft: 4 }]}>
                  {locale === 'ar' ? 'تم التحقق' : 'Verified'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Button
            title={locale === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            onPress={handleSave}
            loading={saving}
            disabled={!hasChanges || saving}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 2,
  },
});
