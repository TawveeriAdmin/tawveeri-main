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
const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
  /افضل سعر|أفضل سعر/i, // "best price"
  /السعر الحالي|سعر مؤكد|سعر موثق/i, // "current/verified/confirmed price"
  /الأرخص|ارخص سعر|اقل سعر|أقل سعر/i, // "cheapest / lowest price"
  /best price/i,
  /verified price/i,
  /cheapest/i,
  /lowest price/i,
  /current price/i,
];

export interface ClaimGuardResult {
  compliant: boolean;
  violations: string[];
}

/**
 * Checks campaign copy (title/CTA/disclosure, any locale, any number of strings) for a
 * forbidden price/verification claim. `hasFreshOfferEvidence` must be true — a real, dated,
 * Tawveeri-matched Amazon offer confirmed for this exact campaign — for such a claim to ever
 * be allowed. Defaults to non-compliant scanning; never assume evidence exists.
 */
export function checkClaimGuard(texts: string[], hasFreshOfferEvidence: boolean): ClaimGuardResult {
  if (hasFreshOfferEvidence) return { compliant: true, violations: [] };
  const violations: string[] = [];
  for (const text of texts) {
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      if (pattern.test(text)) violations.push(`"${text}" matches forbidden claim pattern ${pattern}`);
    }
  }
  return { compliant: violations.length === 0, violations };
}

// The approved, compliant generic copy for a category-discovery card with no fresh offer
// evidence — a disclosed invitation to browse, never a price or recommendation claim.
export const GENERIC_DISCOVERY_COPY_AR = 'استكشف الخيارات على Amazon.sa';
export const GENERIC_DISCOVERY_COPY_EN = 'Explore options on Amazon.sa';
