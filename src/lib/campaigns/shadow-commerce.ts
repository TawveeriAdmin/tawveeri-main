// src/lib/campaigns/shadow-commerce.ts — Noon Internal Commerce Expansion (founder
// mission, 2026-09-05, §2/§3/§7). "INTERNAL SHADOW COMMERCE": for every real product
// detail view, if Amazon and/or Noon has a real offer, compute what the internal
// commercial tie-break WOULD select and log it. Never changes what a shopper sees, never
// requires a live campaign, never requires Noon branding of any kind — fully decoupled
// from the clause-8.3 promotional-card question (mission §8's explicit separation).
//
// Reuses, never re-derives: getExactProductEvidenceForStore()
// (amazon-evidence.ts, the same real product_stores lookup the live campaign layer uses),
// resolveCommercialTiebreak/classifyShopperEquivalence (commercial-tiebreak.ts, the exact
// same deterministic policy — one tie-break rule, not two), classifyTrafficSource
// (traffic-eligibility.ts).
import { createServerClient } from '@/lib/database';
import { getExactProductEvidenceForStore, AMAZON_STORE_ID, NOON_STORE_ID, type MerchantExactProductEvidence } from './amazon-evidence';
import { resolveCommercialTiebreak, type MerchantOfferSnapshot, type ShopperEquivalenceState } from './commercial-tiebreak';
import { classifyTrafficSource, type AcquisitionCampaign } from './traffic-eligibility';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';
import type { CampaignMerchant } from './types';

export type ProductTruthState = 'ACTIVE' | 'ACTIVE_LOW_CONFIDENCE' | 'INACTIVE';
export type FreshnessState = 'FRESH' | 'STALE' | 'UNKNOWN';
export type CommercialEvidenceState = 'KNOWN' | 'UNKNOWN';

export interface ShadowEvaluationInput {
  productId: string;
  category: string;
  canonicalProductId: string | null;
  isActive: boolean;
  /** 0..100, matches canonical_products.identity_confidence. Null treated conservatively
   *  (ACTIVE_LOW_CONFIDENCE), never assumed high. */
  identityConfidence: number | null;
  amazon: MerchantExactProductEvidence;
  noon: MerchantExactProductEvidence;
  acquisitionCampaign: AcquisitionCampaign | null;
  sessionId?: string | null;
  isTest?: boolean;
}

export interface ShadowEvaluationResult {
  category: string;
  productId: string;
  canonicalProductId: string | null;
  amazonProductUrl: string | null;
  noonProductUrl: string | null;
  amazonPriceSar: number | null;
  noonPriceSar: number | null;
  priceDeltaSar: number | null;
  productTruthState: ProductTruthState;
  freshnessState: FreshnessState;
  shopperEquivalenceState: ShopperEquivalenceState;
  trafficSourceClass: string;
  commercialEvidenceState: CommercialEvidenceState;
  hypotheticalSelectedMerchant: CampaignMerchant | null;
  selectionReason: string;
}

/** Lightweight proxy, NOT the full Trust & Evidence Engine (assessTrust/productTrust,
 *  evidence-engine.ts) — that engine needs several additional inputs (corroboration,
 *  discount integrity, price-verdict confidence) that are expensive to assemble on every
 *  product view. This function answers a narrower, honestly-scoped question: is the
 *  underlying canonical identity active and reasonably confident, for SHADOW logging
 *  purposes only. Never used for customer-facing ranking or trust display. */
export function classifyProductTruthState(isActive: boolean, identityConfidence: number | null): ProductTruthState {
  if (!isActive) return 'INACTIVE';
  if (identityConfidence !== null && identityConfidence >= 70) return 'ACTIVE';
  return 'ACTIVE_LOW_CONFIDENCE';
}

/** Reuses the SAME freshness bar the live campaign card and Pick-label gate use
 *  (PICK_FRESHNESS_MAX_HOURS, evidence-engine.ts) — one authority per question, per this
 *  codebase's own rule, not a new threshold invented for shadow logging. Combines both
 *  merchants conservatively: FRESH only if every offer that EXISTS is fresh; STALE if any
 *  existing offer is stale; UNKNOWN only when neither merchant has any offer at all. */
export function classifyFreshnessState(amazon: MerchantExactProductEvidence, noon: MerchantExactProductEvidence): FreshnessState {
  const hours: number[] = [];
  if (amazon.productUrl && amazon.offerFreshnessHours !== null) hours.push(amazon.offerFreshnessHours);
  if (noon.productUrl && noon.offerFreshnessHours !== null) hours.push(noon.offerFreshnessHours);
  if (hours.length === 0) return 'UNKNOWN';
  return hours.every((h) => h <= PICK_FRESHNESS_MAX_HOURS) ? 'FRESH' : 'STALE';
}

/**
 * Pure — the actual shadow decision, directly unit-testable (no DB access). Returns null
 * when neither merchant has any real offer at all — nothing to learn, nothing logged.
 */
export function evaluateShadowOpportunity(input: ShadowEvaluationInput): ShadowEvaluationResult | null {
  if (!input.amazon.productUrl && !input.noon.productUrl) return null;

  const amazonOffer: MerchantOfferSnapshot = { merchant: 'amazon', priceSar: input.amazon.priceSar, offerFreshnessHours: input.amazon.offerFreshnessHours, inStock: input.amazon.inStock };
  const noonOffer: MerchantOfferSnapshot = { merchant: 'noon', priceSar: input.noon.priceSar, offerFreshnessHours: input.noon.offerFreshnessHours, inStock: input.noon.inStock };
  const decision = resolveCommercialTiebreak(amazonOffer, noonOffer);

  const priceDeltaSar = input.amazon.priceSar !== null && input.noon.priceSar !== null
    ? Math.round((input.amazon.priceSar - input.noon.priceSar) * 100) / 100
    : null;

  // Commercial evidence (real, reported commission) is currently UNKNOWN for every
  // product — no Amazon Associates report has ever been imported (AFFILIATE_RECONCILIATION_
  // CONTRACT.md), and Noon has no live campaign/report access at all. A per-view DB lookup
  // for an answer that is currently invariant would be waste (CLAUDE.md: "don't design for
  // hypothetical future requirements") — this becomes a real per-product lookup the day
  // affiliate_conversions has its first imported row.
  const commercialEvidenceState: CommercialEvidenceState = 'UNKNOWN';

  return {
    category: input.category,
    productId: input.productId,
    canonicalProductId: input.canonicalProductId,
    amazonProductUrl: input.amazon.productUrl,
    noonProductUrl: input.noon.productUrl,
    amazonPriceSar: input.amazon.priceSar,
    noonPriceSar: input.noon.priceSar,
    priceDeltaSar,
    productTruthState: classifyProductTruthState(input.isActive, input.identityConfidence),
    freshnessState: classifyFreshnessState(input.amazon, input.noon),
    shopperEquivalenceState: decision.equivalence,
    trafficSourceClass: classifyTrafficSource(input.acquisitionCampaign, !!input.isTest),
    commercialEvidenceState,
    hypotheticalSelectedMerchant: decision.selectedMerchant,
    selectionReason: decision.reasonCode,
  };
}

/** Fire-and-forget write to shadow_commerce_events (migration 52). Never awaited, never
 *  throws into the caller — matches campaign_tiebreak_events' own logTiebreakEvent()
 *  precedent (commercial-tiebreak.ts) and this route's pre-existing "view tracking must
 *  never break a product page" rule. */
export function logShadowEvent(result: ShadowEvaluationResult, sessionId: string | null | undefined, isTest: boolean): void {
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    supabase
      .from('shadow_commerce_events')
      .insert({
        category: result.category,
        product_id: result.productId,
        canonical_product_id: result.canonicalProductId,
        amazon_product_url: result.amazonProductUrl,
        noon_product_url: result.noonProductUrl,
        amazon_price_sar: result.amazonPriceSar,
        noon_price_sar: result.noonPriceSar,
        price_delta_sar: result.priceDeltaSar,
        product_truth_state: result.productTruthState,
        freshness_state: result.freshnessState,
        shopper_equivalence_state: result.shopperEquivalenceState,
        traffic_source_class: result.trafficSourceClass,
        commercial_evidence_state: result.commercialEvidenceState,
        hypothetical_selected_merchant: result.hypotheticalSelectedMerchant,
        selection_reason: result.selectionReason,
        session_id: sessionId ?? null,
        is_test: !!isTest,
      })
      .then(({ error }: { error: unknown }) => { if (error) console.error('shadow_commerce_events insert failed:', error); });
  } catch { /* measurement must never break the page */ }
}

/**
 * Orchestrator — the one function a route calls. Fetches the product's category/identity/
 * active state, looks up both merchants' real evidence (amazon-evidence.ts, no new
 * queries invented), evaluates, and logs. Best-effort: any failure degrades to a no-op,
 * matching this route's existing view-tracking precedent.
 */
export async function runShadowEvaluationForProductView(
  productId: string,
  acquisitionCampaign: AcquisitionCampaign | null,
  sessionId: string | null | undefined,
  isTest: boolean,
): Promise<void> {
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data: product, error } = await supabase
      .from('products')
      .select('category, canonical_product_id, is_active')
      .eq('id', productId)
      .maybeSingle();
    if (error || !product || !product.category) return;

    let identityConfidence: number | null = null;
    if (product.canonical_product_id) {
      const { data: cp } = await supabase
        .from('canonical_products')
        .select('identity_confidence')
        .eq('id', product.canonical_product_id)
        .maybeSingle();
      identityConfidence = cp?.identity_confidence ?? null;
    }

    if (!product.is_active) return; // "subject to Product Truth and normal quality gates" — mission §1

    const [amazon, noon] = await Promise.all([
      getExactProductEvidenceForStore(productId, AMAZON_STORE_ID),
      getExactProductEvidenceForStore(productId, NOON_STORE_ID),
    ]);

    const result = evaluateShadowOpportunity({
      productId,
      category: product.category,
      canonicalProductId: product.canonical_product_id ?? null,
      isActive: product.is_active,
      identityConfidence,
      amazon,
      noon,
      acquisitionCampaign,
      sessionId,
      isTest,
    });
    if (result) logShadowEvent(result, sessionId, isTest);
  } catch { /* measurement must never break the page */ }
}

export interface ShadowCategorySummary {
  category: string;
  totalEvents: number;
  amazonSelected: number;
  noonSelected: number;
  noSelection: number;
  noonOnly: number;
  amazonOnly: number;
}

export interface ShadowSummary {
  totalEvents: number;
  amazonSelected: number;
  noonSelected: number;
  noSelection: number;
  byCategory: ShadowCategorySummary[];
}

/** Founder dashboard (mission §6/§12) — real logged SHADOW events only (is_test=false),
 *  windowed. Empty (all zeros) is the honest state until the view route has real traffic
 *  with at least one merchant offer present — never fabricated as a projected number,
 *  same precedent as getTiebreakSummary() (commercial-tiebreak.ts). */
export async function getShadowSummary(range: { start: Date; end: Date }): Promise<ShadowSummary> {
  const EMPTY: ShadowSummary = { totalEvents: 0, amazonSelected: 0, noonSelected: 0, noSelection: 0, byCategory: [] };
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data, error } = await supabase
      .from('shadow_commerce_events')
      .select('category, hypothetical_selected_merchant, amazon_product_url, noon_product_url')
      .eq('is_test', false)
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .limit(5000);
    // A migration-not-yet-applied table reads identically to a genuinely empty one — both
    // honestly mean "no shadow event has ever been logged" (same convention as
    // getTiebreakSummary()'s "relation does not exist" handling).
    if (error || !data) return EMPTY;

    const rows: { category: string; hypothetical_selected_merchant: string | null; amazon_product_url: string | null; noon_product_url: string | null }[] = data;
    const byCategory = new Map<string, ShadowCategorySummary>();
    for (const r of rows) {
      const entry = byCategory.get(r.category) ?? { category: r.category, totalEvents: 0, amazonSelected: 0, noonSelected: 0, noSelection: 0, noonOnly: 0, amazonOnly: 0 };
      entry.totalEvents += 1;
      if (r.hypothetical_selected_merchant === 'amazon') entry.amazonSelected += 1;
      else if (r.hypothetical_selected_merchant === 'noon') entry.noonSelected += 1;
      else entry.noSelection += 1;
      if (r.noon_product_url && !r.amazon_product_url) entry.noonOnly += 1;
      if (r.amazon_product_url && !r.noon_product_url) entry.amazonOnly += 1;
      byCategory.set(r.category, entry);
    }

    return {
      totalEvents: rows.length,
      amazonSelected: rows.filter((r) => r.hypothetical_selected_merchant === 'amazon').length,
      noonSelected: rows.filter((r) => r.hypothetical_selected_merchant === 'noon').length,
      noSelection: rows.filter((r) => !r.hypothetical_selected_merchant).length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.totalEvents - a.totalEvents),
    };
  } catch {
    return EMPTY;
  }
}
