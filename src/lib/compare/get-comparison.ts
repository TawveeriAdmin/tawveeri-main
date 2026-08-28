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
import { resolveApprovedSlug, retailerDisplayName, isDisplayableRetailer } from '@/lib/retailers/approved-retailers';
import { displayedObservedAt } from '@/lib/intelligence/observed-freshness';
import { STALE_CAVEAT_HOURS, isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { deriveCampaignEligibility, type CampaignEligibilityEvidence } from '@/lib/providers/campaigns/blackbox-riyal-festival';

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
  observed_at: string | null;
  normalized_payload: { _url?: unknown } | null;
}

// ADR-194 follow-up: price_history is append-only on CHANGED prices, so an offer whose
// price is stable reads days-stale while the pipeline re-observes it daily. A pair's
// newest normalized observation is that re-observation — a LATER, genuine event, so it
// composes with (not through) displayedObservedAt's earliest-wins rule, which guards
// signals describing the SAME event. Only rows after the 2026-07-31 provenance fix count:
// older npo stamps carry processing time and could overstate freshness — the exact harm
// observed-freshness.ts exists to prevent.
const NPO_PROVENANCE_TRUSTED_FROM = Date.parse('2026-07-31T00:00:00Z');

export interface CompareOffer {
  store_slug: string;
  store_name: string;
  raw_name: string;
  price: number;
  availability: string | null;
  product_url: string | null;
  observed_at: string;
  /** True when this offer's evidence is older than STALE_CAVEAT_HOURS — see the
   *  computation site for why this exists (P0, 2026-08-07). */
  stale: boolean;
  confidence: number;
  is_verified: boolean;
  /** Level-2 conditional-campaign evidence (e.g. Black Box's "مهرجان الريال") — never a
   *  price claim, TTL-gated, null once stale or absent. See blackbox-riyal-festival.ts. */
  campaign_eligibility: CampaignEligibilityEvidence | null;
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
    /** True when the offer backing `cheapest_store`/`lowest_price` is stale (see
     *  CompareOffer.stale) — a surface must disclose this before letting a customer
     *  act on "cheapest" as if it were freshly verified (P0, 2026-08-07). */
    cheapest_stale: boolean;
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
    summary: { cheapest_store: null, lowest_price: null, highest_price: null, saving: null, store_count: 0, cheapest_stale: false },
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

  // ADR-196: offers measured GONE (404 on their own page) are excluded from the
  // comparison — a dead offer must not win best-price. Signals heal on the next
  // successful observation of the pair.
  const { data: delistRows } = await supabase
    .from('tps_offer_delist_signals')
    .select('store_slug')
    .eq('canonical_product_id', canonical.id);
  const delistedSlugs = new Set((delistRows ?? []).map((d) => (d as { store_slug: string }).store_slug));

  // Latest price per DISPLAYABLE retailer. Rows are already newest-first, so the first
  // sighting of a slug wins. `isDisplayableRetailer`, not `resolveApprovedSlug` alone: a
  // store can be approved for INGESTION (raw_observations flows, normalize sweeps it) while
  // still being display-excluded (F3 — lulu/sharafdg/blackbox as of 2026-08-06). Before this
  // fix this function used `resolveApprovedSlug` only, so any display-excluded retailer's
  // price_history row rendered on the compare page the moment it reached price_history —
  // reproduced live: blackbox (899 SAR) shown on /ar/compare/haier|single_door|150|standard
  // hours after ingestion, despite being in COMPARISON_DISPLAY_EXCLUDED. Fixed here and in
  // `searchTPSCanonical` (src/app/api/search/route.ts) — the two surfaces ADR-135 requires
  // to derive from the same source now actually share the same gate.
  const latestBySlug = new Map<string, { price: number; availability: string | null; observed_at: string; obsId: string | null }>();
  for (const row of (prices ?? []) as unknown as PriceRow[]) {
    const slug = resolveApprovedSlug(row.store_name);
    if (!slug || !isDisplayableRetailer(slug) || latestBySlug.has(slug) || delistedSlugs.has(slug)) continue;
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
    .select('id, store_id, raw_name, confidence, observed_at, normalized_payload')
    .eq('canonical_product_id', canonical.id);

  const listingBySlug = new Map<string, { url: string | null; rawName: string | null; confidence: number | null; obsId: string }>();
  // PROVENANCE INDEX (Principle 7). `normalized_payload._raw_id` points back at the
  // raw_observation that produced this offer, and that row carries the TRUE observation time.
  const rawIdByObsId = new Map<string, number>();
  // ADR-194: newest trusted re-observation per retailer (see NPO_PROVENANCE_TRUSTED_FROM).
  const reobservedBySlug = new Map<string, string>();
  // Newest raw_id per retailer, by observed_at — DELIBERATELY independent of
  // `price_history.tps_observation_id` (which only advances when the PRICE changes). Evidence
  // like `campaign_eligibility` can appear on a fresh re-observation with an unchanged price —
  // reproduced live 2026-08-06: a Black Box fridge's price_history row still pointed at an
  // observation from BEFORE campaign tagging, hours after a newer, campaign-tagged
  // re-observation existed, because the price hadn't moved. Non-price evidence must track the
  // truly latest observation, not the latest price change.
  const newestRawIdBySlug = new Map<string, { t: number; rawId: number }>();
  for (const obs of (observations ?? []) as unknown as ObsRow[]) {
    const rawId = Number((obs.normalized_payload as Record<string, unknown> | null)?._raw_id);
    if (Number.isFinite(rawId)) rawIdByObsId.set(obs.id, rawId);
    const slug = resolveApprovedSlug(obs.store_id);
    if (!slug || !isDisplayableRetailer(slug)) continue;
    const t = obs.observed_at ? Date.parse(obs.observed_at) : NaN;
    if (Number.isFinite(t) && t >= NPO_PROVENANCE_TRUSTED_FROM) {
      const prev = reobservedBySlug.get(slug);
      if (!prev || t > Date.parse(prev)) reobservedBySlug.set(slug, obs.observed_at!);
    }
    if (Number.isFinite(t) && Number.isFinite(rawId)) {
      const prev = newestRawIdBySlug.get(slug);
      if (!prev || t > prev.t) newestRawIdBySlug.set(slug, { t, rawId });
    }
    if (listingBySlug.has(slug)) continue;
    const url = typeof obs.normalized_payload?._url === 'string' ? (obs.normalized_payload._url as string) : null;
    listingBySlug.set(slug, { url, rawName: obs.raw_name, confidence: obs.confidence, obsId: obs.id });
  }

  // Resolve the true observation time for the offers we are about to render. Read-only, one
  // indexed lookup, bounded by the number of retailers on this product. If it fails we simply
  // have no provenance and the stored stamp stands — never an estimate.
  //
  // The SAME row also carries `payload.specifications.campaign_eligibility` (e.g. Black Box's
  // "مهرجان الريال" — see nextjs-ssr-adapter.ts / blackbox-riyal-festival.ts) — read here at
  // no extra query cost and TTL-gated below, so a stale campaign flag silently stops showing
  // without any manual action (2026-08-06, ADR-220).
  const scrapedAtByRawId = new Map<number, string>();
  const campaignByRawId = new Map<number, CampaignEligibilityEvidence>();
  {
    const priceLinkedRawIds = [...latestBySlug.values()]
      .map((p) => (p.obsId ? rawIdByObsId.get(p.obsId) : undefined))
      .filter((v): v is number => Number.isFinite(v as number));
    // Union with the truly-newest-per-retailer raw_ids (see newestRawIdBySlug above) — the
    // two sets overlap whenever the price is also the latest thing that changed, and diverge
    // exactly when non-price evidence (like campaign tagging) is newer than the last price move.
    const newestRawIds = [...newestRawIdBySlug.values()].map((v) => v.rawId);
    const rawIds = [...new Set([...priceLinkedRawIds, ...newestRawIds])];
    if (rawIds.length) {
      // `raw_observations.id` is a bigint, which the generated types surface as string, so the
      // typed builder rejects a number[]. Narrow loose view rather than reaching for `any`.
      const db = supabase as unknown as {
        from(t: string): { select(c: string): { in(col: string, vals: unknown[]): Promise<{ data: unknown }> } };
      };
      const now = new Date();
      const { data: raws } = await db.from('raw_observations').select('id, scraped_at, payload').in('id', rawIds);
      for (const r of (raws ?? []) as { id: number | string; scraped_at: string | null; payload: { specifications?: { campaign_eligibility?: { campaign_category_id?: number } } } }[]) {
        if (r.scraped_at) scrapedAtByRawId.set(Number(r.id), r.scraped_at);
        const eligibility = deriveCampaignEligibility(r.payload?.specifications?.campaign_eligibility, r.scraped_at, now);
        if (eligibility) campaignByRawId.set(Number(r.id), eligibility);
      }
    }
  }

  // ── 4. offers ────────────────────────────────────────────────
  const offers: CompareOffer[] = [...latestBySlug.entries()]
    .map(([slug, p]) => {
      const listing = listingBySlug.get(slug);
      // Prefer the measured /go exit (attributed) and fall back to the observed listing URL.
      const exitId = p.obsId ?? listing?.obsId ?? null;
      // FRESHNESS, two rules composed:
      // 1. For the PRICE-CHANGE event: the oldest verified provenance signal, never the
      //    newest (observed-freshness.ts — signals describing the same event).
      // 2. ADR-194: a LATER trusted re-observation of the pair (price unchanged by
      //    construction — no newer price row exists) supersedes it: «رصدناه قبل X» must
      //    state when we last SAW the offer, not when its price last moved.
      const observedAt = (() => {
        const changeEvent = displayedObservedAt({
          stampedAt: p.observed_at,
          provenanceAt: (() => {
            const rawId = p.obsId ? rawIdByObsId.get(p.obsId) : undefined;
            return rawId != null ? scrapedAtByRawId.get(rawId) ?? null : null;
          })(),
        }) ?? p.observed_at;
        const reobserved = reobservedBySlug.get(slug);
        return reobserved && Date.parse(reobserved) > Date.parse(changeEvent) ? reobserved : changeEvent;
      })();
      return {
        store_slug: slug,
        store_name: retailerDisplayName(slug, locale) ?? slug,
        raw_name: listing?.rawName ?? (locale === 'en' ? canonical.name_en : canonical.name_ar),
        price: p.price,
        availability: p.availability,
        product_url: exitId ? `/go/${exitId}` : listing?.url ?? null,
        observed_at: observedAt,
        // P0 stale-price safety (2026-08-07): "current price" must never be presented as
        // freshly verified when it isn't. Reuses evidence-engine's single caveat threshold
        // (STALE_CAVEAT_HOURS) rather than inventing a second one — one authority per
        // question. Disclosure, not exclusion or reordering: a slow-cadence store's real
        // last-known price is still a real price, so it still competes for "cheapest" — the
        // page must say so plainly when that offer wins, not silently present it as current.
        stale: (Date.now() - Date.parse(observedAt)) / 3_600_000 > STALE_CAVEAT_HOURS,
        confidence: listing?.confidence ?? canonical.identity_confidence ?? 100,
        is_verified: !!listing,
        // Keyed off the truly-newest observation for this retailer (newestRawIdBySlug), NOT
        // the price-linked one — see the comment above newestRawIdBySlug for why they diverge.
        campaign_eligibility: (() => {
          const rawId = newestRawIdBySlug.get(slug)?.rawId;
          return rawId != null ? campaignByRawId.get(rawId) ?? null : null;
        })(),
      };
    })
    .sort((a, b) => a.price - b.price);

  // ── 5. summary ───────────────────────────────────────────────
  const { summary, message } = deriveComparisonSummary(offers);
  return { canonical: canonicalOut, summary, offers, ...(message ? { message } : {}) };
}

/**
 * Pure, directly-testable derivation of the comparison summary from an already-built
 * offer list — the SAME extraction pattern `summarizeOffers` (v1-search-helpers.ts)
 * already established for this codebase. Quality program P0 (2026-08-27, §11/§12 —
 * stale-cheapest-store fix): each offer already carries `observed_at`/`stale` (the
 * ADR-194-correct TRUE observation time, composing the price-change event with any
 * later trusted re-observation) — reused here as the SAME eligibility test the
 * projection and search route apply, not a re-derived one. `offers`/`store_count` stay
 * the FULL known set (never deleted, ADR-132 dedup unchanged, per-offer `stale`
 * disclosure untouched) — only the CHEAPEST/best-price claim requires fresh
 * (<=168h) backing. This supersedes the 2026-08-07 "disclosure, not exclusion" note on
 * `CompareOffer.stale`: the founder has now approved exclusion from the CHEAPEST claim
 * specifically (the softer 72h `stale` caveat on every individual offer is unchanged).
 */
export function deriveComparisonSummary(offers: CompareOffer[]): {
  summary: ComparisonResult["summary"];
  message?: string;
} {
  // Sorted defensively rather than trusting the caller's ordering (the SAME discipline
  // summarizeOffers in v1-search-helpers.ts already applies) — this is a standalone,
  // independently-testable function now.
  const freshOffers = offers.filter((o) => isFreshObservation(o.observed_at)).sort((a, b) => a.price - b.price);
  const noFreshEvidence = offers.length > 0 && freshOffers.length === 0;

  const cheapest = freshOffers[0] ?? null;
  const freshPrices = freshOffers.map((o) => o.price);
  const lowestPrice = freshPrices.length ? Math.min(...freshPrices) : null;
  const highestPrice = freshPrices.length ? Math.max(...freshPrices) : null;
  const saving = lowestPrice != null && highestPrice != null && highestPrice > lowestPrice
    ? Math.round((highestPrice - lowestPrice) * 100) / 100 : null;

  return {
    summary: {
      cheapest_store: cheapest?.store_name ?? null,
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      saving,
      // DISTINCT RETAILERS, not offer rows — a store must never be counted twice (ADR-132).
      store_count: offers.length,
      cheapest_stale: cheapest?.stale ?? false,
    },
    ...(noFreshEvidence
      ? { message: 'لا تتوفر مقارنة أسعار محدثة حالياً — كل الأسعار المتوفرة أقدم من أسبوع' }
      : {}),
  };
}

export function isComparisonError(v: ComparisonResult | ComparisonError): v is ComparisonError {
  return (v as ComparisonError).error !== undefined;
}
