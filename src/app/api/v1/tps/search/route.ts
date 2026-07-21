import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tps/search?q=...&limit=20  — Platform API Contract v1 (E11).
 * Returns canonical TPS products with platform-owned fields and, per offer, an
 * authoritative `go_url` (measured exit). Clients (mobile/web) MUST use `go_url`
 * for exits — never construct /go from raw records. Backed by the canonical
 * graph (tps_product_projection + normalized_product_observations + price_history).
 * See docs/API-CONTRACT-v1.md.
 */
function normalizeArabic(s: string): string {
  return (s || '').replace(/[ً-ٰٟ]/g, '').replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '').toLowerCase().trim();
}
const STORE_SLUG: Record<string, string> = { 'اكسترا': 'extra', 'المنيع': 'almanea', 'جرير': 'jarir', 'أمازون': 'amazon', 'نون': 'noon' };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
  const supabase = createServerClient();

  // Canonical search over the projection (owned canonical data; E14 will back this with the owned index).
  let query = supabase
    .from('tps_product_projection')
    .select('canonical_id, tps_identity_key, display_name_ar, display_name_en, brand, category, image_url, lowest_price, highest_price, saving, price_spread_pct, cheapest_store, store_count, has_comparison, compare_url, identity_confidence, updated_at')
    .eq('has_comparison', true)
    .order('store_count', { ascending: false })
    .limit(limit);
  if (q) {
    const terms = normalizeArabic(q).split(/\s+/).filter(Boolean);
    for (const t of terms) query = query.ilike('text_for_search', `%${t}%`);
  }
  const { data: canon, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (canon ?? []).map((c) => c.canonical_id);
  // Offers = normalized observations (offer_id) + latest price per store.
  const offersByCanon = new Map<string, { offer_id: string; store_id: string; store_slug: string; price: number | null; go_url: string; availability: string }[]>();
  if (ids.length) {
    const { data: obs } = await supabase
      .from('normalized_product_observations')
      .select('id, store_id, canonical_product_id, observed_at')
      .in('canonical_product_id', ids)
      .order('observed_at', { ascending: false });
    const { data: prices } = await supabase
      .from('price_history')
      .select('canonical_product_id, store_name, price, observed_at')
      .in('canonical_product_id', ids)
      .order('observed_at', { ascending: false });
    const latestPrice = new Map<string, number>();
    for (const p of prices ?? []) { const k = `${p.canonical_product_id}|${p.store_name}`; if (!latestPrice.has(k)) latestPrice.set(k, Number(p.price)); }
    const seenStore = new Set<string>();
    for (const o of obs ?? []) {
      const key = `${o.canonical_product_id}|${o.store_id}`;
      if (seenStore.has(key)) continue; // one authoritative offer per store
      seenStore.add(key);
      const list = offersByCanon.get(o.canonical_product_id) ?? [];
      list.push({
        offer_id: o.id, store_id: o.store_id, store_slug: STORE_SLUG[o.store_id] ?? o.store_id,
        price: latestPrice.get(key) ?? null, go_url: `/go/${o.id}`, availability: 'in_stock',
      });
      offersByCanon.set(o.canonical_product_id, list);
    }
  }

  const results = (canon ?? []).map((c, i) => ({
    canonical_id: c.canonical_id,
    tps_identity_key: c.tps_identity_key,
    title_ar: c.display_name_ar, title_en: c.display_name_en,
    brand: c.brand, category: c.category, image_url: c.image_url,
    lowest_price: c.lowest_price, highest_price: c.highest_price, saving: c.saving,
    price_spread_pct: c.price_spread_pct, store_count: c.store_count,
    has_comparison: c.has_comparison, confidence: c.identity_confidence,
    canonical_url: c.compare_url, cheapest_store: c.cheapest_store,
    decision: { is_smart_pick: i === 0 && !!c.has_comparison, reason_ar: c.has_comparison ? `متوفر في ${c.store_count} متاجر` : null },
    tps_version: 'tps-v1', updated_at: c.updated_at,
    offers: (offersByCanon.get(c.canonical_id) ?? []).sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9)),
  }));

  return NextResponse.json({ version: 'v1', query: q, count: results.length, results });
}
