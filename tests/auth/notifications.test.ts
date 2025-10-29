/**
 * Tests for Notification System
 */

import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
} from '@/lib/auth/notifications';
import { supabase } from '@/lib/database';

describe('Notification System', () => {
  let testUserId: string;
  let testNotificationId: string;

  beforeAll(async () => {
    // Get a test user ID
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single();
    testUserId = data?.id || '';
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const { error } = await createNotification({
        user_id: testUserId,
        type: 'system',
        title_ar: 'إشعار تجريبي',
        title_en: 'Test Notification',
        message_ar: 'هذا إشعار تجريبي',
        message_en: 'This is a test notification',
      });

      expect(error).toBeNull();
    });

    it('should create a price drop notification', async () => {
      // Get a test product
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .limit(1)
        .single();

      const { error } = await createNotification({
        user_id: testUserId,
        type: 'price_drop',
        title_ar: 'انخفض السعر',
        title_en: 'Price Dropped',
        message_ar: 'انخفض سعر المنتج الذي تتابعه',
        message_en: 'The price of your watched product dropped',
        product_id: product?.id,
      });

      expect(error).toBeNull();
    });
  });

  describe('getUserNotifications', () => {
    it('should fetch user notifications', async () => {
      const { data, error, count } = await getUserNotifications(testUserId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(typeof count).toBe('number');
    });

    it('should support pagination', async () => {
      const { data } = await getUserNotifications(testUserId, {
        limit: 5,
        offset: 0,
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
    });

    it('should filter unread notifications', async () => {
      const { data, error } = await getUserNotifications(testUserId, {
        unread_only: true,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0].is_read).toBe(false);
      }
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const { count, error } = await getUnreadCount(testUserId);

      expect(error).toBeNull();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('markNotificationAsRead', () => {
    beforeAll(async () => {
      // Create a test notification to mark as read
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', testUserId)
        .eq('is_read', false)
        .limit(1)
        .single();

      testNotificationId = data?.id || '';
    });

    it('should mark notification as read', async () => {
      if (testNotificationId) {
        const { error } = await markNotificationAsRead(testNotificationId);
        expect(error).toBeNull();

        // Verify it was marked as read
        const { data } = await supabase
          .from('notifications')
          .select('is_read')
          .eq('id', testNotificationId)
          .single();

        expect(data?.is_read).toBe(true);
      }
    });
  });
});
