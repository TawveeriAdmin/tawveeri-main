// Retailer Partnership Report — data layer (ADR-216).
// Same commercial vocabulary and same underlying tables as command-center-queries.ts, scoped to
// ONE retailer, built specifically to be credible evidence for a future retailer conversation
// (affiliate agreement, marketing partnership, product feed). Never claims a sale, a customer,
// or a confirmed arrival beyond what outbound_clicks/usage_events actually prove.
import { createServerClient } from '@/lib/database';
import { getProviderByStoreId, listProviders } from '@/lib/providers/registry';
import {
  resolvePeriod, fetchUsageEvents, fetchOutboundClicks,
  COMMERCIAL_BASELINE, computeCampaignAttribution,
  type Period, type DateRange,
} from './command-center-queries';

export interface RetailerOption { slug: string; storeId: number; displayName: string; displayNameAr: string; hasAffiliateProgram: boolean }

export function listRetailerOptions(): RetailerOption[] {
  return listProviders().map((p) => ({
    slug: p.slug,
    storeId: p.storeId,
    displayName: p.displayName,
    displayNameAr: p.displayNameAr || p.displayName,
    hasAffiliateProgram: Boolean(p.affiliate),
  }));
}

export interface DailyTrendPoint { date: string; redirects: number; qualifiedSessions: number }

export interface RetailerReport {
  retailer: { slug: string; storeId: number; displayName: string; displayNameAr: string; hasAffiliateProgram: boolean } | null;
  range: DateRange;
  generatedAt: string;
  qualifiedSessions: number;
  confirmedRedirects: number;
  totalOutboundClicks: number;
  uniqueProducts: number;
  topProducts: Array<{ id: string; nameAr: string; nameEn: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  dailyTrend: DailyTrendPoint[];
  acquisition: { withKnownCampaign: number; unknownCampaign: number; bySource: Array<{ source: string; count: number }> };
  limitations: string[];
  sampleSize: number;
}

async function categoriesForProducts(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data } = await supabase.from('canonical_products').select('id, category').in('id', ids);
  return new Map(((data ?? []) as Array<{ id: string; category: string | null }>).map((p) => [p.id, p.category || '(unparsed)']));
}

async function namesForProducts(ids: string[]): Promise<Map<string, { nameAr: string; nameEn: string }>> {
  if (ids.length === 0) return new Map();
  const supabase = createServerClient() as unknown as { from: (table: string) => any };
  const { data } = await supabase.from('canonical_products').select('id, name_ar, name_en').in('id', ids);
  return new Map(((data ?? []) as Array<{ id: string; name_ar: string | null; name_en: string | null }>).map((p) => [p.id, { nameAr: p.name_ar || p.id, nameEn: p.name_en || p.id }]));
}

export async function getRetailerReport(
  storeId: number,
  period: Period,
  customStart?: string,
  customEnd?: string,
  includeHistorical: boolean = false
): Promise<RetailerReport> {
  const range = resolvePeriod(period, customStart, customEnd);
  const fetchStart = includeHistorical ? range.start : new Date(Math.max(range.start.getTime(), COMMERCIAL_BASELINE.getTime()));

  const [events, outboundRows] = await Promise.all([
    fetchUsageEvents(fetchStart, range.end),
    fetchOutboundClicks(fetchStart, range.end),
  ]);

  const realEvents = events.filter((e) => !e.is_test);
  const storeKey = String(storeId);
  const retailerRows = outboundRows.filter((r) => !r.is_test && r.store_name === storeKey);

  const productIds = Array.from(new Set(retailerRows.map((r) => r.canonical_product_id).filter((x): x is string => Boolean(x))));
  const [categories, names] = await Promise.all([categoriesForProducts(productIds), namesForProducts(productIds)]);

  // Qualified sessions for this retailer: REAL go_click events whose canonical_id is among the
  // products actually referred to this store (same proxy method as command-center-queries.ts's
  // retailerBreakdown — outbound_clicks.session_id is unpopulated, ADR-207).
  const productSet = new Set(productIds);
  const qualifiedSessionIds = new Set<string>();
  for (const e of realEvents) {
    if (e.event_type === 'go_click' && e.session_id && e.canonical_id && productSet.has(e.canonical_id)) {
      qualifiedSessionIds.add(e.session_id);
    }
  }

  const productCounts = new Map<string, number>();
  for (const r of retailerRows) {
    if (!r.canonical_product_id) continue;
    productCounts.set(r.canonical_product_id, (productCounts.get(r.canonical_product_id) || 0) + 1);
  }
  const topProducts = Array.from(productCounts.entries())
    .map(([id, count]) => ({ id, count, ...(names.get(id) || { nameAr: id, nameEn: id }) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const categoryCounts = new Map<string, number>();
  for (const r of retailerRows) {
    if (!r.canonical_product_id) continue;
    const cat = categories.get(r.canonical_product_id) || '(unparsed)';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const topCategories = Array.from(categoryCounts.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

  // Daily trend — group by Riyadh calendar day (UTC+3, no DST).
  const byDay = new Map<string, { redirects: number; sessions: Set<string> }>();
  for (const r of retailerRows) {
    const riyadh = new Date(new Date(r.clicked_at).getTime() + 3 * 60 * 60 * 1000);
    const day = riyadh.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { redirects: 0, sessions: new Set<string>() };
    bucket.redirects++;
    byDay.set(day, bucket);
  }
  for (const e of realEvents) {
    if (e.event_type !== 'go_click' || !e.session_id || !e.canonical_id || !productSet.has(e.canonical_id)) continue;
    const riyadh = new Date(new Date(e.created_at).getTime() + 3 * 60 * 60 * 1000);
    const day = riyadh.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { redirects: 0, sessions: new Set<string>() };
    bucket.sessions.add(e.session_id);
    byDay.set(day, bucket);
  }
  const dailyTrend = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, redirects: v.redirects, qualifiedSessions: v.sessions.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const goClicksForStore = realEvents.filter((e) => e.event_type === 'go_click' && e.canonical_id && productSet.has(e.canonical_id));
  const attribution = computeCampaignAttribution(goClicksForStore, retailerRows);

  const provider = getProviderByStoreId(storeId);
  const limitations: string[] = [
    'Qualified sessions are approximated via product-level correlation, not a direct session→retailer join (outbound_clicks.session_id is not populated — see ADR-207).',
    'Confirmed redirects count clicks through /go only; some legacy storefront exits are not routed through /go and are not included here.',
    'No order, shipment, or commission data is included — this report contains no affiliate-network-reported figures.',
  ];

  return {
    retailer: provider ? { slug: provider.slug, storeId: provider.storeId, displayName: provider.displayName, displayNameAr: provider.displayNameAr || provider.displayName, hasAffiliateProgram: Boolean(provider.affiliate) } : null,
    range,
    generatedAt: new Date().toISOString(),
    qualifiedSessions: qualifiedSessionIds.size,
    confirmedRedirects: retailerRows.length,
    totalOutboundClicks: retailerRows.length,
    uniqueProducts: productIds.length,
    topProducts,
    topCategories,
    dailyTrend,
    acquisition: { withKnownCampaign: attribution.withKnownCampaign, unknownCampaign: attribution.unknownCampaign, bySource: attribution.bySource },
    limitations,
    sampleSize: retailerRows.length,
  };
}

// Deterministic narrative — no LLM, no invented causation (ADR-216 section 8 rule reused here).
export function buildRetailerNarrative(report: RetailerReport, isRTL: boolean): string {
  const name = report.retailer ? (isRTL ? report.retailer.displayNameAr : report.retailer.displayName) : (isRTL ? 'هذا المتجر' : 'this retailer');
  if (report.confirmedRedirects === 0) {
    return isRTL
      ? `خلال الفترة المحددة، لم تُسجَّل أي إحالة مؤكدة إلى ${name}.`
      : `During the selected period, no confirmed redirects to ${name} were recorded.`;
  }
  const topCats = report.topCategories.slice(0, 3).map((c) => c.category).join(isRTL ? '، ' : ', ');
  return isRTL
    ? `خلال الفترة المحددة، أحال توفيري ${report.qualifiedSessions} زيارة مؤهلة إلى ${name} عبر ${report.uniqueProducts} منتجاً (${report.confirmedRedirects} تحويلة مؤكدة). أعلى الفئات اهتماماً: ${topCats || 'غير محدد'}.`
    : `During the selected period, Tawveeri referred ${report.qualifiedSessions} qualified visits to ${name} across ${report.uniqueProducts} products (${report.confirmedRedirects} confirmed redirects). The highest-interest categories were ${topCats || 'not yet clear'}.`;
}
