/**
 * Tests for Profile Management
 */

import { getUserProfile, updateUserProfile, getUserStats } from '@/lib/auth/profile';
import { supabase } from '@/lib/database';

describe('Profile Management', () => {
  let testUserId: string;
  let createdTestUser = false;

  beforeAll(async () => {
    // Try to get existing admin user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .maybeSingle();

    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      // Create a test user directly
      const testId = '00000000-0000-0000-0000-000000000001';
      const { data, error } = await supabase.from('users').insert({
        id: testId,
        email: `test-${Date.now()}@example.com`,
        full_name: 'Test User',
        role: 'customer',
      }).select().single();

      if (error) {
        console.error('Error creating test user:', error);
        throw error;
      }

      testUserId = data.id;
      createdTestUser = true;
    }
  });

  afterAll(async () => {
    // Cleanup test user if we created one
    if (createdTestUser && testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
    }
  });

  describe('getUserProfile', () => {
    it('should fetch user profile', async () => {
      const { data, error } = await getUserProfile(testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(data.id).toBe(testUserId);
        expect(data.role).toBeDefined();
      }
    });

    it('should return error for non-existent user', async () => {
      const { data, error } = await getUserProfile('00000000-0000-0000-0000-000000000000');

      expect(data).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const updates = {
        full_name: 'Test User Updated',
        preferred_language: 'en' as const,
      };

      const { data, error } = await updateUserProfile(testUserId, updates);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(data.full_name).toBe(updates.full_name);
        expect(data.preferred_language).toBe(updates.preferred_language);
      }
    });

    it('should handle partial updates', async () => {
      const updates = {
        preferred_language: 'ar' as const,
      };

      const { data, error } = await updateUserProfile(testUserId, updates);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(data.preferred_language).toBe('ar');
      }
    });
  });

  describe('getUserStats', () => {
    it('should fetch user statistics', async () => {
      const { data, error } = await getUserStats(testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        expect(typeof data.wishlist_count).toBe('number');
        expect(typeof data.price_alerts_count).toBe('number');
        expect(typeof data.search_count).toBe('number');
        expect(typeof data.reviews_count).toBe('number');
      }
    });

    it('should return zero counts for new user', async () => {
      // Create a new test user
      const { data: newUser } = await supabase.from('users').insert({
        email: `test-${Date.now()}@example.com`,
        role: 'customer',
      }).select().single();

      if (newUser) {
        const { data } = await getUserStats(newUser.id);

        expect(data).toBeDefined();
        if (data) {
          expect(data.wishlist_count).toBe(0);
          expect(data.price_alerts_count).toBe(0);
          expect(data.search_count).toBe(0);
          expect(data.reviews_count).toBe(0);
        }

        // Cleanup
        await supabase.from('users').delete().eq('id', newUser.id);
      }
    });
  });
});
