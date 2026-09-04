// src/lib/campaigns/destination-resolver.ts
// Amazon Decision Layer V2 (2026-09-04) §2/§4 — resolveAmazonDestination().
//
// A pure, fail-closed router with three real modes, in preference order:
//   EXACT_PRODUCT  — only when Tawveeri's own canonical identity is confident AND a
//                     fresh, matched Amazon offer exists for that exact product AND no
//                     safety flag (accessory leakage, condition/storage/model mismatch,
//                     open quality incident) is set. Routes to the ALREADY-KNOWN Amazon
//                     product URL from Tawveeri's own scraped product_stores row (the
//                     same URL /go already sends organic traffic to) — never fabricates
//                     a product page. Price is never surfaced by this resolver: the §1C
//                     compliance audit (Amazon Decision Layer V2 final report) found
//                     Tawveeri's Amazon price/availability comes from web scraping, not
//                     PA-API, so `allowPriceDisplay` is hardcoded false regardless of
//                     evidence confidence — this resolver only ever hands back a
//                     destination URL, never a price to render next to it.
//   MODEL_SEARCH   — brand/model recognized (from an already-sanitized token, never raw
//                    user text) but not trustworthy enough for EXACT_PRODUCT. Appends a
//                    sanitized `k=` search term to the category's own live campaign
//                    destination — never a bare, unscoped Amazon search.
//   CATEGORY       — the plain, already-verified live category destination. The
//                    fail-closed default: every gate below falls through to this (or to
//                    'unavailable') rather than ever guessing.
//
// STRUCTURALLY SCOPED TO THE LIVE PORTFOLIO ONLY (§5): this function never hardcodes a
// category → destination mapping. The caller passes `liveCategoryCampaigns`, a map the
// caller builds from `enabled = true` rows only — so air_fryer/vacuum/blender (disabled)
// or any future category cannot reach this resolver's CATEGORY/MODEL_SEARCH branches
// without a separate, explicit founder activation of that category's campaign row first.
//
// NOT YET WIRED into src/lib/campaigns/store.ts's getEligibleCampaigns() — the live
// serving path remains CATEGORY-only via the existing, already-verified mechanism
// (destination_url stamped straight from the campaign row). This file is a tested,
// ready-to-wire utility, deliberately not forced into the live request path in the same
// pass as its own review, per the founder's "do NOT change the current live campaign
// portfolio" instruction.

export type DestinationMode = 'exact_product' | 'model_search' | 'category';

export interface LiveCategoryDestination {
  destinationUrl: string;
  trackingId: string | null;
}

export interface AmazonDestinationRequest {
  /** Storefront category (toStorefrontCategory() output), or null if unresolved. */
  category: string | null;
  /** Raw shopper query text — used ONLY to derive a sanitized model-search token via
   *  sanitizeModelSearchTerm(); never passed through unsanitized. */
  queryText?: string | null;
  /** Tawveeri's own canonical product id, if the shopper's context resolved to one. */
  canonicalProductId?: string | null;
  /** 0..1 confidence in that canonical identity match. Below EXACT_IDENTITY_THRESHOLD
   *  is treated as ambiguous — falls back to model_search/category, never exact. */
  canonicalIdentityConfidence?: number | null;
  /** The exact Amazon product URL already on file for this canonical product (from
   *  Tawveeri's own product_stores scrape) — never constructed here. */
  exactAmazonProductUrl?: string | null;
  /** Hours since that Amazon offer was last confirmed fresh. Stale (or unknown) fails closed. */
  offerFreshnessHours?: number | null;
  /** Safety flags — ANY true forces a fallback away from exact_product. */
  accessoryLeakageRisk?: boolean;
  conditionMismatch?: boolean; // renewed vs new
  storageOrModelMismatch?: boolean; // different storage/capacity/model generation/size
  openQualityIncident?: boolean;
  /** Only the CURRENTLY LIVE (enabled=true) category → destination map. Never hardcoded
   *  in this module — see file header. */
  liveCategoryCampaigns: ReadonlyMap<string, LiveCategoryDestination>;
}

export interface AmazonDestinationResolution {
  mode: DestinationMode | 'unavailable';
  destination: string | null;
  trackingId: string | null;
  category: string | null;
  canonicalProductId: string | null;
  reasonCode: string;
  evidenceConfidence: number | null;
  /** Always false in V2 — see file header. Not a placeholder: callers must not branch
   *  on this ever becoming true without a fresh compliance re-audit. */
  allowPriceDisplay: false;
}

export const EXACT_IDENTITY_CONFIDENCE_THRESHOLD = 0.85;
// V2.1: aligned to PICK_FRESHNESS_MAX_HOURS (src/lib/intelligence/evidence-engine.ts,
// ADR-193) — the SAME floor the search page itself already uses before making any price
// claim on a product card. A practical, already-established threshold, not a new
// invented number, per the founder's "practical high-confidence threshold" instruction.
export const MAX_OFFER_FRESHNESS_HOURS = 168;

/**
 * Strip a raw query down to a safe Amazon search token: letters (Latin + Arabic),
 * digits, and single spaces only, collapsed and trimmed, capped at 60 chars. Returns
 * null for empty/whitespace-only/over-punctuated input rather than guessing — a null
 * result means the caller falls back to a plain category destination with no `k=` term.
 * Deliberately NOT a passthrough: never forwards arbitrary user text (§2 requirement).
 */
export function sanitizeModelSearchTerm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function withModelSearchParam(destinationUrl: string, term: string): string | null {
  try {
    const u = new URL(destinationUrl);
    u.searchParams.set('k', term);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Resolve the Amazon destination for a shopping context. Pure, deterministic, never
 * throws. Fail-closed at every branch: an ambiguous or unverifiable signal always
 * degrades to a *safer* mode (exact_product → model_search → category → unavailable),
 * never the other direction.
 */
export function resolveAmazonDestination(req: AmazonDestinationRequest): AmazonDestinationResolution {
  const category = req.category ?? null;
  const canonicalProductId = req.canonicalProductId ?? null;
  const confidence = req.canonicalIdentityConfidence ?? null;

  const base = (): AmazonDestinationResolution => ({
    mode: 'unavailable',
    destination: null,
    trackingId: null,
    category,
    canonicalProductId: null,
    reasonCode: 'category_not_live',
    evidenceConfidence: confidence,
    allowPriceDisplay: false,
  });

  if (!category) {
    return { ...base(), reasonCode: 'category_unresolved' };
  }
  const live = req.liveCategoryCampaigns.get(category);
  if (!live) {
    // Never fabricate a destination for a category that isn't an active, founder-approved
    // campaign — this is the structural guarantee behind §5 (no disabled/new category
    // can ever reach this resolver's output regardless of what the caller passes).
    return { ...base(), reasonCode: 'category_not_live' };
  }

  // ---- EXACT_PRODUCT gate ----
  const exactBlockers: string[] = [];
  if (!canonicalProductId) exactBlockers.push('no_canonical_product');
  if (confidence === null || confidence < EXACT_IDENTITY_CONFIDENCE_THRESHOLD) exactBlockers.push('identity_confidence_below_threshold');
  if (!req.exactAmazonProductUrl) exactBlockers.push('no_amazon_offer_url');
  if (req.offerFreshnessHours === null || req.offerFreshnessHours === undefined || req.offerFreshnessHours > MAX_OFFER_FRESHNESS_HOURS) exactBlockers.push('offer_stale_or_unknown');
  if (req.accessoryLeakageRisk) exactBlockers.push('accessory_leakage_risk');
  if (req.conditionMismatch) exactBlockers.push('condition_mismatch');
  if (req.storageOrModelMismatch) exactBlockers.push('storage_or_model_mismatch');
  if (req.openQualityIncident) exactBlockers.push('open_quality_incident');

  if (exactBlockers.length === 0 && req.exactAmazonProductUrl) {
    return {
      mode: 'exact_product',
      destination: req.exactAmazonProductUrl,
      trackingId: live.trackingId,
      category,
      canonicalProductId,
      reasonCode: 'exact_product_verified',
      evidenceConfidence: confidence,
      allowPriceDisplay: false,
    };
  }

  // ---- MODEL_SEARCH gate ----
  const term = sanitizeModelSearchTerm(req.queryText ?? null);
  if (term) {
    const destination = withModelSearchParam(live.destinationUrl, term);
    if (destination) {
      return {
        mode: 'model_search',
        destination,
        trackingId: live.trackingId,
        category,
        canonicalProductId: null,
        reasonCode: `exact_product_blocked:${exactBlockers.join(',') || 'none'}`,
        evidenceConfidence: confidence,
        allowPriceDisplay: false,
      };
    }
  }

  // ---- CATEGORY fallback (always safe — this is the live, already-verified destination) ----
  return {
    mode: 'category',
    destination: live.destinationUrl,
    trackingId: live.trackingId,
    category,
    canonicalProductId: null,
    reasonCode: term ? 'model_search_url_unbuildable' : 'no_model_search_term',
    evidenceConfidence: confidence,
    allowPriceDisplay: false,
  };
}
