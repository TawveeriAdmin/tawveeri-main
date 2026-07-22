import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/database';
import {
  computeMerchantTwin,
  type MerchantObservationRow,
  type MerchantOfferRow,
} from '@/lib/intelligence/merchant-twin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/intelligence/merchant/[storeId] — Merchant Digital Twin (§5.8).
 *
 * Deterministic per-merchant behavioral signals computed from data Tawveeri
 * already collects (raw_observations, price_history, tps_product_projection).
 * No merchant participation (Merchant Independence). RANKING-BLIND: reads/emits
 * no affiliate / commission / revenue. See docs/POST-E15-STRATEGY-2026-2040.md.
 *
 * Supported stores: 1=Jarir, 2=Amazon, 4=Extra, 5=Almanea.
 */

// Store identity map. `aliases` = every name form the store appears under in
// raw_observations.store_name / price_history.store_name / projection.cheapest_store.
const STORES: Record<number, { name: string; aliases: string[] }> = {
  1: { name: 'Jarir', aliases: ['jarir', 'جرير'] },
  2: { name: 'Amazon', aliases: ['amazon', 'أمازون'] },
  4: { name: 'Extra', aliases: ['extra', 'اكسترا'] },
  5: { name: 'Almanea', aliases: ['almanea', 'المنيع'] },
};

const OBSERVATION_SAMPLE = 3000; // recent observations sampled for availability
const PRICE_PAGE = 1000; // price_history pagination page size
const PRICE_MAX_ROWS = 60000; // safety cap on price_history scan
const PROJECTION_BATCH = 300; // .in() batch size for projection lookups

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId: storeIdRaw } = await params;
  const storeId = Number(storeIdRaw);
  const store = STORES[storeId];
  if (!store) {
    return NextResponse.json(
      { error: 'unsupported_store', message: 'storeId must be one of 1 (Jarir), 2 (Amazon), 4 (Extra), 5 (Almanea).' },
      { status: 400 },
    );
  }

  // These tables/columns (raw_observations, price_history.canonical_product_id,
  // tps_product_projection) predate the generated Database types — query through
  // an untyped client view, consistent with the other v1 routes.
  const supabase = createServerClient() as unknown as SupabaseClient;
  const aliasFilter = store.aliases.map((a) => `"${a}"`).join(',');

  // 1) Authoritative observation count (head-only, no rows transferred).
  const { count: observationCount } = await supabase
    .from('raw_observations')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);

  // 2) Observation sample for availability + recency signals.
  const { data: obsRows } = await supabase
    .from('raw_observations')
    .select('availability, price, scraped_at')
    .eq('store_id', storeId)
    .order('scraped_at', { ascending: false })
    .limit(OBSERVATION_SAMPLE);

  const observations: MerchantObservationRow[] = (obsRows ?? []).map((r) => ({
    availability: r.availability ?? null,
    price: r.price != null ? Number(r.price) : null,
    scraped_at: r.scraped_at ?? null,
  }));

  // 3) Distinct canonical products this store carries. price_history store
  //    linkage is messy — some rows carry store_id, others only store_name, and
  //    unresolved rows have a null canonical — so match store_id OR store_name
  //    aliases AND require a resolved canonical. Paginate up to the cap.
  const canonicalIds = new Set<string>();
  for (let from = 0; from < PRICE_MAX_ROWS; from += PRICE_PAGE) {
    const { data: page, error } = await supabase
      .from('price_history')
      .select('canonical_product_id')
      .or(`store_id.eq.${storeId},store_name.in.(${aliasFilter})`)
      .not('canonical_product_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PRICE_PAGE - 1);
    if (error) {
      return NextResponse.json({ error: 'price_history_query_failed', message: error.message }, { status: 500 });
    }
    for (const r of page ?? []) if (r.canonical_product_id) canonicalIds.add(r.canonical_product_id as string);
    if (!page || page.length < PRICE_PAGE) break;
  }

  // 4) Enrich each canonical with corroboration + category + cheapest store from
  //    the projection (the single corroboration/category authority).
  const ids = [...canonicalIds];
  const offers: MerchantOfferRow[] = [];
  for (let i = 0; i < ids.length; i += PROJECTION_BATCH) {
    const batch = ids.slice(i, i + PROJECTION_BATCH);
    const { data: proj } = await supabase
      .from('tps_product_projection')
      .select('canonical_id, category, store_count, cheapest_store')
      .in('canonical_id', batch);
    for (const p of proj ?? []) {
      offers.push({
        canonical_product_id: p.canonical_id as string,
        category: (p.category as string) ?? null,
        store_count: p.store_count != null ? Number(p.store_count) : null,
        cheapest_store: (p.cheapest_store as string) ?? null,
      });
    }
  }

  const twin = computeMerchantTwin({
    store_id: storeId,
    store_name: store.name,
    store_aliases: store.aliases,
    observation_count: observationCount ?? 0,
    observations,
    offers,
  });

  return NextResponse.json(twin);
}
