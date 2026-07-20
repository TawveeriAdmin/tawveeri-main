/**
 * Store Owner Utility Functions
 * Functions for store owner dashboard statistics and analytics
 */

// Server-only — see the note in @/lib/admin/utils. This module reads
// mv_store_analytics, which is revoked from anon and authenticated.
import 'server-only';
import { createServerClient } from '@/lib/database';
import type { StoreAnalytics } from '@/lib/admin/utils';

export interface StoreOwnerStats {
  totalProducts: number;
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export interface StoreProductAnalytics {
  product_id: string;
  product_name_ar: string;
  product_name_en: string;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface StoreRevenueData {
  date: string;
  revenue: number;
  transactions: number;
}

/**
 * Get store owner statistics
 */
export async function getStoreOwnerStats(
  storeId: string,
  userId: string
): Promise<{ data: StoreOwnerStats | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    // Verify user owns the store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('created_by')
      .eq('id', storeId)
      .single();

    if (storeError) throw storeError;
    if (store.created_by !== userId) {
      throw new Error('User does not own this store');
    }

    // Get product store IDs first
    const { data: productStores, error: psError } = await supabase
      .from('product_stores')
      .select('id')
      .eq('store_id', storeId);

    if (psError) throw psError;

    const productStoreIds = productStores?.map((ps) => ps.id) || [];

    // Fetch store stats
    const [productsResult, analyticsResult, revenueResult, reviewsResult] = await Promise.all([
      supabase
        .from('product_stores')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId),
      supabase
        .from('mv_store_analytics')
        .select('*')
        .eq('store_id', storeId)
        .single(),
      productStoreIds.length > 0
        ? supabase
            .from('transactions')
            .select('amount, status')
            .eq('status', 'completed')
            .in('product_store_id', productStoreIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('stores')
        .select('average_rating, total_reviews')
        .eq('id', storeId)
        .single(),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (revenueResult.error) throw revenueResult.error;
    if (reviewsResult.error) throw reviewsResult.error;

    const totalRevenue =
      revenueResult.data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const analytics = analyticsResult.data as StoreAnalytics | null;

    return {
      data: {
        totalProducts: productsResult.count || 0,
        totalViews: 0, // Will be calculated from product views
        totalClicks: analytics?.total_clicks || 0,
        totalConversions: analytics?.total_conversions || 0,
        totalRevenue,
        averageRating: reviewsResult.data?.average_rating || 0,
        totalReviews: reviewsResult.data?.total_reviews || 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching store owner stats:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get product performance analytics for a store
 */
export async function getStoreProductAnalytics(
  storeId: string
): Promise<{ data: StoreProductAnalytics[] | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    
    // Get products with analytics
    const { data, error } = await supabase
      .from('product_stores')
      .select(
        `
        id,
        product_id,
        products (
          id,
          name_ar,
          name_en,
          view_count
        )
      `
      )
      .eq('store_id', storeId);

    if (error) throw error;

    // Get transaction data for each product
    const productStoreIds = (data || []).map((ps: any) => ps.id);
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('product_store_id, amount, status, clicked_at')
      .in('product_store_id', productStoreIds);

    if (transactionsError) throw transactionsError;

    // Calculate analytics per product
    const analytics: StoreProductAnalytics[] = (data || []).map((ps: any) => {
      const productTransactions = (transactions || []).filter((t: any) => t.product_store_id === ps.id);
      const clicks = productTransactions.filter((t: any) => t.clicked_at).length;
      const conversions = productTransactions.filter((t: any) => t.status === 'completed').length;
      const revenue =
        productTransactions
          .filter((t: any) => t.status === 'completed')
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;

      const product = ps.products as any;

      return {
        product_id: product?.id || ps.product_id,
        product_name_ar: product?.name_ar || '',
        product_name_en: product?.name_en || '',
        views: product?.view_count || 0,
        clicks,
        conversions,
        revenue,
      };
    });

    return { data: analytics, error: null };
  } catch (error) {
    console.error('Error fetching store product analytics:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get store revenue data for a date range
 */
export async function getStoreRevenue(
  storeId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ data: StoreRevenueData[] | null; error: Error | null }> {
  try {
    const supabase = createServerClient();

    // Get product store IDs for this store
    const { data: productStores, error: psError } = await supabase
      .from('product_stores')
      .select('id')
      .eq('store_id', storeId);

    if (psError) throw psError;

    const productStoreIds = productStores?.map((ps) => ps.id) || [];

    if (productStoreIds.length === 0) {
      return { data: [], error: null };
    }

    // Build query for transactions
    let query = supabase
      .from('transactions')
      .select('amount, created_at, status')
      .in('product_store_id', productStoreIds)
      .eq('status', 'completed');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data: transactions, error: transactionsError } = await query.order(
      'created_at',
      { ascending: true }
    );

    if (transactionsError) throw transactionsError;

    // Group by date
    const revenueByDate: Record<string, { revenue: number; transactions: number }> = {};

    transactions?.forEach((t) => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      if (!revenueByDate[date]) {
        revenueByDate[date] = { revenue: 0, transactions: 0 };
      }
      revenueByDate[date].revenue += t.amount || 0;
      revenueByDate[date].transactions += 1;
    });

    // Convert to array
    const revenueData: StoreRevenueData[] = Object.entries(revenueByDate).map(
      ([date, data]) => ({
        date,
        revenue: data.revenue,
        transactions: data.transactions,
      })
    );

    // Sort by date
    revenueData.sort((a, b) => a.date.localeCompare(b.date));

    return { data: revenueData, error: null };
  } catch (error) {
    console.error('Error fetching store revenue:', error);
    return { data: null, error: error as Error };
  }
}

