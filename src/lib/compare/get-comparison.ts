// src/lib/compare/get-comparison.ts
//
// THE comparison derivation — one function, called by both the API route and the page.
//
// ADR-135 established the rule: the compare page must be derived from the SAME source as
// the search card, so the two can never disagree. This file is where that derivation
// lives. `/api/compare` is a thin HTTP wrapper over it.
//
// WHY IT WAS EXTRACTED (measured 2026-07-29): the compare PAGE used to fetch
// `${SITE_URL}/api/compare` over the public internet — a server-to-server round trip out
// of Railway and back in through our own edge. That request passes through the rate
// limiter like any other, and every server-side render shares ONE egress identity. Under
// load the page's own fetch got HTTP 429, `fetchCompare` returned null, and the page
// rendered "لا تتوفر مقارنة" — telling the customer no comparison exists for a product we
// have two live offers for. Reproduced: 34 rapid calls to /api/compare → 429, while the
// data was present the whole time.
//
// That is the founder's original complaint reached by a third road: after the broken join
// key (ADR-135) and the Smart Pick's unbacked claim (ADR-136), a rate limit was silently
// converting "we have it" into "we don't". A page that reads its own database does not
// have that failure mode at all.
//
// Reads: canonical_products + price_history + normalized_product_observations.
// Touches: nothing.

import { createServerClient } from '@/lib/database';
import { resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';
import { displayedObservedAt } from '@/lib/intelligence/observed-freshness';

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

export interface CompareOffer {
  store_slug: string;
  store_name: string;
  raw_name: string;
  price: number;
  availability: string | null;
  product_url: string | null;
  observed_at: string;
  confidence: number;
  is_verified: boolean;
}

export interface ComparisonResult {
  canonical: {
    id: string;
    name_ar: string;
    name_en: string;
    brand: string;
    category: string;
    tps_identity_key: string;
    identity_confidence: number;
    attributes: Record<string, unknown>;
  };
  summary: {
    cheapest_store: string | null;
    lowest_price: number | null;
    highest_price: number | null;
    saving: number | null;
    store_count: number;
  };
  offers: CompareOffer[];
  message?: string;
}

export type ComparisonError = { error: string; status: number };

export async function getComparison(params: {
  canonicalId?: string | null;
  identityKey?: string | null;
  locale?: 'ar' | 'en';
}): Promise<ComparisonResult | ComparisonError> {
  const { canonicalId, identityKey } = params;
  const locale = params.locale === 'en' ? 'en' : 'ar';

  if (!canonicalId && !identityKey) {
    return { error: 'Provide ?id=<uuid> or ?key=<tps_identity_key>', status: 400 };
  }

  const supabase = createServerClient();

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
    return { error: 'Canonical product not found', status: 404 };
  }

  const canonicalOut = {
    id: canonical.id,
    name_ar: canonical.name_ar,
    name_en: canonical.name_en,
    brand: canonical.brand,
    category: canonical.category,
    tps_identity_key: canonical.tps_identity_key,
    identity_confidence: canonical.identity_confidence,
    attributes: canonical.attributes,
  };

  const empty: ComparisonResult = {
    canonical: canonicalOut,
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
    return { error: 'Failed to load prices', status: 500 };
  }

  // Latest price per APPROVED retailer. Rows are already newest-first, so the first
  // sighting of a slug wins. Non-approved retailers are out of scope (same gate as search).
  const latestBySlug = new Map<string, { price: number; availability: string | null; observed_at: string; obsId: string | null }>();
  for (const row of (prices ?? []) as unknown as PriceRow[]) {
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
  if (latestBySlug.size === 0) return empty;

  // ── 3. exit URLs + listing titles, keyed by the SAME slug ────
  const { data: observations } = await supabase
    .from('normalized_product_observations')
    .select('id, store_id, raw_name, confidence, normalized_payload')
    .eq('canonical_product_id', canonical.id);

  const listingBySlug = new Map<string, { url: string | null; rawName: string | null; confidence: number | null; obsId: string }>();
  // PROVENANCE INDEX (Principle 7). `normalized_payload._raw_id` points back at the
  // raw_observation that produced this offer, and that row carries the TRUE observation time.
  const rawIdByObsId = new Map<string, number>();
  for (const obs of (observations ?? []) as unknown as ObsRow[]) {
    const rawId = Number((obs.normalized_payload as Record<string, unknown> | null)?._raw_id);
    if (Number.isFinite(rawId)) rawIdByObsId.set(obs.id, rawId);
    const slug = resolveApprovedSlug(obs.store_id);
    if (!slug || listingBySlug.has(slug)) continue;
    const url = typeof obs.normalized_payload?._url === 'string' ? (obs.normalized_payload._url as string) : null;
    listingBySlug.set(slug, { url, rawName: obs.raw_name, confidence: obs.confidence, obsId: obs.id });
  }

  // Resolve the true observation time for the offers we are about to render. Read-only, one
  // indexed lookup, bounded by the number of retailers on this product. If it fails we simply
  // have no provenance and the stored stamp stands — never an estimate.
  const scrapedAtByRawId = new Map<number, string>();
  {
    const rawIds = [...latestBySlug.values()]
      .map((p) => (p.obsId ? rawIdByObsId.get(p.obsId) : undefined))
      .filter((v): v is number => Number.isFinite(v as number));
    if (rawIds.length) {
      // `raw_observations.id` is a bigint, which the generated types surface as string, so the
      // typed builder rejects a number[]. Narrow loose view rather than reaching for `any`.
      const db = supabase as unknown as {
        from(t: string): { select(c: string): { in(col: string, vals: unknown[]): Promise<{ data: unknown }> } };
      };
      const { data: raws } = await db.from('raw_observations').select('id, scraped_at').in('id', rawIds);
      for (const r of (raws ?? []) as { id: number | string; scraped_at: string | null }[]) {
        if (r.scraped_at) scrapedAtByRawId.set(Number(r.id), r.scraped_at);
      }
    }
  }

  // ── 4. offers ────────────────────────────────────────────────
  const offers: CompareOffer[] = [...latestBySlug.entries()]
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
        // FRESHNESS: the oldest verified provenance signal, never the newest. See
        // src/lib/intelligence/observed-freshness.ts for the rule and the measurement behind
        // it. Falls back to the stored stamp when provenance does not resolve — the display
        // can only ever become MORE conservative, never fresher.
        observed_at:
          displayedObservedAt({
            stampedAt: p.observed_at,
            provenanceAt: (() => {
              const rawId = p.obsId ? rawIdByObsId.get(p.obsId) : undefined;
              return rawId != null ? scrapedAtByRawId.get(rawId) ?? null : null;
            })(),
          }) ?? p.observed_at,
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

  return {
    canonical: canonicalOut,
    summary: {
      cheapest_store: offers[0]?.store_name ?? null,
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      saving,
      // DISTINCT RETAILERS, not offer rows — a store must never be counted twice (ADR-132).
      store_count: offers.length,
    },
    offers,
  };
}

export function isComparisonError(v: ComparisonResult | ComparisonError): v is ComparisonError {
  return (v as ComparisonError).error !== undefined;
}
