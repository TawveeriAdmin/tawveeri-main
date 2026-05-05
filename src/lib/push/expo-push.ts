/**
 * Expo Push Notification sender for server-side use.
 *
 * Sends push notifications via Expo Push API to mobile devices.
 * Used by the check-price-alerts cron and other server-side triggers.
 *
 * Expo Push API docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { createServerClient } from '@/lib/database';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

interface PushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Send a push notification to a single Expo push token.
 */
export async function sendPushNotification(message: PushMessage): Promise<PushTicket | null> {
  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return result.data as PushTicket;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return null;
  }
}

/**
 * Send push notifications to multiple tokens at once (batched).
 */
export async function sendPushNotificationBatch(messages: PushMessage[]): Promise<PushTicket[]> {
  if (messages.length === 0) return [];

  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return result.data as PushTicket[];
  } catch (error) {
    console.error('Error sending push notification batch:', error);
    return [];
  }
}

/**
 * Look up a user's push token from user_preferences.
 * Returns null if not found or push is disabled.
 */
export async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('user_preferences')
      .select('notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    const prefs = data?.notification_preferences as Record<string, unknown> | null;
    if (!prefs || prefs.push_enabled === false) return null;

    const token = prefs.push_token as string | undefined;
    if (!token || !token.startsWith('ExponentPushToken[')) return null;

    return token;
  } catch {
    return null;
  }
}

/**
 * Send a push notification to a user by their user ID.
 * Looks up their push token and sends if available.
 */
export async function sendPushToUser(
  userId: string,
  options: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channelId?: string;
  }
): Promise<boolean> {
  const token = await getUserPushToken(userId);
  if (!token) return false;

  const ticket = await sendPushNotification({
    to: token,
    title: options.title,
    body: options.body,
    data: options.data,
    channelId: options.channelId || 'default',
    sound: 'default',
    priority: 'high',
  });

  return ticket?.status === 'ok';
}
