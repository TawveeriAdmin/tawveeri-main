// src/lib/tps/v1-search-helpers.ts
// Pure helpers for GET /api/v1/tps/search — extracted so they're independently unit-testable
// (Next.js route files may only export route handlers / route config, not arbitrary named
// exports) and reusable by other TPS-layer surfaces if needed later.
import { isCampaignEvidenceFresh } from '@/lib/providers/campaigns/blackbox-riyal-festival';

export interface ConditionalOfferEvidence {
  addon_name_ar: string | null; addon_name_en: string | null;
  /** The conditional add-on's OWN price — NEVER the qualifying offer's current_price. */
  addon_price: number | null; addon_regular_price: number | null;
  addon_url: string | null; evidence_type: 'first_party_structured'; last_verified_at: string | null;
  note: string;
}

/**
 * Maps a `raw_observations.payload.specifications.free_gifts[0]` record (see
 * nextjs-ssr-adapter.ts) to API-safe conditional-offer evidence. Pure — no DB/network.
 * HARD INVARIANT (tested): the returned object's `addon_price` must never be readable as,
 * or confused with, the qualifying product's own `current_price` — callers attach this as a
 * SEPARATE `conditional_offer` field on an offer, never merge its price into the offer itself.
 *
 * FRESHNESS (auto-expiry): returns null once `scrapedAt` is older than
 * `CAMPAIGN_FRESHNESS_TTL_HOURS` relative to `now` — no `valid_until` exists anywhere in the
 * retailer's own data, so a conservative TTL stands in for it (see blackbox-riyal-festival.ts).
 * Fails closed: stale evidence simply stops being returned, no manual action required.
 */
export function mapFreeGiftToConditionalOffer(
  payload: { specifications?: { free_gifts?: Array<Record<string, unknown>> } } | null | undefined,
  scrapedAt: string | null,
  now: Date,
): ConditionalOfferEvidence | null {
  const gift = payload?.specifications?.free_gifts?.[0];
  if (!gift) return null;
  if (!isCampaignEvidenceFresh(scrapedAt, now)) return null;
  return {
    addon_name_ar: (gift.name_ar as string) ?? null,
    addon_name_en: (gift.name_en as string) ?? null,
    addon_price: gift.addon_price != null ? Number(gift.addon_price) : null,
    addon_regular_price: gift.addon_regular_price != null ? Number(gift.addon_regular_price) : null,
    addon_url: gift.url ? `https://www.blackbox.com.sa/product/${gift.url}` : null,
    evidence_type: 'first_party_structured',
    last_verified_at: scrapedAt,
    note: "addon_price is the conditional add-on's own price — NEVER this offer's current_price. Purchasing the main offer at current_price may make the add-on available at addon_price; the retailer's own site confirms exact terms.",
  };
}

export interface OfferForSummary { price: number | null; store_slug: string; store_name: string; }
export interface OfferSummary {
  store_count: number; has_comparison: boolean;
  lowest_price: number | null; highest_price: number | null; saving: number | null;
  price_spread_pct: number | null; cheapest_store: string | null;
}

/**
 * Recomputes the comparison summary from an ALREADY DISPLAYABLE-FILTERED offer list — never
 * trust `tps_product_projection`'s store_count/cheapest_store/has_comparison directly, since
 * that projection is built retailer-blind (a display-excluded retailer's offer can be the row
 * that made has_comparison/store_count/cheapest_store true/N/"الصندوق الأسود" at build time —
 * live-verified 2026-08-06 on /ar/compare/haier|single_door|150|standard before this fix).
 * Pure — safe to unit test without a DB.
 */
export function summarizeOffers<T extends OfferForSummary>(offers: T[]): OfferSummary & { sorted: T[] } {
  const priced = offers.filter((o) => o.price != null && o.price > 0);
  const sorted = [...priced].sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9));
  const lowest = sorted[0]?.price ?? null;
  const highest = sorted[sorted.length - 1]?.price ?? null;
  const saving = lowest != null && highest != null && highest > lowest ? Math.round((highest - lowest) * 100) / 100 : null;
  return {
    sorted,
    store_count: sorted.length,
    has_comparison: sorted.length >= 2,
    lowest_price: lowest,
    highest_price: highest,
    saving,
    price_spread_pct: saving != null && highest ? Math.round((saving / highest) * 10000) / 100 : null,
    cheapest_store: sorted[0]?.store_name ?? null,
  };
}
