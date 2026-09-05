// src/lib/campaigns/category-coverage.ts — founder correction #2 (2026-09-05): "Noon must
// not be architecturally limited to TV + laptop." Reads the read-only SQL aggregate
// (migration 51, get_category_coverage_matrix()) so the commerce dashboard can show
// EVERY Tawveeri category's Noon×Amazon comparability, not just categories that already
// have a live affiliate_campaigns row. Observational only — activates nothing.
import { untypedClient } from './store';

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
  /** Founder mission §9 taxonomy — computed here from real evidence, never a fixed list.
   *  Proposal only: it informs founder judgment, it does not gate or activate anything. */
  proposedState: 'ACTIVE_CAPABLE' | 'ELIGIBLE' | 'INITIAL_COHORT' | 'HOLD' | 'INSUFFICIENT_EVIDENCE';
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
}

/** ADR-294's founder-approved initial cohort (TV, laptop) — the only categories with an
 *  actual founder decision behind them. Every other category's state below is THIS
 *  function's own proposal from live evidence, explicitly not a decision. */
const FOUNDER_APPROVED_INITIAL_COHORT = new Set(['tv', 'laptop']);

/** Pure — directly unit-testable, same precedent as this file's sibling deriveXState
 *  functions. Thresholds are deliberately conservative (mission §9: "quality over
 *  quantity," "do not activate categories with weak/no evidence merely for symmetry"). */
export function proposeCategoryState(row: Omit<CategoryCoverageRow, 'proposedState'>): CategoryCoverageRow['proposedState'] {
  if (FOUNDER_APPROVED_INITIAL_COHORT.has(row.category)) return 'INITIAL_COHORT';
  if (row.overlapProducts === 0 || row.demand30d === 0) return 'INSUFFICIENT_EVIDENCE';
  if (row.overlapProducts >= 5 && row.demand30d >= 10) return 'ACTIVE_CAPABLE';
  if (row.overlapProducts >= 2 && row.demand30d >= 1) return 'ELIGIBLE';
  return 'HOLD';
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
    };
    return { ...base, proposedState: proposeCategoryState(base) };
  });
}
