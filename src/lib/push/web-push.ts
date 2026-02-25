import webpush from 'web-push';
import { createServerClient } from '@/lib/database';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || 'noreply@';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${VAPID_CONTACT_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  dir?: 'ltr' | 'rtl';
  lang?: string;
  tag?: string;
}

/**
 * Get a user's web push subscription from user_preferences.
 * Returns null if not found or web push is disabled.
 */
export async function getWebPushSubscription(userId: string): Promise<WebPushSubscription | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('user_preferences')
      .select('notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    const prefs = data?.notification_preferences as Record<string, unknown> | null;
    if (!prefs || prefs.web_push_enabled === false) return null;

    const sub = prefs.web_push_subscription as WebPushSubscription | undefined;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return null;

    return sub;
  } catch {
    return null;
  }
}

/**
 * Remove expired web push subscription from user_preferences.
 * Called when push service returns 410 (Gone) or 404.
 */
async function removeExpiredWebPushSubscription(userId: string): Promise<void> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('user_preferences')
      .select('notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return;

    const prefs = (data.notification_preferences as Record<string, unknown>) || {};
    delete prefs.web_push_subscription;
    prefs.web_push_enabled = false;

    await supabase
      .from('user_preferences')
      .update({ notification_preferences: prefs })
      .eq('user_id', userId);
  } catch {
    // Fail silently
  }
}

/**
 * Send a web push notification to a user by their user ID.
 * Looks up their subscription and sends if available.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;

  const subscription = await getWebPushSubscription(userId);
  if (!subscription) return false;

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        dir: payload.dir,
        lang: payload.lang,
        tag: payload.tag,
        icon: '/images/favicon.ico',
      })
    );
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      await removeExpiredWebPushSubscription(userId);
    }
    return false;
  }
}
