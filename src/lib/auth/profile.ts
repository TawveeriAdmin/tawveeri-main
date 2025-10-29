/**
 * User Profile Management Utilities
 */

import { supabase } from '@/lib/database';
import { createAuditLog } from './audit';
import { createNotification } from './notifications';

export interface UserProfile {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  preferred_language?: 'ar' | 'en';
  role?: 'admin' | 'customer' | 'store' | 'guest';
  auth_provider?: 'email' | 'phone' | 'google' | 'facebook' | 'apple';
  email_verified?: boolean;
  phone_verified?: boolean;
  created_at?: string;
  last_login_at?: string;
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'profile_updated',
      entity_type: 'user',
      entity_id: userId,
      details: updates,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Upload and update user avatar
 */
export async function updateAvatar(
  userId: string,
  file: File
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a valid image.');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size is 5MB.');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('user-avatars').getPublicUrl(filePath);

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'avatar_updated',
      entity_type: 'user',
      entity_id: userId,
      details: { avatar_url: publicUrl },
    });

    return { data: publicUrl, error: null };
  } catch (error) {
    console.error('Error updating avatar:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(userId: string) {
  try {
    // Get current avatar URL
    const { data: user } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (user?.avatar_url) {
      // Extract file path from URL
      const url = new URL(user.avatar_url);
      const filePath = url.pathname.split('/').slice(-2).join('/');

      // Delete from storage
      await supabase.storage.from('user-avatars').remove([filePath]);
    }

    // Update user profile to remove avatar
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (error) throw error;

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'avatar_updated',
      entity_type: 'user',
      entity_id: userId,
      details: { avatar_url: null },
    });

    return { error: null };
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return { error: error as Error };
  }
}

/**
 * Change user email
 */
export async function changeEmail(userId: string, newEmail: string) {
  try {
    // Update auth email
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) throw error;

    // Update database
    await supabase.from('users').update({ email: newEmail }).eq('id', userId);

    // Create notification
    await createNotification({
      user_id: userId,
      type: 'account',
      title_ar: 'تم تحديث البريد الإلكتروني',
      title_en: 'Email Updated',
      message_ar: 'تم تحديث بريدك الإلكتروني. يرجى التحقق من البريد الجديد.',
      message_en: 'Your email has been updated. Please verify your new email.',
    });

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'profile_updated',
      entity_type: 'user',
      entity_id: userId,
      details: { email: newEmail },
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error changing email:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Change user phone
 */
export async function changePhone(userId: string, newPhone: string) {
  try {
    // Update auth phone
    const { data, error } = await supabase.auth.updateUser({
      phone: newPhone,
    });

    if (error) throw error;

    // Update database
    await supabase.from('users').update({ phone: newPhone }).eq('id', userId);

    // Create notification
    await createNotification({
      user_id: userId,
      type: 'account',
      title_ar: 'تم تحديث رقم الهاتف',
      title_en: 'Phone Number Updated',
      message_ar: 'تم تحديث رقم هاتفك. يرجى التحقق من الرقم الجديد.',
      message_en: 'Your phone number has been updated. Please verify your new number.',
    });

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'profile_updated',
      entity_type: 'user',
      entity_id: userId,
      details: { phone: newPhone },
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error changing phone:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Delete user account
 */
export async function deleteAccount(userId: string) {
  try {
    // Delete user avatar if exists
    await deleteAvatar(userId);

    // Audit log before deletion
    await createAuditLog({
      user_id: userId,
      action: 'user_deleted',
      entity_type: 'user',
      entity_id: userId,
    });

    // Delete user from database (cascade will handle related records)
    const { error: dbError } = await supabase.from('users').delete().eq('id', userId);

    if (dbError) throw dbError;

    // Delete from auth
    // Note: This requires admin privileges or user to be logged in
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting from auth (may require admin):', authError);
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting account:', error);
    return { error: error as Error };
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  try {
    // Get wishlists count
    const { count: wishlistCount } = await supabase
      .from('user_wishlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get price alerts count
    const { count: alertsCount } = await supabase
      .from('price_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get search history count
    const { count: searchCount } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get reviews count
    const { count: reviewsCount } = await supabase
      .from('store_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      data: {
        wishlist_count: wishlistCount || 0,
        price_alerts_count: alertsCount || 0,
        search_count: searchCount || 0,
        reviews_count: reviewsCount || 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      data: null,
      error: error as Error,
    };
  }
}

/**
 * Verify email OTP
 */
export async function verifyEmailOTP(email: string, token: string) {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) throw error;

    if (data.user) {
      // Audit log
      await createAuditLog({
        user_id: data.user.id,
        action: 'email_verified',
        entity_type: 'user',
        entity_id: data.user.id,
      });
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Verify phone OTP
 */
export async function verifyPhoneOTP(phone: string, token: string) {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) throw error;

    if (data.user) {
      // Update phone_verified in database
      await supabase
        .from('users')
        .update({ phone_verified: true })
        .eq('id', data.user.id);

      // Audit log
      await createAuditLog({
        user_id: data.user.id,
        action: 'phone_verified',
        entity_type: 'user',
        entity_id: data.user.id,
      });
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Resend email verification
 */
export async function resendEmailVerification(email: string) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error resending email verification:', error);
    return { error: error as Error };
  }
}

/**
 * Resend phone verification
 */
export async function resendPhoneVerification(phone: string) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'sms',
      phone,
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error resending phone verification:', error);
    return { error: error as Error };
  }
}
