// src/lib/intelligence/merchant-twin.ts
// ─────────────────────────────────────────────────────────────────────────────
// Merchant Digital Twin — deterministic per-merchant behavioral signals computed
// ENTIRELY from data Tawveeri already collects (raw_observations, price_history,
// tps_product_projection). No merchant participation required (Merchant
// Independence). See docs/POST-E15-STRATEGY-2026-2040.md §5.8 + ADR-043/044.
//
// This is INTELLIGENCE, not ranking. The module is RANKING-BLIND: it never reads
// or emits affiliate / commission / revenue / go-exit fields. It phrases nothing;
// it only counts what the evidence shows. Unknown beats incorrect — shares are
// null when there is no denominator, never a fabricated 0-of-0 = "good".
//
// `computeMerchantTwin` is PURE: input rows → output object, no DB, no clock
// beyond an injectable `now`. All DB access lives in the route.
// ─────────────────────────────────────────────────────────────────────────────

/** Constitution: corroborate across ≥2 stores before asserting identity/price. */
export const CORROBORATION_MIN = 2;

export const MERCHANT_TWIN_VERSION = 'merchant-twin-v1';

/** One immutable raw observation for this store (from `raw_observations`). */
export interface MerchantObservationRow {
  availability: string | null;
  price: number | null;
  scraped_at?: string | null;
}

/**
 * One canonical product this store carries — one row per distinct
 * `canonical_product_id` linked to the store in `price_history`, enriched with
 * corroboration + category from `tps_product_projection`.
 */
export interface MerchantOfferRow {
  canonical_product_id: string;
  category: string | null;
  /** Total distinct stores on this canonical (projection.store_count). */
  store_count: number | null;
  /** Projection's cheapest store name for this canonical (any alias form). */
  cheapest_store: string | null;
}

/** Fetched, store-scoped input for the pure computation. */
export interface MerchantTwinInput {
  store_id: number;
  store_name: string;
  /** Every name form this store appears under (Arabic / English / slug). */
  store_aliases: string[];
  /** Authoritative total observation count (may exceed `observations.length`). */
  observation_count: number;
  /** Observations sampled for availability/recency signals. */
  observations: MerchantObservationRow[];
  /** One row per canonical product the store carries. */
  offers: MerchantOfferRow[];
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface CategoryCoverage {
  category: string;
  product_count: number;
}

export interface MerchantTwin {
  store_id: number;
  store_name: string;
  generated_at: string;
  version: string;
  /** Explicit invariant marker — this object carries no commercial signal. */
  ranking_blind: true;

  observation_count: number;
  distinct_products: number;

  /** Categories the store carries + distinct-product count each (desc). */
  category_coverage: CategoryCoverage[];

  corroboration: {
    corroborated_products: number;
    /** Share of the store's products that are ≥2-store corroborated (0..1|null). */
    corroborated_share: number | null;
  };

  /**
   * Among CORROBORATED products only (where a cross-store cheapest is meaningful),
   * the share where THIS store holds the lowest price. Never derived from
   * commission — pure price observation.
   */
  price_competitiveness: {
    corroborated_products: number;
    cheapest_count: number;
    cheapest_share: number | null;
  };

  availability: {
    sampled: number;
    in_stock: number;
    out_of_stock: number;
    unknown: number;
    /** Share in-stock among observations with a KNOWN status (0..1|null). */
    in_stock_share: number | null;
    latest_observed_at: string | null;
  };

  /** 0..1 composite of how much signal we actually have for this merchant. */
  data_completeness: number;
  data_completeness_factors: {
    observations: number;
    identity_resolution: number;
    category_coverage: number;
    corroboration: number;
    availability: number;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Arabic-aware normalization (mirrors the search route) for alias matching. */
function normalizeName(s: string | null | undefined): string {
  return (s || '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .toLowerCase()
    .trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── pure computation ─────────────────────────────────────────────────────────

/**
 * Compute the deterministic Merchant Digital Twin from store-scoped rows.
 * Pure: identical input → identical output. No DB, no ambient clock, no ranking.
 */
export function computeMerchantTwin(input: MerchantTwinInput): MerchantTwin {
  const now = input.now ?? new Date();
  const aliasSet = new Set(input.store_aliases.map(normalizeName).filter(Boolean));

  // Deduplicate offers by canonical id (defensive against duplicate price rows).
  const byCanonical = new Map<string, MerchantOfferRow>();
  for (const o of input.offers) {
    if (!o.canonical_product_id) continue;
    if (!byCanonical.has(o.canonical_product_id)) byCanonical.set(o.canonical_product_id, o);
  }
  const offers = Array.from(byCanonical.values());
  const distinct_products = offers.length;

  // Category coverage — distinct products per known category.
  const catCounts = new Map<string, number>();
  let productsWithCategory = 0;
  for (const o of offers) {
    const cat = (o.category || '').trim();
    if (!cat) continue;
    productsWithCategory += 1;
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const category_coverage: CategoryCoverage[] = Array.from(catCounts.entries())
    .map(([category, product_count]) => ({ category, product_count }))
    .sort((a, b) => b.product_count - a.product_count || a.category.localeCompare(b.category));

  // Corroboration — products present on ≥2 stores.
  const corroboratedOffers = offers.filter((o) => (o.store_count ?? 0) >= CORROBORATION_MIN);
  const corroborated_products = corroboratedOffers.length;
  const corroborated_share = distinct_products > 0 ? round2(corroborated_products / distinct_products) : null;

  // Price competitiveness — among corroborated products, is THIS store cheapest?
  let cheapest_count = 0;
  for (const o of corroboratedOffers) {
    if (o.cheapest_store && aliasSet.has(normalizeName(o.cheapest_store))) cheapest_count += 1;
  }
  const cheapest_share = corroborated_products > 0 ? round2(cheapest_count / corroborated_products) : null;

  // Availability — honest over KNOWN statuses only.
  let in_stock = 0;
  let out_of_stock = 0;
  let unknown = 0;
  let latestMs = -Infinity;
  let latest_observed_at: string | null = null;
  for (const obs of input.observations) {
    const a = (obs.availability || '').toLowerCase().trim();
    if (a === 'in_stock') in_stock += 1;
    else if (a === 'out_of_stock') out_of_stock += 1;
    else unknown += 1;
    if (obs.scraped_at) {
      const ms = Date.parse(obs.scraped_at);
      if (Number.isFinite(ms) && ms > latestMs) {
        latestMs = ms;
        latest_observed_at = obs.scraped_at;
      }
    }
  }
  const knownStatus = in_stock + out_of_stock;
  const in_stock_share = knownStatus > 0 ? round2(in_stock / knownStatus) : null;

  // Data completeness — mean of five evidence dimensions (two graded).
  const factors = {
    observations: input.observation_count > 0 ? 1 : 0,
    identity_resolution: distinct_products > 0 ? 1 : 0,
    category_coverage: distinct_products > 0 ? round2(productsWithCategory / distinct_products) : 0,
    corroboration: corroborated_share ?? 0,
    availability: knownStatus > 0 ? 1 : 0,
  };
  const data_completeness = round2(
    (factors.observations +
      factors.identity_resolution +
      factors.category_coverage +
      factors.corroboration +
      factors.availability) /
      5,
  );

  return {
    store_id: input.store_id,
    store_name: input.store_name,
    generated_at: now.toISOString(),
    version: MERCHANT_TWIN_VERSION,
    ranking_blind: true,
    observation_count: input.observation_count,
    distinct_products,
    category_coverage,
    corroboration: { corroborated_products, corroborated_share },
    price_competitiveness: { corroborated_products, cheapest_count, cheapest_share },
    availability: {
      sampled: input.observations.length,
      in_stock,
      out_of_stock,
      unknown,
      in_stock_share,
      latest_observed_at,
    },
    data_completeness,
    data_completeness_factors: factors,
  };
}
