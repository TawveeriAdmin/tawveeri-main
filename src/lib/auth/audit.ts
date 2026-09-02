/**
 * Audit Logging System
 * Tracks all important system activities for admin review
 */

import { createServerClient } from '@/lib/database';

export interface AuditLogParams {
  user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

let hasWarnedMissingServiceRoleKey = false;

/**
 * Create an audit log entry
 * Note: This function fails silently to prevent blocking user actions
 * Audit logs are important but not critical for user flow
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    // Client-side code cannot access service-role credentials.
    // Skip silently to avoid blocking auth flows like logout.
    if (typeof window !== 'undefined') {
      return { error: null, skipped: true };
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      if (!hasWarnedMissingServiceRoleKey) {
        console.warn('Audit logging disabled: SUPABASE_SERVICE_ROLE_KEY is not configured.');
        hasWarnedMissingServiceRoleKey = true;
      }
      return { error: null, skipped: true };
    }

    const supabase = createServerClient();
    // Validate required fields
    if (!params.action) {
      console.warn('createAuditLog: action is required');
      return { error: new Error('createAuditLog: action is required') };
    }

    const { error } = await supabase.from('admin_logs').insert({
      user_id: params.user_id || null,
      action: params.action,
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      details: params.details || null,
      ip_address: params.ip_address || null,
      user_agent: params.user_agent || null,
    });

    if (error) {
      // Log error but don't throw - audit logs shouldn't block user actions
      console.error('Error creating audit log:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        action: params.action,
        user_id: params.user_id,
      });
      return { error };
    }

    return { error: null };
  } catch (error) {
    // Catch any unexpected errors
    console.error('Unexpected error in createAuditLog:', error);
    return { error: error as Error };
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters?: {
  user_id?: string;
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const supabase = createServerClient();

    let query = supabase
      .from('admin_logs')
      .select(
        `
        *,
        users (
          email,
          full_name,
          role
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }

    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    // Pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return {
      data: [],
      count: 0,
      error: error as Error,
    };
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  return getAuditLogs({ user_id: userId, limit, offset });
}

/**
 * Get audit logs for a specific action type
 */
export async function getAuditLogsByAction(
  action: string,
  limit: number = 50,
  offset: number = 0
) {
  return getAuditLogs({ action, limit, offset });
}

/**
 * Get recent audit logs (last 24 hours)
 */
export async function getRecentAuditLogs(limit: number = 100) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getAuditLogs({
    start_date: yesterday.toISOString(),
    limit,
  });
}

/**
 * Common audit log actions
 */
export const AUDIT_ACTIONS = {
  // Authentication
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  EMAIL_VERIFIED: 'email_verified',
  PHONE_VERIFIED: 'phone_verified',

  // Profile
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPDATED: 'avatar_updated',

  // Products
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  PRODUCT_VIEWED: 'product_viewed',

  // Stores
  STORE_CREATED: 'store_created',
  STORE_UPDATED: 'store_updated',
  STORE_DELETED: 'store_deleted',

  // Wishlist
  PRODUCT_ADDED_TO_WISHLIST: 'product_added_to_wishlist',
  PRODUCT_REMOVED_FROM_WISHLIST: 'product_removed_from_wishlist',

  // Price Alerts
  PRICE_ALERT_CREATED: 'price_alert_created',
  PRICE_ALERT_DELETED: 'price_alert_deleted',

  // Reviews
  REVIEW_CREATED: 'review_created',
  REVIEW_UPDATED: 'review_updated',
  REVIEW_DELETED: 'review_deleted',

  // Admin
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_SUSPENDED: 'user_suspended',
  USER_ACTIVATED: 'user_activated',

  // Coupons
  COUPON_CREATED: 'coupon_created',
  COUPON_UPDATED: 'coupon_updated',
  COUPON_DELETED: 'coupon_deleted',
  COUPON_COPIED: 'coupon_copied',

  // Affiliate campaigns (Affiliate Campaign Revenue Layer V1)
  AFFILIATE_CAMPAIGN_CREATED: 'affiliate_campaign_created',
  AFFILIATE_CAMPAIGN_UPDATED: 'affiliate_campaign_updated',
  AFFILIATE_CAMPAIGN_DELETED: 'affiliate_campaign_deleted',

  // Price Alerts (extended)
  PRICE_ALERT_TOGGLED: 'price_alert_toggled',
  PRICE_DROP_ALERT_SENT: 'price_drop_alert_sent',
  BACK_IN_STOCK_ALERT_SENT: 'back_in_stock_alert_sent',

  // Store
  STORE_SYNC_COMPLETED: 'store_sync_completed',

  // Account
  ACCOUNT_DELETED: 'account_deleted',
  USER_ROLE_CHANGED_NOTIFIED: 'user_role_changed_notified',
  NEW_DEVICE_LOGIN: 'new_device_login',

  // Saved Searches
  SAVED_SEARCH_CREATED: 'saved_search_created',
  SAVED_SEARCH_DELETED: 'saved_search_deleted',
  SAVED_SEARCH_RESULTS: 'saved_search_results',

  // Cron
  COUPON_EXPIRY_WARNINGS_SENT: 'coupon_expiry_warnings_sent',
  COUPON_WISHLIST_ALERTS_SENT: 'coupon_wishlist_alerts_sent',

  // Scraping
  SCRAPING_SCHEDULE_CREATED: 'scraping_schedule_created',
  SCRAPING_SCHEDULE_UPDATED: 'scraping_schedule_updated',
  SCRAPING_SCHEDULE_DELETED: 'scraping_schedule_deleted',
  SCRAPING_RUN_TRIGGERED: 'scraping_run_triggered',
  SCRAPING_LIVE_SEARCH_EXECUTED: 'scraping_live_search_executed',
  SCRAPING_LIVE_SEARCH_INGESTED: 'scraping_live_search_ingested',

  // System
  SYSTEM_ERROR: 'system_error',
  SECURITY_ALERT: 'security_alert',
} as const;

/**
 * Helper to log authentication events
 */
export async function logAuthEvent(
  userId: string,
  action: string,
  details?: Record<string, any>
) {
  return createAuditLog({
    user_id: userId,
    action,
    entity_type: 'user',
    entity_id: userId,
    details,
  });
}

/**
 * Helper to log product events
 */
export async function logProductEvent(
  userId: string | null,
  action: string,
  productId: string,
  details?: Record<string, any>
) {
  return createAuditLog({
    user_id: userId,
    action,
    entity_type: 'product',
    entity_id: productId,
    details,
  });
}

/**
 * Helper to log store events
 */
export async function logStoreEvent(
  userId: string | null,
  action: string,
  storeId: string,
  details?: Record<string, any>
) {
  return createAuditLog({
    user_id: userId,
    action,
    entity_type: 'store',
    entity_id: storeId,
    details,
  });
}

/**
 * Helper to log coupon events
 */
export async function logCouponEvent(
  userId: string | null,
  action: string,
  couponId: string,
  details?: Record<string, any>
) {
  return createAuditLog({
    user_id: userId,
    action,
    entity_type: 'coupon',
    entity_id: couponId,
    details,
  });
}

/**
 * Export audit logs (for admin download)
 */
export async function exportAuditLogs(
  filters?: {
    start_date?: string;
    end_date?: string;
    action?: string;
  },
  format: 'json' | 'csv' = 'json'
) {
  try {
    const { data, error } = await getAuditLogs({
      ...filters,
      limit: 10000, // Large limit for export
    });

    if (error) throw error;

    if (format === 'csv') {
      // Convert to CSV
      return convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    throw error;
  }
}

/**
 * Convert audit logs to CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = [
    'Timestamp',
    'User ID',
    'User Email',
    'Action',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'Details',
  ];

  const rows = data.map((log) => [
    log.created_at,
    log.user_id || '',
    log.users?.email || '',
    log.action,
    log.entity_type || '',
    log.entity_id || '',
    log.ip_address || '',
    JSON.stringify(log.details || {}),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csv;
}
