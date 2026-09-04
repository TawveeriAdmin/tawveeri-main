// src/lib/campaigns/claim-guard.ts
// Multi-category Amazon expansion safety contract (Sept 2026, small-appliance categories).
// A generic Amazon category-discovery card ("استكشف الخيارات على Amazon.sa") must NEVER
// claim a specific price, "best price", "verified price", "cheapest", or a Tawveeri-verified
// exact-product recommendation UNLESS fresh, confirmed Amazon offer evidence backs it. Most
// small-appliance categories (air_fryer, coffee_machine, vacuum, electric_kettle, blender)
// currently have stale/absent fresh Amazon offer data in Tawveeri's own catalog — see the
// multi-category expansion investigation. This is the one place that checks campaign copy
// against that rule before it can ever reach production; it is not wired into any write path
// itself (no campaign rows are created by this patch) — it exists so the founder's review
// package can be validated against the rule, not just described by it.
// Claims that are only wrong because we cannot currently BACK them — allowed once
// `hasFreshOfferEvidence` proves a real, dated, Tawveeri-matched Amazon offer exists.
const PRICE_CLAIM_PATTERNS: RegExp[] = [
  /افضل سعر|أفضل سعر/i, // "best price"
  /السعر الحالي|سعر مؤكد|سعر موثق/i, // "current/verified/confirmed price"
  /الأرخص|ارخص سعر|اقل سعر|أقل سعر/i, // "cheapest / lowest price"
  /best price/i,
  /verified price/i,
  /cheapest/i,
  /lowest price/i,
  /current price/i,
];

// Amazon Decision Layer V2 (2026-09-04) §3 — claims that are wrong regardless of any
// price evidence: Tawveeri has no editorial endorsement from Amazon, does not display
// Best Sellers/Movers & Shakers rank to customers, and runs no promotion of its own to
// call a "sale"/"discount". A fresh Amazon offer price does not make any of these true,
// so — unlike PRICE_CLAIM_PATTERNS — hasFreshOfferEvidence never waives these.
const ABSOLUTE_FORBIDDEN_PATTERNS: RegExp[] = [
  /موصى به من امازون|موصى به من أمازون|يوصي به امازون|يوصي به أمازون/i, // "recommended by Amazon"
  /أفضل منتج في امازون|افضل منتج في امازون|أفضل منتج في أمازون/i, // "Amazon's best product"
  /الأكثر مبيعا|الاكثر مبيعا|الأكثر مبيعاً/i, // "best seller"
  /تخفيضات اليوم الوطني|عروض اليوم الوطني/i, // "National Day discount/deal"
  /recommended by amazon/i,
  /amazon'?s best/i,
  /best ?seller/i,
  /\bsale\b/i,
  /national day discount/i,
];

export interface ClaimGuardResult {
  compliant: boolean;
  violations: string[];
}

/**
 * Checks campaign copy (title/CTA/disclosure, any locale, any number of strings) for a
 * forbidden claim. `hasFreshOfferEvidence` must be true — a real, dated, Tawveeri-matched
 * Amazon offer confirmed for this exact campaign — for a PRICE claim to ever be allowed;
 * it never waives the ABSOLUTE set (editorial-endorsement/best-seller/sale claims Tawveeri
 * has no authority to make regardless of price data). Defaults to non-compliant scanning;
 * never assume evidence exists.
 */
export function checkClaimGuard(texts: string[], hasFreshOfferEvidence: boolean): ClaimGuardResult {
  const violations: string[] = [];
  for (const text of texts) {
    for (const pattern of ABSOLUTE_FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) violations.push(`"${text}" matches forbidden claim pattern ${pattern}`);
    }
    if (!hasFreshOfferEvidence) {
      for (const pattern of PRICE_CLAIM_PATTERNS) {
        if (pattern.test(text)) violations.push(`"${text}" matches forbidden claim pattern ${pattern}`);
      }
    }
  }
  return { compliant: violations.length === 0, violations };
}

// The approved, compliant generic copy for a category-discovery card with no fresh offer
// evidence — a disclosed invitation to browse, never a price or recommendation claim.
export const GENERIC_DISCOVERY_COPY_AR = 'استكشف الخيارات على Amazon.sa';
export const GENERIC_DISCOVERY_COPY_EN = 'Explore options on Amazon.sa';
