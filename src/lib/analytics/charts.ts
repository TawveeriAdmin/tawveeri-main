/**
 * Analytics Chart Utility Functions
 * Functions for formatting and fetching chart data
 */

import { getSupabaseBrowserClient, createServerClient } from '@/lib/database';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface RevenueChartData extends ChartDataPoint {
  revenue: number;
  transactions: number;
}

/**
 * Format data for charts
 */
export function formatChartData(
  data: Array<{ date: string; value: number }>,
  type: 'line' | 'bar'
): ChartDataPoint[] {
  return data.map((item) => ({
    date: item.date,
    value: item.value,
    label: new Date(item.date).toLocaleDateString(),
  }));
}

/**
 * Get revenue chart data for a store
 */
export async function getRevenueChartData(
  storeId: string,
  period: '7d' | '30d' | '90d' | '1y'
): Promise<{ data: RevenueChartData[] | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

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

    // Get transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('amount, created_at, status')
      .in('product_store_id', productStoreIds)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (transactionsError) throw transactionsError;

    // Group by date
    const revenueByDate: Record<
      string,
      { revenue: number; transactions: number }
    > = {};

    transactions?.forEach((t) => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      if (!revenueByDate[date]) {
        revenueByDate[date] = { revenue: 0, transactions: 0 };
      }
      revenueByDate[date].revenue += t.amount || 0;
      revenueByDate[date].transactions += 1;
    });

    // Fill in missing dates
    const data: RevenueChartData[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = revenueByDate[dateStr] || { revenue: 0, transactions: 0 };
      data.push({
        date: dateStr,
        value: dayData.revenue,
        revenue: dayData.revenue,
        transactions: dayData.transactions,
        label: currentDate.toLocaleDateString(),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching revenue chart data:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get user growth chart data
 */
export async function getUserGrowthChartData(
  period: '7d' | '30d' | '90d' | '1y'
): Promise<{ data: ChartDataPoint[] | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get users created in date range
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (usersError) throw usersError;

    // Group by date and calculate cumulative
    const usersByDate: Record<string, number> = {};
    let cumulative = 0;

    // First, get total users before start date
    const { count: beforeCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', startDate.toISOString());

    cumulative = beforeCount || 0;

    // Group new users by date
    users?.forEach((user) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      usersByDate[date] = (usersByDate[date] || 0) + 1;
    });

    // Create chart data with cumulative counts
    const data: ChartDataPoint[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      cumulative += usersByDate[dateStr] || 0;
      data.push({
        date: dateStr,
        value: cumulative,
        label: currentDate.toLocaleDateString(),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user growth chart data:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get product performance chart data
 */
export async function getProductPerformanceChartData(
  productId: string,
  period: '7d' | '30d' | '90d'
): Promise<{ data: ChartDataPoint[] | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
    }

    // Note: This is a placeholder. In a real implementation, you would need
    // to track product views/saves/comparisons over time in a separate table.
    // For now, we'll return the current stats as a single data point.

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('view_count, save_count, comparison_count')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // Return single data point with current stats
    // In production, you'd query a product_analytics_history table
    const data: ChartDataPoint[] = [
      {
        date: endDate.toISOString().split('T')[0],
        value: product.view_count || 0,
        label: 'Views',
      },
    ];

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching product performance chart data:', error);
    return { data: null, error: error as Error };
  }
}

