// src/lib/campaigns/commercial-tiebreak.ts
// Amazon × Noon commercial tie-break policy (2026-09-05, founder mission "Amazon × Noon
// Affiliate Commerce Engine" §6/§7).
//
// SCOPE: this module governs ONLY a measurement/logging question inside the already-
// isolated, non-neutral campaign layer (src/lib/campaigns/*) — which of two
// SHOPPER-EQUIVALENT exact_product campaign offers a founder-facing dashboard should
// attribute a "tie" to. It NEVER decides which product a shopper sees, never reorders
// organic search results, and is never imported by decision-engine.ts / route-query.ts /
// evidence-engine.ts (tests/campaigns/neutrality-structural.test.ts enforces the import
// boundary for that class of file). Constitution Art. VII — "commercial interest never
// enters ranking" — is upheld structurally: getEligibleCampaigns() calls this module only
// to LOG a hypothetical tie-break outcome; it does not change which campaign cards render
// (both an Amazon and a Noon exact_product card can and do still render independently).
//
// SHOPPER VALUE FIRST, COMMERCIAL TIE-BREAK SECOND (the founder's own ordering): a genuine
// price difference — however small the founder's chosen "material" threshold turns out to
// be — always wins on its own; commercial economics may only decide between two offers
// this function has independently classified as SHOPPER_EQUIVALENT.
import { createServerClient } from '@/lib/database';
import type { CampaignMerchant } from './types';

export type ShopperEquivalenceState = 'SHOPPER_EQUIVALENT' | 'SHOPPER_NEAR_EQUIVALENT' | 'NOT_EQUIVALENT' | 'UNKNOWN';

export interface MerchantOfferSnapshot {
  merchant: CampaignMerchant;
  priceSar: number | null;
  offerFreshnessHours: number | null;
  inStock: boolean;
  /** Known commission opportunity for this merchant/category, in SAR per expected
   *  conversion — NEVER an invented conversion probability (mission §16: "if conversion
   *  evidence is too sparse, do NOT invent probabilities"). Null when no commission rate
   *  is on file for this merchant/category; a null value can never win a tie-break. */
  expectedCommissionSar?: number | null;
}

/** A price difference at or below this is treated as immaterial — small enough that
 *  commission can never plausibly be compensating for a real shopper disadvantage.
 *  max(10 SAR, 1% of the lower price) — deliberately conservative and disclosed, not
 *  tuned to make any particular merchant win more often. Founder-adjustable if evidence
 *  later shows a different bar is more appropriate; not wired to an env var in V1 because
 *  no real tie has ever been observed yet to calibrate against (see the mission's own
 *  EXPLORE → LOG → MEASURE → LEARN → DEPLOY sequencing, §8). */
export function materialPriceDifferenceThresholdSar(lowerPrice: number): number {
  return Math.max(10, lowerPrice * 0.01);
}

/**
 * Classify whether two merchant offers for the SAME already-resolved canonical product are
 * shopper-equivalent. Pure, deterministic, never guesses: any missing/ambiguous field that
 * would be needed to prove equivalence returns UNKNOWN, never SHOPPER_EQUIVALENT.
 */
export function classifyShopperEquivalence(a: MerchantOfferSnapshot, b: MerchantOfferSnapshot): ShopperEquivalenceState {
  if (!a.inStock || !b.inStock) return 'NOT_EQUIVALENT'; // no offer to send a shopper to is never "equivalent" to one that exists
  if (a.priceSar === null || b.priceSar === null) return 'UNKNOWN'; // cannot compare price at all — never assume a tie
  if (a.priceSar === b.priceSar) return 'SHOPPER_EQUIVALENT';
  const lower = Math.min(a.priceSar, b.priceSar);
  const diff = Math.abs(a.priceSar - b.priceSar);
  if (diff <= materialPriceDifferenceThresholdSar(lower)) return 'SHOPPER_NEAR_EQUIVALENT';
  return 'NOT_EQUIVALENT';
}

export type TiebreakReasonCode =
  | 'LOWEST_TOTAL_PRICE'
  | 'BETTER_AVAILABILITY'
  | 'AFFILIATE_ONLY_TIEBREAK'
  | 'EXPECTED_VALUE_TIEBREAK'
  | 'INSUFFICIENT_EQUIVALENCE'
  | 'UNKNOWN';

export interface TiebreakDecision {
  selectedMerchant: CampaignMerchant | null;
  reasonCode: TiebreakReasonCode;
  equivalence: ShopperEquivalenceState;
}

/**
 * The deterministic tie-break policy itself (mission §7). Shopper value always decides
 * first: a real (NOT_EQUIVALENT) price gap picks the cheaper merchant outright, with a
 * reason code that says so plainly — never "affiliate tiebreak" for a real price
 * difference. Commercial economics is consulted ONLY when the two offers are already
 * SHOPPER_EQUIVALENT (identical price) or SHOPPER_NEAR_EQUIVALENT (within the immaterial
 * threshold above) AND a known commission figure exists for both sides to compare.
 */
export function resolveCommercialTiebreak(a: MerchantOfferSnapshot, b: MerchantOfferSnapshot): TiebreakDecision {
  const equivalence = classifyShopperEquivalence(a, b);

  // Availability is checked BEFORE any price/commission comparison — an out-of-stock
  // offer is never a real alternative, regardless of how good its price or commission
  // looks on paper. This must come first, or a price-only comparison below could still
  // "select" a merchant with nothing to sell (found by the module's own test suite).
  if (!a.inStock || !b.inStock) {
    if (a.inStock && !b.inStock) return { selectedMerchant: a.merchant, reasonCode: 'BETTER_AVAILABILITY', equivalence };
    if (b.inStock && !a.inStock) return { selectedMerchant: b.merchant, reasonCode: 'BETTER_AVAILABILITY', equivalence };
    return { selectedMerchant: null, reasonCode: 'INSUFFICIENT_EQUIVALENCE', equivalence }; // both out of stock
  }

  if (equivalence === 'NOT_EQUIVALENT') {
    if (a.priceSar !== null && b.priceSar !== null) {
      const cheaper = a.priceSar <= b.priceSar ? a : b;
      return { selectedMerchant: cheaper.merchant, reasonCode: 'LOWEST_TOTAL_PRICE', equivalence };
    }
    return { selectedMerchant: null, reasonCode: 'INSUFFICIENT_EQUIVALENCE', equivalence };
  }

  if (equivalence === 'UNKNOWN') {
    return { selectedMerchant: null, reasonCode: 'INSUFFICIENT_EQUIVALENCE', equivalence };
  }

  // SHOPPER_EQUIVALENT or SHOPPER_NEAR_EQUIVALENT: shopper value is tied (or close enough
  // that the founder has authorized treating it as tied) — commercial value MAY break it.
  const aCommission = a.expectedCommissionSar ?? null;
  const bCommission = b.expectedCommissionSar ?? null;
  if (aCommission !== null && bCommission !== null && aCommission !== bCommission) {
    const winner = aCommission > bCommission ? a : b;
    return { selectedMerchant: winner.merchant, reasonCode: 'AFFILIATE_ONLY_TIEBREAK', equivalence };
  }
  // No commercial signal to break a genuine tie with — stays neutral rather than guessing.
  return { selectedMerchant: null, reasonCode: 'UNKNOWN', equivalence };
}

export interface TiebreakLogInput {
  canonicalProductId: string;
  category: string;
  sessionId?: string | null;
  isTest?: boolean;
  amazon: { priceSar: number | null; offerFreshnessHours: number | null; inStock: boolean; expectedCommissionSar?: number | null };
  noon: { priceSar: number | null; offerFreshnessHours: number | null; inStock: boolean; expectedCommissionSar?: number | null };
}

/** Fire-and-forget write to campaign_tiebreak_events (migration 50) — SERVER-side
 *  decision-grade evidence for the founder's "Commercial Tie-Breaks" dashboard section
 *  (mission §11D). Never awaited by the caller, never throws into it — a logging failure
 *  must never affect which cards render. */
export function logTiebreakEvent(input: TiebreakLogInput): void {
  try {
    const amazonOffer: MerchantOfferSnapshot = { merchant: 'amazon', ...input.amazon };
    const noonOffer: MerchantOfferSnapshot = { merchant: 'noon', ...input.noon };
    const decision = resolveCommercialTiebreak(amazonOffer, noonOffer);
    const priceDiffSar = input.amazon.priceSar !== null && input.noon.priceSar !== null
      ? Math.round((input.amazon.priceSar - input.noon.priceSar) * 100) / 100
      : null;

    // Same untyped-client escape hatch as store.ts's untypedClient() (campaign_tiebreak_events
    // is a new table, migration 50, not yet in the generated Database type).
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    supabase
      .from('campaign_tiebreak_events')
      .insert({
        canonical_product_id: input.canonicalProductId,
        category: input.category,
        session_id: input.sessionId ?? null,
        is_test: !!input.isTest,
        amazon_price_sar: input.amazon.priceSar,
        noon_price_sar: input.noon.priceSar,
        price_diff_sar: priceDiffSar,
        equivalence_state: decision.equivalence,
        selected_merchant: decision.selectedMerchant,
        reason_code: decision.reasonCode,
      })
      .then(({ error }: { error: unknown }) => { if (error) console.error('campaign_tiebreak_events insert failed:', error); });
  } catch { /* measurement must never break the page */ }
}

export interface TiebreakEventRow {
  createdAt: string;
  category: string;
  amazonPriceSar: number | null;
  noonPriceSar: number | null;
  priceDiffSar: number | null;
  equivalenceState: ShopperEquivalenceState;
  selectedMerchant: CampaignMerchant | null;
  reasonCode: string;
}

export interface TiebreakSummary {
  totalEvents: number;
  amazonSelected: number;
  noonSelected: number;
  noSelection: number;
  events: TiebreakEventRow[];
}

/** Founder dashboard §11D ("Commercial Tie-Breaks") — reads real logged events, never
 *  a simulated/projected count. Empty (all zeros) is the honest state until Noon's
 *  exact_product routing is both enabled (NOON_EXACT_PRODUCT_ENABLED=1) and a real
 *  request happens to match an Amazon exact_product offer for the same product. */
export async function getTiebreakSummary(range: { start: Date; end: Date }): Promise<TiebreakSummary> {
  const EMPTY: TiebreakSummary = { totalEvents: 0, amazonSelected: 0, noonSelected: 0, noSelection: 0, events: [] };
  let rows: any[] = [];
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data, error } = await supabase
      .from('campaign_tiebreak_events')
      .select('created_at, category, amazon_price_sar, noon_price_sar, price_diff_sar, equivalence_state, selected_merchant, reason_code')
      .eq('is_test', false)
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);
    // Never throws the page: a migration-not-yet-applied table ("relation does not
    // exist") is exactly as honest a "0 events" state as a genuinely empty table — both
    // mean "no tie-break has ever been logged," which is what the caller should render.
    if (error || !data) return EMPTY;
    rows = data;
  } catch {
    return EMPTY;
  }
  return {
    totalEvents: rows.length,
    amazonSelected: rows.filter((r) => r.selected_merchant === 'amazon').length,
    noonSelected: rows.filter((r) => r.selected_merchant === 'noon').length,
    noSelection: rows.filter((r) => !r.selected_merchant).length,
    events: rows.map((r) => ({
      createdAt: r.created_at,
      category: r.category,
      amazonPriceSar: r.amazon_price_sar,
      noonPriceSar: r.noon_price_sar,
      priceDiffSar: r.price_diff_sar,
      equivalenceState: r.equivalence_state,
      selectedMerchant: r.selected_merchant,
      reasonCode: r.reason_code,
    })),
  };
}
