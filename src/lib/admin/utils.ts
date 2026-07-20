/**
 * Admin Utility Functions
 * Functions for admin dashboard statistics and analytics
 */

// Server-only. These functions read administrative aggregates
// (mv_user_analytics, mv_product_analytics, mv_store_analytics), which are
// revoked from anon and authenticated and readable only by the service role.
//
// This module previously chose its client by render context:
//   typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient()
// The same function therefore ran with service-role privileges on the server and
// anon privileges in the browser — an invisible change of authority determined by
// where it happened to be called. Importing 'server-only' turns a client-side
// import into a build error instead of a silent privilege downgrade.
import 'server-only';
import { createServerClient } from '@/lib/database';

export interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  totalStores: number;
  totalTransactions: number;
  totalRevenue: number;
}

export interface UserAnalytics {
  user_id: string;
  total_wishlists: number;
  total_searches: number;
  total_price_alerts: number;
  total_comparisons: number;
  last_active_at: string | null;
}

export interface ProductAnalytics {
  product_id: string;
  total_views: number;
  total_saves: number;
  total_comparisons: number;
  average_rating: number | null;
  total_reviews: number | null;
}

export interface StoreAnalytics {
  store_id: string;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  average_commission: number;
}

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(): Promise<{ data: AdminStats | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    // Fetch all stats in parallel
    const [usersResult, productsResult, storesResult, transactionsResult, revenueResult] =
      await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
        supabase
          .from('transactions')
          .select('amount')
          .eq('status', 'completed'),
      ]);

    if (usersResult.error) throw usersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (storesResult.error) throw storesResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    const totalRevenue =
      revenueResult.data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    return {
      data: {
        totalUsers: usersResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalStores: storesResult.count || 0,
        totalTransactions: transactionsResult.count || 0,
        totalRevenue,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get user analytics from materialized view
 */
export async function getUserAnalytics(
  userId: string
): Promise<{ data: UserAnalytics | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('mv_user_analytics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { data: data as UserAnalytics, error: null };
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get product analytics from materialized view
 */
export async function getProductAnalytics(
  productId: string
): Promise<{ data: ProductAnalytics | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('mv_product_analytics')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error) throw error;
    return { data: data as ProductAnalytics, error: null };
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get store analytics from materialized view
 */
export async function getStoreAnalytics(
  storeId: string
): Promise<{ data: StoreAnalytics | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('mv_store_analytics')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error) throw error;
    return { data: data as StoreAnalytics, error: null };
  } catch (error) {
    console.error('Error fetching store analytics:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Refresh analytics materialized views
 */
export async function refreshAnalyticsViews(): Promise<{ error: Error | null }> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.rpc('refresh_analytics_views');

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error refreshing analytics views:', error);
    return { error: error as Error };
  }
}

