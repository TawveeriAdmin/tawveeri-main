// src/lib/campaigns/shadow-commerce.ts — Amazon × Noon internal commerce (founder
// mission, 2026-09-05, §2/§3/§7/§8). "INTERNAL SHADOW COMMERCE": for every real product
// detail view, if Amazon and/or Noon has a real offer, compute what the internal
// commercial tie-break WOULD select and log it. Never changes what a shopper sees, never
// requires a live campaign, never requires Noon branding of any kind — fully decoupled
// from the clause-8.3 promotional-card question.
//
// Reuses, never re-derives: resolveCommercialTiebreak/classifyShopperEquivalence
// (commercial-tiebreak.ts, the exact same deterministic policy — one tie-break rule, not
// two), classifyCondition (condition.ts, ADR-287's extractSpecsFromTitle underneath),
// looksLikeCategoryMismatch (product-type-guard.ts, ADR-243's isAccessoryTitle
// underneath), classifyTrafficSource (traffic-eligibility.ts).
//
// Evidence fetching (2026-09-05 "RENEWED IS NOT NEW" mission): does NOT reuse
// amazon-evidence.ts's getExactProductEvidenceForStore(). That function is proven correct
// for the LIVE Amazon Decision Layer's own use (a single caller-supplied products.id), but
// a live data audit this session found a real, previously-undiscovered limitation: a
// comparable canonical product's Amazon and Noon offers commonly live on TWO SEPARATE
// `products` rows sharing one canonical_product_id, each with its own title (confirmed:
// canonical `144885ef-213d-4ce8-b69b-4032d8ec2d2e`'s Noon offer is on products.id
// `ab63d453-...`, its Amazon offer on a DIFFERENT row `f9b1beca-...`) — looking within a
// single supplied products.id, as the existing function does, silently misses the OTHER
// merchant's evidence in exactly this common case. Deliberately NOT changed in
// amazon-evidence.ts itself: that function backs the already-live, already-tested Amazon
// Decision Layer, and mission's own "Amazon must not regress" rules out touching it here.
// getMerchantOfferEvidenceForCanonical() below is a separate, correct implementation,
// used only by this module.
import { createServerClient } from '@/lib/database';
import { hoursSince } from '@/lib/intelligence/evidence-engine';
import { resolveCommercialTiebreak, type MerchantOfferSnapshot, type ShopperEquivalenceState } from './commercial-tiebreak';
import { classifyCondition, type MerchantCondition } from './condition';
import { looksLikeCategoryMismatch } from './product-type-guard';
import { classifyTrafficSource, type AcquisitionCampaign } from './traffic-eligibility';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';
import type { CampaignMerchant } from './types';

export type ProductTruthState = 'ACTIVE' | 'ACTIVE_LOW_CONFIDENCE' | 'INACTIVE';
export type FreshnessState = 'FRESH' | 'STALE' | 'UNKNOWN';
export type CommercialEvidenceState = 'KNOWN' | 'UNKNOWN';

const AMAZON_STORE_ID = '2'; // verified against stores table, 2026-09-05 (same as amazon-evidence.ts)
const NOON_STORE_ID = '3';

export interface MerchantOfferEvidence {
  title: string | null;
  productUrl: string | null;
  priceSar: number | null;
  offerFreshnessHours: number | null;
  inStock: boolean;
}

const EMPTY_OFFER: MerchantOfferEvidence = { title: null, productUrl: null, priceSar: null, offerFreshnessHours: null, inStock: false };

/**
 * Correct evidence lookup for a canonical product's offer at a given store — see this
 * file's header for why amazon-evidence.ts's getExactProductEvidenceForStore() is not
 * reused here. Traverses canonical_product_id -> every `products` row sharing it -> that
 * row's own `product_stores` children -> the ones matching `storeId`, picking the
 * FRESHEST when more than one exists (duplicate/near-duplicate scrape rows were found to
 * be real in production, e.g. two Amazon rows for the same product at different prices).
 * Never throws — a lookup failure degrades to EMPTY_OFFER, the same safe-fallback
 * convention getExactProductEvidenceForStore() itself uses.
 */
export async function getMerchantOfferEvidenceForCanonical(
  canonicalProductId: string | null,
  storeId: string,
): Promise<MerchantOfferEvidence> {
  if (!canonicalProductId) return EMPTY_OFFER;
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data: rows, error } = await supabase
      .from('products')
      .select('name_en, product_stores(current_price, availability, product_url, last_checked_at, last_scraped_at, store_id)')
      .eq('canonical_product_id', canonicalProductId);
    if (error || !rows) return EMPTY_OFFER;

    type Candidate = { title: string | null; price: number | null; availability: string | null; url: string | null; observedAt: string | null };
    const candidates: Candidate[] = [];
    for (const p of rows as { name_en: string | null; product_stores: Record<string, unknown>[] | null }[]) {
      for (const ps of p.product_stores ?? []) {
        if (String(ps.store_id) !== storeId) continue;
        const priceRaw = ps.current_price;
        candidates.push({
          title: p.name_en ?? null,
          price: typeof priceRaw === 'number' ? priceRaw : priceRaw != null ? Number(priceRaw) : null,
          availability: (ps.availability as string | null) ?? null,
          url: (ps.product_url as string | null) ?? null,
          observedAt: (ps.last_scraped_at as string | null) ?? (ps.last_checked_at as string | null) ?? null,
        });
      }
    }
    if (candidates.length === 0) return EMPTY_OFFER;
    candidates.sort((a, b) => new Date(b.observedAt ?? 0).getTime() - new Date(a.observedAt ?? 0).getTime());
    const best = candidates[0];
    if (!best.url) return EMPTY_OFFER;
    return {
      title: best.title,
      productUrl: best.url,
      priceSar: best.price,
      offerFreshnessHours: hoursSince(best.observedAt),
      inStock: best.availability === 'in_stock' || best.availability === 'limited_stock',
    };
  } catch {
    return EMPTY_OFFER;
  }
}

export interface ShadowEvaluationInput {
  productId: string;
  category: string;
  canonicalProductId: string | null;
  isActive: boolean;
  /** 0..100, matches canonical_products.identity_confidence. Null treated conservatively
   *  (ACTIVE_LOW_CONFIDENCE), never assumed high. */
  identityConfidence: number | null;
  amazon: MerchantOfferEvidence;
  noon: MerchantOfferEvidence;
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
  amazonCondition: MerchantCondition | null;
  noonCondition: MerchantCondition | null;
  categoryMismatch: boolean;
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
export function classifyFreshnessState(amazon: MerchantOfferEvidence, noon: MerchantOfferEvidence): FreshnessState {
  const hours: number[] = [];
  if (amazon.productUrl && amazon.offerFreshnessHours !== null) hours.push(amazon.offerFreshnessHours);
  if (noon.productUrl && noon.offerFreshnessHours !== null) hours.push(noon.offerFreshnessHours);
  if (hours.length === 0) return 'UNKNOWN';
  return hours.every((h) => h <= PICK_FRESHNESS_MAX_HOURS) ? 'FRESH' : 'STALE';
}

/**
 * Pure — the actual shadow decision, directly unit-testable (no DB access). Returns null
 * when neither merchant has any real offer at all — nothing to learn, nothing logged.
 *
 * Gate order (2026-09-05 mission §3): identity/variant (upstream — this function receives
 * an already-resolved canonical product) -> category/product-type sanity (checked here,
 * FIRST, before condition or price ever run) -> condition truth + availability + price
 * (all inside resolveCommercialTiebreak, which now enforces the condition gate — see
 * commercial-tiebreak.ts) -> commercial tie-break. A category-type mismatch on EITHER
 * side short-circuits with no tie-break evaluated at all — the offers are not even
 * comparable, so a price/condition-based decision would be meaningless.
 */
export function evaluateShadowOpportunity(input: ShadowEvaluationInput): ShadowEvaluationResult | null {
  if (!input.amazon.productUrl && !input.noon.productUrl) return null;

  const amazonMismatch = looksLikeCategoryMismatch(input.amazon.title, input.category);
  const noonMismatch = looksLikeCategoryMismatch(input.noon.title, input.category);
  const categoryMismatch = amazonMismatch || noonMismatch;

  const amazonCondition = input.amazon.productUrl ? classifyCondition(input.amazon.title) : null;
  const noonCondition = input.noon.productUrl ? classifyCondition(input.noon.title) : null;

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

  let shopperEquivalenceState: ShopperEquivalenceState;
  let hypotheticalSelectedMerchant: CampaignMerchant | null;
  let selectionReason: string;

  if (categoryMismatch) {
    // Fail closed for COMMERCIAL EQUIVALENCE only (mission §4) — never evaluated, never a
    // guessed winner. This does not touch search/display/ranking, which never call this
    // function at all.
    shopperEquivalenceState = 'UNKNOWN';
    hypotheticalSelectedMerchant = null;
    selectionReason = 'CATEGORY_MISMATCH';
  } else {
    const amazonOffer: MerchantOfferSnapshot = {
      merchant: 'amazon', priceSar: input.amazon.priceSar, offerFreshnessHours: input.amazon.offerFreshnessHours,
      inStock: input.amazon.inStock, condition: amazonCondition ?? undefined,
    };
    const noonOffer: MerchantOfferSnapshot = {
      merchant: 'noon', priceSar: input.noon.priceSar, offerFreshnessHours: input.noon.offerFreshnessHours,
      inStock: input.noon.inStock, condition: noonCondition ?? undefined,
    };
    const decision = resolveCommercialTiebreak(amazonOffer, noonOffer);
    shopperEquivalenceState = decision.equivalence;
    hypotheticalSelectedMerchant = decision.selectedMerchant;
    selectionReason = decision.reasonCode;
  }

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
    shopperEquivalenceState,
    trafficSourceClass: classifyTrafficSource(input.acquisitionCampaign, !!input.isTest),
    commercialEvidenceState,
    amazonCondition,
    noonCondition,
    categoryMismatch,
    hypotheticalSelectedMerchant,
    selectionReason,
  };
}

/** Fire-and-forget write to shadow_commerce_events (migration 52/56). Never awaited, never
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
        amazon_condition: result.amazonCondition,
        noon_condition: result.noonCondition,
        category_mismatch: result.categoryMismatch,
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
 * active state, looks up both merchants' real evidence via canonical_product_id (see this
 * file's header for why), evaluates, and logs. Best-effort: any failure degrades to a
 * no-op, matching this route's existing view-tracking precedent.
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
      .select('canonical_product_id, is_active')
      .eq('id', productId)
      .maybeSingle();
    if (error || !product || !product.canonical_product_id) return;

    // Truth check (founder-directed, 2026-09-05): `products.category` (the legacy
    // storefront layer) is NOT an alias of `canonical_products.category` — it is a
    // genuinely different, coarser taxonomy (proven: products.category has no 'mobile'
    // value at all, only 'smartphone'/'appliance'/'kitchen'/etc.). Read
    // canonical_products.category directly — the one true "canonical analytics category"
    // for this codebase. A product with no canonical_product_id (already returned above)
    // or no resolvable canonical row is skipped entirely rather than falling back to the
    // legacy taxonomy.
    const { data: cp } = await supabase
      .from('canonical_products')
      .select('category, identity_confidence')
      .eq('id', product.canonical_product_id)
      .maybeSingle();
    if (!cp || !cp.category) return;
    const identityConfidence: number | null = cp.identity_confidence ?? null;

    if (!product.is_active) return; // "subject to Product Truth and normal quality gates" — mission §1

    const [amazon, noon] = await Promise.all([
      getMerchantOfferEvidenceForCanonical(product.canonical_product_id, AMAZON_STORE_ID),
      getMerchantOfferEvidenceForCanonical(product.canonical_product_id, NOON_STORE_ID),
    ]);

    const result = evaluateShadowOpportunity({
      productId,
      category: cp.category,
      canonicalProductId: product.canonical_product_id,
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
  conditionBlocked: number;
  categoryBlocked: number;
  noonOnly: number;
  amazonOnly: number;
}

export interface ShadowSummary {
  totalEvents: number;
  amazonSelected: number;
  noonSelected: number;
  noSelection: number;
  conditionBlocked: number;
  categoryBlocked: number;
  byCategory: ShadowCategorySummary[];
}

/** Founder dashboard (mission §6/§11/§12) — real logged SHADOW events only (is_test=false),
 *  windowed. Empty (all zeros) is the honest state until the view route has real traffic
 *  with at least one merchant offer present — never fabricated as a projected number,
 *  same precedent as getTiebreakSummary() (commercial-tiebreak.ts). */
export async function getShadowSummary(range: { start: Date; end: Date }): Promise<ShadowSummary> {
  const EMPTY: ShadowSummary = { totalEvents: 0, amazonSelected: 0, noonSelected: 0, noSelection: 0, conditionBlocked: 0, categoryBlocked: 0, byCategory: [] };
  try {
    const supabase = createServerClient() as unknown as { from: (table: string) => any };
    const { data, error } = await supabase
      .from('shadow_commerce_events')
      .select('category, hypothetical_selected_merchant, amazon_product_url, noon_product_url, selection_reason, category_mismatch')
      .eq('is_test', false)
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .limit(5000);
    // A migration-not-yet-applied table reads identically to a genuinely empty one — both
    // honestly mean "no shadow event has ever been logged" (same convention as
    // getTiebreakSummary()'s "relation does not exist" handling).
    if (error || !data) return EMPTY;

    const rows: { category: string; hypothetical_selected_merchant: string | null; amazon_product_url: string | null; noon_product_url: string | null; selection_reason: string | null; category_mismatch: boolean | null }[] = data;
    const isConditionBlocked = (r: (typeof rows)[number]) => r.selection_reason === 'CONDITION_MISMATCH' || r.selection_reason === 'CONDITION_UNKNOWN';
    const isCategoryBlocked = (r: (typeof rows)[number]) => !!r.category_mismatch || r.selection_reason === 'CATEGORY_MISMATCH';

    const byCategory = new Map<string, ShadowCategorySummary>();
    for (const r of rows) {
      const entry = byCategory.get(r.category) ?? { category: r.category, totalEvents: 0, amazonSelected: 0, noonSelected: 0, noSelection: 0, conditionBlocked: 0, categoryBlocked: 0, noonOnly: 0, amazonOnly: 0 };
      entry.totalEvents += 1;
      if (r.hypothetical_selected_merchant === 'amazon') entry.amazonSelected += 1;
      else if (r.hypothetical_selected_merchant === 'noon') entry.noonSelected += 1;
      else entry.noSelection += 1;
      if (isConditionBlocked(r)) entry.conditionBlocked += 1;
      if (isCategoryBlocked(r)) entry.categoryBlocked += 1;
      if (r.noon_product_url && !r.amazon_product_url) entry.noonOnly += 1;
      if (r.amazon_product_url && !r.noon_product_url) entry.amazonOnly += 1;
      byCategory.set(r.category, entry);
    }

    return {
      totalEvents: rows.length,
      amazonSelected: rows.filter((r) => r.hypothetical_selected_merchant === 'amazon').length,
      noonSelected: rows.filter((r) => r.hypothetical_selected_merchant === 'noon').length,
      noSelection: rows.filter((r) => !r.hypothetical_selected_merchant).length,
      conditionBlocked: rows.filter(isConditionBlocked).length,
      categoryBlocked: rows.filter(isCategoryBlocked).length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.totalEvents - a.totalEvents),
    };
  } catch {
    return EMPTY;
  }
}
