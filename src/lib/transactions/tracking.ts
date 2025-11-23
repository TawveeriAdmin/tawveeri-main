/**
 * Transaction Tracking Utility Functions
 * Functions for tracking clicks, conversions, and generating affiliate URLs
 */

import { getSupabaseBrowserClient, createServerClient } from '@/lib/database';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

export interface ClickTrackingMetadata {
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

export interface TransactionStats {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommissions: number;
}

/**
 * Track a product click and return click_id
 */
export async function trackProductClick(
  productStoreId: string,
  userId: string | null,
  metadata?: ClickTrackingMetadata
): Promise<{ data: string | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Get product store details to calculate commission
    const { data: productStore, error: psError } = await supabase
      .from('product_stores')
      .select(
        `
        id,
        current_price,
        stores (
          id,
          commission_rate
        )
      `
      )
      .eq('id', productStoreId)
      .single();

    if (psError) throw psError;
    if (!productStore) throw new Error('Product store not found');

    const productStoreData = productStore as any;
    const store = productStoreData.stores as any;
    const commissionRate = store?.commission_rate || 0;
    const currentPrice = productStoreData.current_price || 0;
    const commissionAmount = (currentPrice * commissionRate) / 100;

    // Generate unique click_id
    const clickId =
      typeof window === 'undefined'
        ? `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        : crypto.randomUUID();

    // Create transaction record
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        product_store_id: productStoreId,
        amount: currentPrice,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
        click_id: clickId,
        clicked_at: new Date().toISOString(),
        user_agent: metadata?.userAgent || null,
        ip_address: metadata?.ipAddress || null,
        referrer: metadata?.referrer || null,
      })
      .select('click_id')
      .single();

    if (error) throw error;
    return { data: data.click_id, error: null };
  } catch (error) {
    console.error('Error tracking product click:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Track a conversion (update transaction status to completed)
 */
export async function trackConversion(
  clickId: string,
  amount: number,
  metadata?: Record<string, any>
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Find transaction by click_id
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('id, commission_rate')
      .eq('click_id', clickId)
      .eq('status', 'pending')
      .single();

    if (findError) throw findError;
    if (!transaction) throw new Error('Transaction not found or already converted');

    // Calculate commission
    const commissionAmount = ((amount * (transaction.commission_rate || 0)) / 100);

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        amount,
        commission_amount: commissionAmount,
        converted_at: new Date().toISOString(),
        ...metadata,
      })
      .eq('id', transaction.id);

    if (updateError) throw updateError;
    return { error: null };
  } catch (error) {
    console.error('Error tracking conversion:', error);
    return { error: error as Error };
  }
}

/**
 * Get transaction statistics
 */
export async function getTransactionStats(
  userId?: string,
  storeId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ data: TransactionStats | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Build query
    let query = supabase.from('transactions').select('status, amount, commission_amount');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (storeId) {
      // Get product store IDs for this store
      const { data: productStores } = await supabase
        .from('product_stores')
        .select('id')
        .eq('store_id', storeId);

      const productStoreIds = productStores?.map((ps) => ps.id) || [];
      if (productStoreIds.length > 0) {
        query = query.in('product_store_id', productStoreIds);
      }
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    const transactions = data || [];
    const clicks = transactions.filter((t) => t.status !== null).length;
    const conversions = transactions.filter((t) => t.status === 'completed').length;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const totalRevenue = transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalCommissions = transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.commission_amount || 0), 0);

    return {
      data: {
        totalClicks: clicks,
        totalConversions: conversions,
        conversionRate,
        totalRevenue,
        totalCommissions,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Generate affiliate URL with click tracking
 */
export async function generateAffiliateUrl(
  productStoreId: string,
  userId?: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    const supabase = getSupabase();

    // Get product store details
    const { data: productStore, error: psError } = await supabase
      .from('product_stores')
      .select('affiliate_url, product_url')
      .eq('id', productStoreId)
      .single();

    if (psError) throw psError;
    if (!productStore) throw new Error('Product store not found');

    // Track click first
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : undefined;
    const referrer = typeof window !== 'undefined' ? document.referrer : undefined;

    const { data: clickId, error: trackError } = await trackProductClick(
      productStoreId,
      userId || null,
      { userAgent, referrer }
    );

    if (trackError || !clickId) {
      // If tracking fails, still return URL without tracking
      const url = productStore.affiliate_url || productStore.product_url;
      return { data: url, error: null };
    }

    // Generate tracking URL
    const baseUrl = productStore.affiliate_url || productStore.product_url;
    try {
      const url = new URL(baseUrl);
      
      // Add click_id as query parameter
      url.searchParams.set('click_id', clickId);
      if (userId) {
        url.searchParams.set('user_id', userId);
      }

      return { data: url.toString(), error: null };
    } catch (urlError) {
      // If URL parsing fails, append query params manually
      const separator = baseUrl.includes('?') ? '&' : '?';
      const trackingUrl = `${baseUrl}${separator}click_id=${clickId}${userId ? `&user_id=${userId}` : ''}`;
      return { data: trackingUrl, error: null };
    }
  } catch (error) {
    console.error('Error generating affiliate URL:', error);
    // Return base URL even if tracking fails
    const supabase = getSupabase();
    const { data: productStore } = await supabase
      .from('product_stores')
      .select('affiliate_url, product_url')
      .eq('id', productStoreId)
      .single();
    
    const url = productStore?.affiliate_url || productStore?.product_url || null;
    return { data: url, error: error as Error };
  }
}

