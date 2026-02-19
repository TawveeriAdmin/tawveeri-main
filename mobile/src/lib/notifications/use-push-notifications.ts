/**
 * Hook to manage push notification lifecycle.
 *
 * - Registers for push on auth
 * - Removes token on sign out
 * - Listens for notification taps
 * - Updates badge count
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/src/lib/auth/auth-context';
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
  handleNotificationResponse,
  getUnreadCount,
  setBadgeCount,
} from './push';

export function usePushNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id && user.id !== previousUserId.current) {
      // User signed in — register push token
      previousUserId.current = user.id;

      registerForPushNotifications().then((token) => {
        if (token && user.id) {
          savePushToken(user.id, token);
        }
      });

      // Update badge count
      getUnreadCount(user.id).then((count) => {
        setBadgeCount(count);
      });
    } else if (!user && previousUserId.current) {
      // User signed out — remove token
      removePushToken(previousUserId.current);
      previousUserId.current = null;
      setBadgeCount(0);
    }
  }, [user]);

  useEffect(() => {
    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Update badge count when a notification comes in
      if (user?.id) {
        getUnreadCount(user.id).then((count) => {
          setBadgeCount(count);
        });
      }
    });

    // Listen for notification taps (foreground, background, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);
}
