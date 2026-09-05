// src/lib/campaigns/category-coverage.ts — founder correction #2 (2026-09-05): "Noon must
// not be architecturally limited to TV + laptop." Reads the read-only SQL aggregate
// (migration 51, get_category_coverage_matrix()) so the commerce dashboard can show
// EVERY Tawveeri category's Noon×Amazon comparability, not just categories that already
// have a live affiliate_campaigns row. Observational only — activates nothing.
import { untypedClient } from './store';

/** Noon Internal Commerce Expansion (2026-09-05, §5) taxonomy — replaces the first
 *  pass's ACTIVE_CAPABLE/ELIGIBLE/INITIAL_COHORT/HOLD set with the founder's explicit
 *  re-specification. A proposal for founder judgment only; never activates or gates
 *  anything by itself. */
export type CategoryStrength = 'NOON_STRONG' | 'AMAZON_STRONG' | 'BALANCED' | 'NOON_ONLY_OPPORTUNITY' | 'AMAZON_ONLY_OPPORTUNITY' | 'INSUFFICIENT_EVIDENCE';

export interface CategoryCoverageRow {
  category: string;
  activeProducts: number;
  noonOfferProducts: number;
  validNoonOffers: number;
  freshNoonOffers: number;
  validAmazonOffers: number;
  overlapProducts: number;
  noonOnlyProducts: number;
  amazonOnlyProducts: number;
  demand30d: number;
  explicitInteractions30d: number;
  noonCheaperProducts: number;
  amazonCheaperProducts: number;
  tiedProducts: number;
  /** Overlap products within commercial-tiebreak.ts's own near-equivalence threshold
   *  (max(10 SAR, 1% of lower price)) — a STRICT SUPERSET of tiedProducts (exact-price
   *  ties only). The number that actually matters for "how often would a real tie-break
   *  even be triggered," since resolveCommercialTiebreak() only consults commercial value
   *  at SHOPPER_EQUIVALENT/SHOPPER_NEAR_EQUIVALENT, not merely exact ties. */
  shopperEquivalentProducts: number;
  strength: CategoryStrength;
}

interface RawCoverageRow {
  category: string;
  active_products: number | string;
  noon_offer_products: number | string;
  valid_noon_offers: number | string;
  fresh_noon_offers: number | string;
  valid_amazon_offers: number | string;
  overlap_products: number | string;
  noon_only_products: number | string;
  amazon_only_products: number | string;
  demand_30d: number | string;
  explicit_interactions_30d: number | string;
  noon_cheaper_products: number | string;
  amazon_cheaper_products: number | string;
  tied_products: number | string;
  shopper_equivalent_products: number | string;
}

/** Minimum real evidence required before claiming NOON_STRONG/AMAZON_STRONG/BALANCED —
 *  a disclosed, founder-adjustable judgment call (this codebase's own convention: no
 *  official evidence bar exists yet to calibrate against, so the bar is deliberately
 *  conservative rather than invented-precise). Below this, INSUFFICIENT_EVIDENCE — never
 *  forced into a comparative claim on a thin sample (mission §5: "do not force symmetry"). */
const CATEGORY_OVERLAP_MIN = 2;
const CATEGORY_DEMAND_MIN = 5;

/**
 * Pure — directly unit-testable. Mission §5's explicit taxonomy, computed only from real
 * evidence: no fixed category list, no founder-approved-cohort special case (unlike the
 * first pass's INITIAL_COHORT — the founder explicitly asked TV/laptop not be treated as
 * the permanent scope, so this taxonomy makes no exception for them; ADR-294/295 record
 * their actual decision status in prose, not in this classifier).
 */
export function classifyCategoryStrength(row: Omit<CategoryCoverageRow, 'strength'>): CategoryStrength {
  const hasNoon = row.validNoonOffers > 0;
  const hasAmazon = row.validAmazonOffers > 0;

  if (row.overlapProducts === 0) {
    if (hasNoon && !hasAmazon && row.demand30d > 0) return 'NOON_ONLY_OPPORTUNITY';
    if (hasAmazon && !hasNoon && row.demand30d > 0) return 'AMAZON_ONLY_OPPORTUNITY';
    return 'INSUFFICIENT_EVIDENCE';
  }
  if (row.overlapProducts < CATEGORY_OVERLAP_MIN || row.demand30d < CATEGORY_DEMAND_MIN) return 'INSUFFICIENT_EVIDENCE';
  if (row.noonCheaperProducts > row.amazonCheaperProducts) return 'NOON_STRONG';
  if (row.amazonCheaperProducts > row.noonCheaperProducts) return 'AMAZON_STRONG';
  return 'BALANCED';
}

function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : parseInt(v, 10) || 0;
}

/** One row per canonical_products category (all 28+, not merely categories with a live
 *  campaign) — the dashboard-wide fix for the "accidental two-category boundary." */
export async function getCategoryCoverageMatrix(): Promise<CategoryCoverageRow[]> {
  // untypedClient()'s own declared shape only exposes `.from()` (see its doc comment in
  // store.ts) — this is the one campaign-layer caller that needs `.rpc()` (migration 51's
  // read-only aggregate function), so the wider shape is cast locally rather than loosening
  // the shared helper's type for every other caller.
  const supabase = untypedClient() as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> };
  const { data, error } = await supabase.rpc('get_category_coverage_matrix');
  if (error || !data) return [];
  return (data as RawCoverageRow[]).map((r) => {
    const base = {
      category: r.category,
      activeProducts: toNumber(r.active_products),
      noonOfferProducts: toNumber(r.noon_offer_products),
      validNoonOffers: toNumber(r.valid_noon_offers),
      freshNoonOffers: toNumber(r.fresh_noon_offers),
      validAmazonOffers: toNumber(r.valid_amazon_offers),
      overlapProducts: toNumber(r.overlap_products),
      noonOnlyProducts: toNumber(r.noon_only_products),
      amazonOnlyProducts: toNumber(r.amazon_only_products),
      demand30d: toNumber(r.demand_30d),
      explicitInteractions30d: toNumber(r.explicit_interactions_30d),
      noonCheaperProducts: toNumber(r.noon_cheaper_products),
      amazonCheaperProducts: toNumber(r.amazon_cheaper_products),
      tiedProducts: toNumber(r.tied_products),
      shopperEquivalentProducts: toNumber(r.shopper_equivalent_products),
    };
    return { ...base, strength: classifyCategoryStrength(base) };
  });
}
