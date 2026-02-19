/**
 * Push Notification Service
 *
 * Handles:
 * - Permission requests
 * - Expo push token registration
 * - Token storage in Supabase user_preferences
 * - Notification channel setup (Android)
 * - Foreground notification handling
 * - Notification response (tap) routing
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase/client';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if permissions denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D47A1',
    });

    await Notifications.setNotificationChannelAsync('price-alerts', {
      name: 'Price Alerts',
      description: 'Notifications when product prices drop to your target',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#34C759',
    });

    await Notifications.setNotificationChannelAsync('deals', {
      name: 'Deals & Offers',
      description: 'New deals and special offers',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissions denied');
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Save the push token to Supabase user_preferences.
 */
export async function savePushToken(userId: string, pushToken: string): Promise<void> {
  try {
    // Upsert into user_preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          notification_preferences: {
            push_enabled: true,
            push_token: pushToken,
            push_platform: Platform.OS,
            push_registered_at: new Date().toISOString(),
          },
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Remove push token from Supabase (on logout).
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .update({
        notification_preferences: {
          push_enabled: false,
          push_token: null,
          push_platform: Platform.OS,
        },
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing push token:', error);
    }
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

/**
 * Handle notification tap — route to relevant screen based on data payload.
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;

  if (!data) return;

  // Route based on notification type
  if (data.product_slug) {
    router.push(`/(stack)/product/${data.product_slug}`);
  } else if (data.type === 'price_drop' && data.product_id) {
    router.push(`/(stack)/price-alerts`);
  } else if (data.type === 'deal') {
    router.push('/(tabs)/deals');
  } else if (data.type === 'back_in_stock' && data.product_slug) {
    router.push(`/(stack)/product/${data.product_slug}`);
  } else {
    // Default: go to notifications screen
    router.push('/(stack)/notifications');
  }
}

/**
 * Set badge count on app icon.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Fail silently
  }
}

/**
 * Get current unread notification count from Supabase.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  } catch {
    return 0;
  }
}
