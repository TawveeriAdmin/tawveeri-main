/**
 * Tests for Audit Logging System
 */

import { createAuditLog, getAuditLogs, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { createServerClient } from '@/lib/database';

describe('Audit Logging', () => {
  let testUserId: string;
  const supabase = createServerClient();

  beforeAll(async () => {
    // Get a test user ID (using admin from seed data)
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single();
    testUserId = data?.id || '';
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const result = await createAuditLog({
        user_id: testUserId,
        action: AUDIT_ACTIONS.USER_LOGIN,
        entity_type: 'user',
        entity_id: testUserId,
        details: { method: 'email' },
      });

      expect(result).toBeDefined();
    });

    it('should handle missing optional fields', async () => {
      const result = await createAuditLog({
        action: AUDIT_ACTIONS.SYSTEM_ERROR,
        details: { error: 'Test error' },
      });

      expect(result).toBeDefined();
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs', async () => {
      const { data, error } = await getAuditLogs({ limit: 10 });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by user_id', async () => {
      const { data, error } = await getAuditLogs({
        user_id: testUserId,
        limit: 10,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      if (Array.isArray(data) && data.length > 0) {
        const [first] = data as Array<{ user_id?: string | null }>;
        expect(first.user_id).toBe(testUserId);
      }
    });

    it('should filter by action', async () => {
      const { data, error } = await getAuditLogs({
        action: AUDIT_ACTIONS.USER_LOGIN,
        limit: 10,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should support pagination', async () => {
      const { data, count } = await getAuditLogs({
        limit: 5,
        offset: 0,
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
      expect(typeof count).toBe('number');
    });
  });

  describe('AUDIT_ACTIONS', () => {
    it('should have all required action types', () => {
      expect(AUDIT_ACTIONS.USER_SIGNUP).toBe('user_signup');
      expect(AUDIT_ACTIONS.USER_LOGIN).toBe('user_login');
      expect(AUDIT_ACTIONS.USER_LOGOUT).toBe('user_logout');
      expect(AUDIT_ACTIONS.PASSWORD_CHANGED).toBe('password_changed');
      expect(AUDIT_ACTIONS.PRODUCT_CREATED).toBe('product_created');
      expect(AUDIT_ACTIONS.SYSTEM_ERROR).toBe('system_error');
    });
  });
});
