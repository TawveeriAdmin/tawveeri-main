// src/app/api/compare/route.ts
// TPS Comparison API — Layer 4 Entry Point
//
// ADR-135 — this route is now derived from the SAME source as the search card.
//
// It used to walk canonical → product_matches → normalized_product_observations and then
// look up a price in a map keyed by `price_history.store_name` ("اكسترا") using
// `normalized_product_observations.store_id` ("4"). Those are two different namespaces:
// 96.3% of observations carry a numeric store id, so the lookup missed, the price fell
// back to `raw_payload.current_price` (null in production), and the offer was dropped.
//
// Consequences measured on production 2026-07-29:
//   • 394 of 431 canonicals where search claims ≥2 stores rendered ZERO offers here.
//   • For apple|iPhone|12|Standard|128 the dropped offer was Extra at 840 — the CHEAPEST —
//     so the card said 840 while this page said 1,099.
//   • `raw_payload.product_url` is null for every observation, so every "visit store"
//     action degraded into a search link.
//
// The fix is not a better join: it is deriving offers exactly the way `searchTPSCanonical`
// does — latest `price_history` row per APPROVED retailer — so the card and this page
// cannot disagree. Store identity is resolved through `resolveApprovedSlug`, which now
// accepts both namespaces. Exit URLs come from `normalized_payload._url` (97.3% coverage,
// and the same field `/go` reads), never from `raw_payload`.
//
// Reads: canonical_products + price_history + normalized_product_observations.
// Touches: nothing. products / product_stores / search are untouched.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';

export const dynamic = 'force-dynamic';

interface PriceRow {
  store_name: string;
  price: number | string;
  availability: string | null;
  observed_at: string;
  tps_observation_id: string | null;
}
interface ObsRow {
  id: string;
  store_id: string | null;
  raw_name: string | null;
  confidence: number | null;
  normalized_payload: { _url?: unknown } | null;
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const canonicalId = searchParams.get('id');
  const identityKey = searchParams.get('key');
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';

  if (!canonicalId && !identityKey) {
    return NextResponse.json({ error: 'Provide ?id=<uuid> or ?key=<tps_identity_key>' }, { status: 400 });
  }

  // ── 1. canonical product ─────────────────────────────────────
  let canonicalQuery = supabase
    .from('canonical_products')
    .select('id, name_ar, name_en, brand, category, tps_identity_key, identity_confidence, is_active, attributes')
    .eq('is_active', true);

  canonicalQuery = canonicalId
    ? canonicalQuery.eq('id', canonicalId)
    : canonicalQuery.eq('tps_identity_key', identityKey!);

  const { data: canonical, error: cpErr } = await canonicalQuery.maybeSingle();
  if (cpErr || !canonical) {
    return NextResponse.json({ error: 'Canonical product not found' }, { status: 404 });
  }

  const empty = {
    canonical,
    summary: { cheapest_store: null, lowest_price: null, highest_price: null, saving: null, store_count: 0 },
    offers: [],
    message: 'No approved-retailer offers for this product yet',
  };

  // ── 2. prices — the SAME derivation the search card uses ─────
  const { data: prices, error: phErr } = await supabase
    .from('price_history')
    .select('store_name, price, availability, observed_at, tps_observation_id')
    .eq('canonical_product_id', canonical.id)
    .order('observed_at', { ascending: false });

  if (phErr) {
    console.error('[compare] price_history failed:', phErr.message);
    return NextResponse.json({ error: 'Failed to load prices' }, { status: 500 });
  }

  // Latest price per APPROVED retailer. Rows are already newest-first, so the first
  // sighting of a slug wins. Non-approved retailers are out of scope (same gate as search).
  const latestBySlug = new Map<string, { price: number; availability: string | null; observed_at: string; obsId: string | null }>();
  for (const row of (prices ?? []) as PriceRow[]) {
    const slug = resolveApprovedSlug(row.store_name);
    if (!slug || latestBySlug.has(slug)) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    latestBySlug.set(slug, {
      price: Math.round(price * 100) / 100,
      availability: row.availability,
      observed_at: row.observed_at,
      obsId: row.tps_observation_id,
    });
  }
  if (latestBySlug.size === 0) return NextResponse.json(empty);

  // ── 3. exit URLs + listing titles, keyed by the SAME slug ────
  const { data: observations } = await supabase
    .from('normalized_product_observations')
    .select('id, store_id, raw_name, confidence, normalized_payload')
    .eq('canonical_product_id', canonical.id);

  const listingBySlug = new Map<string, { url: string | null; rawName: string | null; confidence: number | null; obsId: string }>();
  for (const obs of (observations ?? []) as ObsRow[]) {
    const slug = resolveApprovedSlug(obs.store_id);
    if (!slug || listingBySlug.has(slug)) continue;
    const url = typeof obs.normalized_payload?._url === 'string' ? (obs.normalized_payload._url as string) : null;
    listingBySlug.set(slug, { url, rawName: obs.raw_name, confidence: obs.confidence, obsId: obs.id });
  }

  // ── 4. offers ────────────────────────────────────────────────
  const offers = [...latestBySlug.entries()]
    .map(([slug, p]) => {
      const listing = listingBySlug.get(slug);
      // Prefer the measured /go exit (attributed) and fall back to the observed listing URL.
      const exitId = p.obsId ?? listing?.obsId ?? null;
      return {
        store_slug: slug,
        store_name: retailerDisplayName(slug, locale) ?? slug,
        raw_name: listing?.rawName ?? (locale === 'en' ? canonical.name_en : canonical.name_ar),
        price: p.price,
        availability: p.availability,
        product_url: exitId ? `/go/${exitId}` : listing?.url ?? null,
        observed_at: p.observed_at,
        confidence: listing?.confidence ?? canonical.identity_confidence ?? 100,
        is_verified: !!listing,
      };
    })
    .sort((a, b) => a.price - b.price);

  // ── 5. summary ───────────────────────────────────────────────
  const allPrices = offers.map((o) => o.price);
  const lowestPrice = Math.min(...allPrices);
  const highestPrice = Math.max(...allPrices);
  const saving = highestPrice > lowestPrice ? Math.round((highestPrice - lowestPrice) * 100) / 100 : null;

  return NextResponse.json({
    canonical: {
      id: canonical.id,
      name_ar: canonical.name_ar,
      name_en: canonical.name_en,
      brand: canonical.brand,
      category: canonical.category,
      tps_identity_key: canonical.tps_identity_key,
      identity_confidence: canonical.identity_confidence,
      attributes: canonical.attributes,
    },
    summary: {
      cheapest_store: offers[0]?.store_name ?? null,
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      saving,
      // DISTINCT RETAILERS, not offer rows — a store must never be counted twice (ADR-132).
      store_count: offers.length,
    },
    offers,
  });
}
