// src/lib/founder/demand.ts — products & needs center. Two separate rankings, never blended:
//   1. NEEDS — by distinct searching browsers (session-union per category, never event sums);
//   2. PRODUCT GROUPS — by browsers behind LINKED exits (I⋈O), the decision-grade product signal.
// Category is re-derived from query text with the platform's own parser (parseShoppingTask) —
// the same vocabulary canonical_products.category uses. «unparsed» is "not auto-classified",
// never "no results" and never a product category.
import { createServerClient } from '@/lib/database';
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { canonicalAnalyticsCategory } from '@/lib/admin/command-center-queries';
import { retailerDisplayName } from '@/lib/providers/registry';
import type { MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export const CATEGORY_AR: Record<string, string> = {
  air_conditioner: 'مكيفات', tv: 'تلفزيونات', tablet: 'تابلت', laptop: 'لابتوبات', mobile: 'جوالات', audio: 'صوتيات', camera: 'كاميرات',
  refrigerator: 'ثلاجات', washing_machine: 'غسالات', dishwasher: 'غسالات صحون', dryer: 'نشافات', freezer: 'فريزرات', microwave: 'ميكروويف',
  oven: 'أفران', cooker: 'طباخات', air_fryer: 'قلايات هوائية', air_purifier: 'منقيات هواء', vacuum: 'مكانس', coffee_maker: 'آلات قهوة',
  kettle: 'غلايات', toaster: 'محمصات', blender: 'خلاطات', monitor: 'شاشات', printer: 'طابعات', gaming: 'ألعاب', stylus: 'أقلام رقمية',
  water_heater: 'سخانات', fan: 'مراوح', unparsed: 'غير مصنف آليًا',
};
export const categoryAr = (c: string | null | undefined) => (c ? (CATEGORY_AR[c] ?? c) : CATEGORY_AR.unparsed);

interface QueryDemandRow {
  query_text: string; search_events: number; search_sessions: number; top_session_events: number;
  session_ids: string[]; positive_session_ids: string[]; product_session_ids: string[]; linked_session_ids: string[];
  no_answer_events: number; error_events: number; first_seen: string; last_seen: string;
}

export interface QueryDemand {
  query: string; category: string; searchEvents: number; searchSessions: number; topSessionEvents: number; concentration: number;
  positiveSessions: number; productSessions: number; linkedSessions: number; noAnswerEvents: number; errorEvents: number; lastSeen: string;
}

export interface NeedDemand {
  category: string; labelAr: string; queries: string[]; searchSessions: number; searchEvents: number; topSessionEvents: number;
  positiveSessions: number; productSessions: number; linkedSessions: number;
  catalog: { products: number; comparable: number; fresh72h: number } | null;
  /** measured | needs_fix | early — the three founder buckets. */
  bucket: 'demand_with_valid_comparison' | 'demand_needs_coverage_or_identity' | 'early_interest';
  bucketReasonAr: string;
}

export interface ProductDemand {
  canonicalId: string; nameAr: string; nameEn: string; brand: string | null; category: string | null; modelNumber: string | null;
  interactions: number; sessions: number; stores: string[]; channels: string[]; firstLinkedAt: string; lastLinkedAt: string;
  projection: { lowestPrice: number | null; storeCount: number | null; hasComparison: boolean | null; lastObservedAt: string | null; compareUrl: string | null } | null;
  identityCheck: { distinctModels: string[]; mixed: boolean; offers: number } | null;
  confidenceAr: string; blockerAr: string | null;
}

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const uniq = (a: string[]) => new Set(a.filter(Boolean)).size;

export async function fetchQueryDemand(w: MetricWindow): Promise<{ ok: true; rows: QueryDemandRow[] } | { ok: false; reason: string }> {
  try {
    const supabase = createServerClient() as unknown as AnyClient;
    const { data, error } = await supabase.rpc('founder_query_demand', { p_start: w.start.toISOString(), p_end: w.end.toISOString() });
    if (error) return { ok: false, reason: error.message };
    return { ok: true, rows: ((data ?? []) as QueryDemandRow[]).map((r) => ({ ...r, search_events: n(r.search_events), search_sessions: n(r.search_sessions), top_session_events: n(r.top_session_events), no_answer_events: n(r.no_answer_events), error_events: n(r.error_events) })) };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'unknown' }; }
}

export function classifyQuery(query: string): string {
  try { return parseShoppingTask(query).category || 'unparsed'; } catch { return 'unparsed'; }
}

export function buildQueryDemand(rows: QueryDemandRow[]): QueryDemand[] {
  return rows.map((r) => ({
    query: r.query_text, category: classifyQuery(r.query_text), searchEvents: r.search_events, searchSessions: r.search_sessions,
    topSessionEvents: r.top_session_events, concentration: r.search_events > 0 ? r.top_session_events / r.search_events : 0,
    positiveSessions: uniq(r.positive_session_ids ?? []), productSessions: uniq(r.product_session_ids ?? []), linkedSessions: uniq(r.linked_session_ids ?? []),
    noAnswerEvents: r.no_answer_events, errorEvents: r.error_events, lastSeen: r.last_seen,
  })).sort((a, b) => b.searchSessions - a.searchSessions || b.searchEvents - a.searchEvents);
}

export async function fetchCatalogCapability(): Promise<Map<string, { products: number; comparable: number; fresh72h: number }>> {
  const supabase = createServerClient() as unknown as AnyClient;
  const iso72 = new Date(Date.now() - 72 * 3600_000).toISOString();
  const out = new Map<string, { products: number; comparable: number; fresh72h: number }>();
  // Three exact head-counts per category is cheap and immune to the PostgREST row cap.
  const categories = Object.keys(CATEGORY_AR).filter((c) => c !== 'unparsed');
  await Promise.all(categories.map(async (c) => {
    const [{ count: products }, { count: comparable }, { count: fresh }] = await Promise.all([
      supabase.from('tps_product_projection').select('id', { count: 'exact', head: true }).eq('category', c),
      supabase.from('tps_product_projection').select('id', { count: 'exact', head: true }).eq('category', c).eq('has_comparison', true),
      supabase.from('tps_product_projection').select('id', { count: 'exact', head: true }).eq('category', c).eq('has_comparison', true).gte('last_observed_at', iso72),
    ]);
    if ((products ?? 0) > 0) out.set(c, { products: products ?? 0, comparable: comparable ?? 0, fresh72h: fresh ?? 0 });
  }));
  return out;
}

export function buildNeedDemand(rows: QueryDemandRow[], catalog: Map<string, { products: number; comparable: number; fresh72h: number }>): NeedDemand[] {
  const byCat = new Map<string, { queries: string[]; sessions: Set<string>; events: number; top: number; pos: Set<string>; prod: Set<string>; linked: Set<string> }>();
  for (const r of rows) {
    const c = classifyQuery(r.query_text);
    const agg = byCat.get(c) ?? { queries: [], sessions: new Set(), events: 0, top: 0, pos: new Set(), prod: new Set(), linked: new Set() };
    agg.queries.push(r.query_text); agg.events += r.search_events; agg.top = Math.max(agg.top, r.top_session_events);
    for (const s of r.session_ids ?? []) agg.sessions.add(s);
    for (const s of r.positive_session_ids ?? []) agg.pos.add(s);
    for (const s of r.product_session_ids ?? []) agg.prod.add(s);
    for (const s of r.linked_session_ids ?? []) agg.linked.add(s);
    byCat.set(c, agg);
  }
  return [...byCat.entries()].map(([category, a]) => {
    const cat = catalog.get(category) ?? null;
    let bucket: NeedDemand['bucket'] = 'early_interest';
    let bucketReasonAr = 'عينة صغيرة: أقل من 5 متصفحات باحثة';
    if (a.sessions.size >= 5 && category !== 'unparsed') {
      if (cat && cat.fresh72h >= 10) { bucket = 'demand_with_valid_comparison'; bucketReasonAr = `${cat.fresh72h} منتجًا قابلًا للمقارنة برصد خلال 72 ساعة — يحتاج فحص الموديل لكل عرض قبل وعد «أفضل سعر»`; }
      else { bucket = 'demand_needs_coverage_or_identity'; bucketReasonAr = cat ? `المقارنات الحديثة قليلة (${cat.fresh72h} خلال 72 ساعة من ${cat.comparable})` : 'لا توجد قدرة كتالوج مقاسة لهذه الفئة'; }
    } else if (category === 'unparsed') bucketReasonAr = 'نصوص لم يصنفها المحلل — ليست فئة طلب ولا تعني غياب النتائج';
    return {
      category, labelAr: categoryAr(category), queries: a.queries.slice(0, 12), searchSessions: a.sessions.size, searchEvents: a.events, topSessionEvents: a.top,
      positiveSessions: a.pos.size, productSessions: a.prod.size, linkedSessions: a.linked.size, catalog: cat, bucket, bucketReasonAr,
    };
  }).sort((a, b) => b.searchSessions - a.searchSessions || b.searchEvents - a.searchEvents);
}

interface ProductDemandRow { canonical_product_id: string; interactions: number; sessions: number; stores: string[] | null; channels: string[] | null; first_linked_at: string; last_linked_at: string }

export async function fetchProductDemand(w: MetricWindow, limit = 25): Promise<{ ok: true; products: ProductDemand[] } | { ok: false; reason: string }> {
  try {
    const supabase = createServerClient() as unknown as AnyClient;
    const { data, error } = await supabase.rpc('founder_product_demand', { p_start: w.start.toISOString(), p_end: w.end.toISOString() });
    if (error) return { ok: false, reason: error.message };
    const rows = ((data ?? []) as ProductDemandRow[]).map((r) => ({ ...r, interactions: n(r.interactions), sessions: n(r.sessions) }))
      .sort((a, b) => b.sessions - a.sessions || b.interactions - a.interactions).slice(0, limit);
    const ids = rows.map((r) => r.canonical_product_id);
    if (ids.length === 0) return { ok: true, products: [] };
    const [{ data: canon }, { data: proj }, { data: npo }] = await Promise.all([
      supabase.from('canonical_products').select('id, name_ar, name_en, brand, category, model_number').in('id', ids),
      supabase.from('tps_product_projection').select('canonical_id, lowest_price, store_count, has_comparison, last_observed_at, compare_url').in('canonical_id', ids),
      supabase.from('normalized_product_observations').select('canonical_product_id, model_number, store_id').in('canonical_product_id', ids).eq('identity_key_status', 'valid').limit(2000),
    ]);
    const canonMap = new Map(((canon ?? []) as Array<{ id: string; name_ar: string | null; name_en: string | null; brand: string | null; category: string | null; model_number: string | null }>).map((c) => [c.id, c]));
    const projMap = new Map(((proj ?? []) as Array<{ canonical_id: string; lowest_price: number | null; store_count: number | null; has_comparison: boolean | null; last_observed_at: string | null; compare_url: string | null }>).map((p) => [p.canonical_id, p]));
    const models = new Map<string, { models: Set<string>; offers: number }>();
    for (const o of (npo ?? []) as Array<{ canonical_product_id: string; model_number: string | null }>) {
      const m = models.get(o.canonical_product_id) ?? { models: new Set(), offers: 0 };
      m.offers += 1;
      if (o.model_number) m.models.add(o.model_number.trim().toUpperCase());
      models.set(o.canonical_product_id, m);
    }
    const products: ProductDemand[] = rows.map((r) => {
      const c = canonMap.get(r.canonical_product_id);
      const p = projMap.get(r.canonical_product_id);
      const m = models.get(r.canonical_product_id);
      const distinct = m ? [...m.models] : [];
      const mixed = distinct.length > 1;
      const stale = p?.last_observed_at ? Date.now() - new Date(p.last_observed_at).getTime() > 72 * 3600_000 : true;
      const blocker = mixed ? `عروض المجموعة تحمل ${distinct.length} أرقام موديل مختلفة (${distinct.slice(0, 3).join('، ')}) — يلزم تحقق قبل وعد «نفس الموديل»`
        : !p ? 'لا إسقاط حالي لهذا المنتج (غير نشط أو غير مبني)'
        : !p.has_comparison ? 'عرض من متجر واحد — لا مقارنة'
        : stale ? 'آخر رصد أقدم من 72 ساعة' : null;
      return {
        canonicalId: r.canonical_product_id, nameAr: c?.name_ar || c?.name_en || r.canonical_product_id, nameEn: c?.name_en || '', brand: c?.brand ?? null, category: c?.category ?? null, modelNumber: c?.model_number ?? null,
        interactions: r.interactions, sessions: r.sessions,
        stores: (r.stores ?? []).map((s) => retailerDisplayName(s)), channels: r.channels ?? [], firstLinkedAt: r.first_linked_at, lastLinkedAt: r.last_linked_at,
        projection: p ? { lowestPrice: p.lowest_price, storeCount: p.store_count, hasComparison: p.has_comparison, lastObservedAt: p.last_observed_at, compareUrl: p.compare_url } : null,
        identityCheck: m ? { distinctModels: distinct, mixed, offers: m.offers } : null,
        confidenceAr: r.sessions >= 5 ? 'عالية في العد، متوسطة في الاهتمام، منخفضة في الطلب من أشخاص مؤهلين' : 'عينة صغيرة — إشارة أولية',
        blockerAr: blocker,
      };
    });
    return { ok: true, products };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'unknown' }; }
}

export { canonicalAnalyticsCategory };
