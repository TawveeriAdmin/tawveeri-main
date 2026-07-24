import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { productTrust } from '@/lib/intelligence/evidence-engine';
import { algoliasearch } from 'algoliasearch';
import { normalizeSearchQuery } from '@/lib/search/query-normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALGOLIA_APP = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || process.env.ALGOLIA_APP_ID || '';
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY || '';
const TPS_INDEX = process.env.ALGOLIA_TPS_INDEX || 'tawveeri_tps_products';

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

interface Canon {
  canonical_id: string; tps_identity_key: string;
  display_name_ar: string | null; display_name_en: string | null;
  brand: string | null; category: string | null; image_url: string | null;
  lowest_price: number | null; highest_price: number | null; saving: number | null;
  price_spread_pct: number | null; cheapest_store: string | null;
  store_count: number | null; has_comparison: boolean | null;
  compare_url: string | null; identity_confidence: number | null; updated_at: string | null;
}

function mapHits(res: { hits: unknown[] }): Canon[] {
  return (res.hits as (Record<string, unknown> & { objectID: string })[]).map((h) => ({
    canonical_id: h.objectID, tps_identity_key: (h.tps_identity_key as string) ?? '',
    display_name_ar: (h.display_name_ar as string) ?? null, display_name_en: (h.display_name_en as string) ?? null,
    brand: (h.brand as string) ?? null, category: (h.category as string) ?? null, image_url: (h.image_url as string) ?? null,
    lowest_price: (h.lowest_price as number) ?? null, highest_price: (h.highest_price as number) ?? null, saving: (h.saving as number) ?? null,
    price_spread_pct: (h.price_spread_pct as number) ?? null, cheapest_store: (h.cheapest_store as string) ?? null,
    store_count: (h.store_count as number) ?? null, has_comparison: (h.has_comparison as boolean) ?? null,
    compare_url: (h.compare_url as string) ?? null, identity_confidence: (h.identity_confidence as number) ?? null, updated_at: null,
  }));
}

export async function GET(req: NextRequest) {
  // ADR-064: fold the shopper's query before searching. The raw string used to
  // reach the engine untouched, so Arabic-Indic digits never matched the ASCII
  // digits in the catalogue — "آيفون ١٧ برو ماكس" returned ZERO results while
  // "ايفون 17" worked. Folding only; no word is ever added or dropped.
  const rawQ = (req.nextUrl.searchParams.get('q') || '').trim();
  const q = normalizeSearchQuery(rawQ);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
  const discoveryLimit = Math.min(30, Math.max(0, Number(req.nextUrl.searchParams.get('discovery_limit')) || 12));
  const supabase = createServerClient();

  // E14 HYBRID authority. Layer 1 = corroborated canonicals (comparison). Layer 2
  // = resolved-single canonicals (known identity, one offer, comparison
  // unavailable). Both from the OWNED TPS index; Layer 3 (raw discovery) is served
  // by the existing catalog search. Never a false comparison; catalog never
  // disappears. See docs/E14-HYBRID-SEARCH-DESIGN.md.
  let canon: Canon[] = [];
  let discovery: Canon[] = [];
  if (ALGOLIA_APP && ALGOLIA_SEARCH_KEY) {
    try {
      const client = algoliasearch(ALGOLIA_APP, ALGOLIA_SEARCH_KEY);
      const [l1, l2] = await Promise.all([
        client.searchSingleIndex({ indexName: TPS_INDEX, searchParams: { query: q, hitsPerPage: limit, filters: 'has_comparison:true' } }),
        discoveryLimit > 0 ? client.searchSingleIndex({ indexName: TPS_INDEX, searchParams: { query: q, hitsPerPage: discoveryLimit, filters: 'has_comparison:false' } }) : Promise.resolve({ hits: [] }),
      ]);
      canon = mapHits(l1);
      discovery = mapHits(l2 as { hits: unknown[] });
    } catch (e) { console.error('[v1/tps/search] algolia:', e instanceof Error ? e.message : e); }
  }
  if (!canon.length) {
    const { data } = await supabase
      .from('tps_product_projection')
      .select('canonical_id, tps_identity_key, display_name_ar, display_name_en, brand, category, image_url, lowest_price, highest_price, saving, price_spread_pct, cheapest_store, store_count, has_comparison, compare_url, identity_confidence, updated_at')
      .eq('has_comparison', true).order('store_count', { ascending: false }).limit(limit);
    canon = (data ?? []) as Canon[];
  }

  const ids = [...canon.map((c) => c.canonical_id), ...discovery.map((c) => c.canonical_id)];
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

  const results = canon.map((c, i) => {
    // Evidence-grounded trust (ADR-087) — comparison rows carry cross-store spread too.
    const t = productTrust({ store_count: c.store_count, identity_confidence: c.identity_confidence, has_comparison: c.has_comparison, price_spread_pct: c.price_spread_pct, tps_identity_key: c.tps_identity_key });
    return {
      canonical_id: c.canonical_id,
      tps_identity_key: c.tps_identity_key,
      title_ar: c.display_name_ar, title_en: c.display_name_en,
      brand: c.brand, category: c.category, image_url: c.image_url,
      lowest_price: c.lowest_price, highest_price: c.highest_price, saving: c.saving,
      price_spread_pct: c.price_spread_pct, store_count: c.store_count,
      has_comparison: c.has_comparison, comparison_available: true, confidence: t.score,
      trust: { score: t.score, tier: t.tier, caveats_ar: t.caveats_ar },
      canonical_url: c.compare_url, cheapest_store: c.cheapest_store,
      decision: { is_smart_pick: i === 0 && !!c.has_comparison, reason_ar: c.has_comparison ? `متوفر في ${c.store_count} متاجر` : null },
      tps_version: 'tps-v1', kind: 'canonical', updated_at: c.updated_at,
      offers: (offersByCanon.get(c.canonical_id) ?? []).sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9)),
    };
  });

  // Layer 2 — resolved-single: known identity, one offer, NO comparison claim.
  const canonIds = new Set(canon.map((c) => c.canonical_id));
  const discoveryOut = discovery
    .filter((c) => !canonIds.has(c.canonical_id))
    .map((c) => {
      const t = productTrust({ store_count: c.store_count, identity_confidence: c.identity_confidence, has_comparison: false, tps_identity_key: c.tps_identity_key });
      return {
        canonical_id: c.canonical_id, tps_identity_key: c.tps_identity_key,
        title_ar: c.display_name_ar, title_en: c.display_name_en,
        brand: c.brand, category: c.category, image_url: c.image_url,
        lowest_price: c.lowest_price, store_count: c.store_count,
        has_comparison: false, comparison_available: false, confidence: t.score,
        trust: { score: t.score, tier: t.tier, caveats_ar: t.caveats_ar },
        canonical_url: c.compare_url, cheapest_store: c.cheapest_store,
        decision: { is_smart_pick: false, reason_ar: 'متوفر في متجر واحد · المقارنة غير متاحة' },
        tps_version: 'tps-v1', kind: 'resolved_single',
        offers: (offersByCanon.get(c.canonical_id) ?? []).slice(0, 1),
      };
    });

  return NextResponse.json({
    version: 'v1', query: rawQ, normalized_query: q, count: results.length,
    results,
    discovery: discoveryOut,
    meta: { authority: 'hybrid', canonical_count: results.length, discovery_count: discoveryOut.length },
  });
}
