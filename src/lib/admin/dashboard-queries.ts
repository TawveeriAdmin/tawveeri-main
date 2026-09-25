import { createServerClient, fetchAllPaginated } from '@/lib/database';

export type TimePeriod = '7d' | '30d' | '90d';

function getPeriodDays(period: TimePeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

function getDateRange(period: TimePeriod) {
  const days = getPeriodDays(period);
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return {
    currentStart: start.toISOString(),
    previousStart: prevStart.toISOString(),
    now: now.toISOString(),
    currentStartDate: start,
  };
}

export interface DashboardKPIs {
  totalUsers: number | null;
  totalProducts: number | null;
  totalStores: number | null;
  totalTransactions: number | null;
  totalRevenue: number | null;
  activeDeals: number | null;
  activePriceAlerts: number | null;
  usersTrend: number | null;
  revenueTrend: number | null;
  revenueSparkline: number[];
  usersSparkline: number[];
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const sb = createServerClient();
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const previous = new Date(start.getTime() - 30 * 86400000);
  const [users, products, stores, deals, alerts, currentUsers, previousUsers] = await Promise.all([
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb.from('products').select('id', { count: 'exact', head: true }),
    sb.from('stores').select('id', { count: 'exact', head: true }),
    sb.from('product_stores').select('id', { count: 'exact', head: true }).eq('is_deal', true),
    sb.from('price_alerts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('users').select('id', { count: 'exact', head: true }).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
    sb.from('users').select('id', { count: 'exact', head: true }).gte('created_at', previous.toISOString()).lt('created_at', start.toISOString()),
  ]);
  const value = (r: { error: unknown; count: number | null }) => r.error ? null : r.count;
  const current = value(currentUsers), prior = value(previousUsers);
  return {
    totalUsers: value(users), totalProducts: value(products), totalStores: value(stores),
    // Legacy transactions cannot establish partner-reported orders or revenue.
    totalTransactions: null, totalRevenue: null,
    activeDeals: value(deals), activePriceAlerts: value(alerts),
    usersTrend: current !== null && prior !== null && prior > 0 ? Math.round((current - prior) / prior * 100) : null,
    revenueTrend: null, revenueSparkline: [], usersSparkline: [],
  };
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  transactions: number;
}

export async function getRevenueOverTime(period: TimePeriod): Promise<RevenueDataPoint[]> {
  const supabase = createServerClient();
  const { currentStart } = getDateRange(period);

  const { data } = await supabase
    .from('transactions')
    .select('amount, created_at')
    .eq('status', 'completed')
    .gte('created_at', currentStart)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  const grouped: Record<string, { revenue: number; transactions: number }> = {};
  for (const row of data) {
    const date = row.created_at.split('T')[0];
    if (!grouped[date]) grouped[date] = { revenue: 0, transactions: 0 };
    grouped[date].revenue += row.amount || 0;
    grouped[date].transactions += 1;
  }

  // Fill in missing dates
  const days = getPeriodDays(period);
  const result: RevenueDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    result.push({
      date,
      revenue: grouped[date]?.revenue || 0,
      transactions: grouped[date]?.transactions || 0,
    });
  }

  return result;
}

export interface UserRegistrationDataPoint {
  date: string;
  count: number;
  cumulative: number;
}

export async function getUserRegistrationsByDay(period: TimePeriod): Promise<UserRegistrationDataPoint[]> {
  const supabase = createServerClient();
  const { currentStart } = getDateRange(period);

  const { data } = await supabase
    .from('users')
    .select('created_at')
    .gte('created_at', currentStart)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  const grouped: Record<string, number> = {};
  for (const row of data) {
    const date = row.created_at.split('T')[0];
    grouped[date] = (grouped[date] || 0) + 1;
  }

  const days = getPeriodDays(period);
  const result: UserRegistrationDataPoint[] = [];
  const now = new Date();
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const count = grouped[date] || 0;
    cumulative += count;
    result.push({ date, count, cumulative });
  }

  return result;
}

export interface CategoryDistributionItem {
  name: string;
  value: number;
}

export async function getCategoryDistribution(): Promise<CategoryDistributionItem[]> {
  const supabase = createServerClient();

  const data = await fetchAllPaginated<{ category: string | null }>((from, to) =>
    supabase.from('products').select('category').order('id', { ascending: true }).range(from, to)
  );

  if (!data || data.length === 0) return [];

  const grouped: Record<string, number> = {};
  for (const row of data) {
    const cat = row.category || 'Other';
    grouped[cat] = (grouped[cat] || 0) + 1;
  }

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export interface StorePerformanceItem {
  name: string;
  revenue: number;
  transactions: number;
}

export async function getStorePerformanceRanking(locale: string): Promise<StorePerformanceItem[]> {
  const supabase = createServerClient();
  const nameField = locale === 'ar' ? 'name_ar' : 'name_en';

  // Get transactions with product_stores and stores
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      amount,
      product_stores (
        store_id,
        stores (
          ${nameField}
        )
      )
    `)
    .eq('status', 'completed');

  if (!transactions || transactions.length === 0) {
    // No transactions → say so. The old fallback relabeled a product count as
    // "transactions" (and queried stores.total_products, which does not exist
    // in production) — a fabricated chart on a founder surface.
    return [];
  }

  const grouped: Record<string, { name: string; revenue: number; transactions: number }> = {};
  for (const t of transactions) {
    const ps = t.product_stores as any;
    if (!ps?.stores) continue;
    const storeId = ps.store_id;
    const storeName = ps.stores[nameField] || 'Unknown';
    if (!grouped[storeId]) {
      grouped[storeId] = { name: storeName, revenue: 0, transactions: 0 };
    }
    grouped[storeId].revenue += t.amount || 0;
    grouped[storeId].transactions += 1;
  }

  return Object.values(grouped)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);
}

export interface ConversionFunnelItem {
  stage: string;
  count: number;
}

export async function getConversionFunnel(): Promise<ConversionFunnelItem[]> {
  const supabase = createServerClient();

  const [allResult, convertedResult, completedResult] = await Promise.all([
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('id', { count: 'exact', head: true })
      .not('converted_at', 'is', null),
    supabase.from('transactions').select('id', { count: 'exact', head: true })
      .eq('status', 'completed'),
  ]);

  return [
    { stage: 'clicks', count: allResult.count || 0 },
    { stage: 'conversions', count: convertedResult.count || 0 },
    { stage: 'completed', count: completedResult.count || 0 },
  ];
}

export interface DealActivityDataPoint {
  date: string;
  activeDeals: number;
  newDeals: number;
}

export async function getDealActivityOverTime(period: TimePeriod): Promise<DealActivityDataPoint[]> {
  const supabase = createServerClient();
  const { currentStart } = getDateRange(period);

  const { data } = await supabase
    .from('product_stores')
    .select('is_deal, created_at, updated_at')
    .eq('is_deal', true)
    .gte('updated_at', currentStart);

  if (!data || data.length === 0) return [];

  const days = getPeriodDays(period);
  const now = new Date();
  const grouped: Record<string, { active: number; new: number }> = {};

  for (const row of data) {
    const date = (row.updated_at || row.created_at).split('T')[0];
    if (!grouped[date]) grouped[date] = { active: 0, new: 0 };
    grouped[date].active += 1;
    // If created within period, count as new
    if (row.created_at >= currentStart) {
      const createdDate = row.created_at.split('T')[0];
      if (!grouped[createdDate]) grouped[createdDate] = { active: 0, new: 0 };
      grouped[createdDate].new += 1;
    }
  }

  const result: DealActivityDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    result.push({
      date,
      activeDeals: grouped[date]?.active || 0,
      newDeals: grouped[date]?.new || 0,
    });
  }

  return result;
}
