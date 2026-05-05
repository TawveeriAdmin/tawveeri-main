/**
 * Tests for Profile Management
 */

import { getUserProfile, updateUserProfile, getUserStats } from '@/lib/auth/profile';
import { createServerClient } from '@/lib/database';

type GenericRecord = Record<string, any>;

describe('Profile Management', () => {
  let testUserId: string;
  let createdTestUser = false;
  const supabase = createServerClient();

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

      const created = data as GenericRecord;
      testUserId = created.id;
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
        const profile = data as GenericRecord;
        expect(profile.id).toBe(testUserId);
        expect(profile.role).toBeDefined();
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
        const profile = data as GenericRecord;
        expect(profile.full_name).toBe(updates.full_name);
        expect(profile.preferred_language).toBe(updates.preferred_language);
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
        const profile = data as GenericRecord;
        expect(profile.preferred_language).toBe('ar');
      }
    });
  });

  describe('getUserStats', () => {
    it('should fetch user statistics', async () => {
      const { data, error } = await getUserStats(testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data) {
        const stats = data as GenericRecord;
        expect(typeof stats.wishlist_count).toBe('number');
        expect(typeof stats.price_alerts_count).toBe('number');
        expect(typeof stats.search_count).toBe('number');
        expect(typeof stats.reviews_count).toBe('number');
      }
    });

    it('should return zero counts for new user', async () => {
      // Create a new test user
      const { data: newUser } = await supabase.from('users').insert({
        email: `test-${Date.now()}@example.com`,
        role: 'customer',
      }).select().single();

      if (newUser) {
        const newUserRecord = newUser as GenericRecord;
        const { data } = await getUserStats(newUserRecord.id);

        expect(data).toBeDefined();
        if (data) {
          const stats = data as GenericRecord;
          expect(stats.wishlist_count).toBe(0);
          expect(stats.price_alerts_count).toBe(0);
          expect(stats.search_count).toBe(0);
          expect(stats.reviews_count).toBe(0);
        }

        // Cleanup
        await supabase.from('users').delete().eq('id', newUserRecord.id);
      }
    });
  });
});
