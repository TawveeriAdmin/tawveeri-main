// src/app/api/compare/route.ts
// TPS Comparison API — Layer 4 Entry Point
// يقرأ من: canonical_products + product_matches + normalized_product_observations + price_history
// لا يلمس: products, product_stores, search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const canonicalId = searchParams.get('id');
  const identityKey = searchParams.get('key');

  if (!canonicalId && !identityKey) {
    return NextResponse.json(
      { error: 'Provide ?id=<uuid> or ?key=<tps_identity_key>' },
      { status: 400 }
    );
  }

  // ── الخطوة 1: canonical_product ──────────────────────────────
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

  // ── الخطوة 2: product_matches ────────────────────────────────
  const { data: matches, error: pmErr } = await supabase
    .from('product_matches')
    .select('id, raw_observation_id, match_method, confidence, is_verified, matched_at')
    .eq('canonical_product_id', canonical.id);

  if (pmErr || !matches || matches.length === 0) {
    return NextResponse.json({
      canonical,
      summary: { cheapest_store: null, lowest_price: null, highest_price: null, saving: null, store_count: 0 },
      offers: [],
      message: 'No store matches found yet',
    });
  }

  // ── الخطوة 3: observations ───────────────────────────────────
  const obsIds = (matches as any[]).map((m: any) => m.raw_observation_id).filter(Boolean);

  const { data: observations, error: obsErr } = await supabase
    .from('normalized_product_observations')
    .select('id, store_id, raw_name, raw_payload, confidence, identity_key_status')
    .in('id', obsIds);

  if (obsErr || !observations) {
    return NextResponse.json({ error: 'Failed to load observations' }, { status: 500 });
  }

  // ── الخطوة 4: price_history ──────────────────────────────────
  const { data: prices, error: phErr } = await supabase
    .from('price_history')
    .select('store_name, price, availability, observed_at')
    .eq('canonical_product_id', canonical.id)
    .order('observed_at', { ascending: false })
    .limit(50);

  if (phErr) {
    console.error('Failed to load price history:', phErr);
  }

  // أحدث سعر لكل متجر
  const latestPriceByStore: Record<string, { price: number; availability: string | null; observed_at: string }> = {};
  for (const ph of (prices || [])) {
    if (!latestPriceByStore[ph.store_name]) {
      latestPriceByStore[ph.store_name] = {
        price:        ph.price,
        availability: ph.availability,
        observed_at:  ph.observed_at,
      };
    }
  }

  // ── الخطوة 5: بناء offers ────────────────────────────────────
  const matchMap = new Map((matches as any[]).map((m: any) => [m.raw_observation_id, m]));

  const offers = (observations as any[]).map((obs: any) => {
    const match    = matchMap.get(obs.id);
    const raw      = obs.raw_payload || {};
    const priceData = latestPriceByStore[obs.store_id];

    // ── تصحيح السعر: منزلتان عشريتان فقط ──
    const fallbackPrice = raw.current_price
      ? parseFloat(
          parseFloat(String(raw.current_price).replace(/[^0-9.]/g, '')).toFixed(2)
        )
      : null;

    const price = priceData?.price ?? fallbackPrice;

    return {
      store_name:   obs.store_id,
      raw_name:     obs.raw_name,
      price:        price,
      availability: priceData?.availability ?? raw.availability ?? null,
      product_url:  raw.product_url ?? null,
      observed_at:  priceData?.observed_at ?? null,
      match_method: match?.match_method ?? 'rules',
      confidence:   match?.confidence ?? 100,
      is_verified:  match?.is_verified ?? false,
    };
  }).filter((s: any) => s.price && s.price > 0);

  // ── الخطوة 6: summary ────────────────────────────────────────
  const allPrices = offers.map((s: any) => s.price as number).filter((p) => p > 0);
  const lowestPrice  = allPrices.length ? Math.min(...allPrices) : null;
  const highestPrice = allPrices.length ? Math.max(...allPrices) : null;
  const cheapestOffer = offers.find((s: any) => s.price === lowestPrice) ?? null;

  const saving = lowestPrice && highestPrice && highestPrice > lowestPrice
    ? parseFloat((highestPrice - lowestPrice).toFixed(2))
    : null;

  // ── Response ──────────────────────────────────────────────────
  return NextResponse.json({
    canonical: {
      id:                  canonical.id,
      name_ar:             canonical.name_ar,
      name_en:             canonical.name_en,
      brand:               canonical.brand,
      category:            canonical.category,
      tps_identity_key:    canonical.tps_identity_key,
      identity_confidence: canonical.identity_confidence,
      attributes:          canonical.attributes,
    },
    summary: {
      cheapest_store: cheapestOffer?.store_name ?? null,
      lowest_price:   lowestPrice,
      highest_price:  highestPrice,
      saving,
      store_count:    offers.length,
    },
    offers,
  });
}
