// src/lib/campaigns/original-value.ts
// Amazon Decision Layer V2 (2026-09-04) §3 — Original Tawveeri Value Layer.
//
// §1B (compliance audit) finding: the live campaign card (src/components/campaigns/
// campaign-card.tsx) is a disclosed, generic category-invitation — a real disclosure and
// category framing, but essentially no Tawveeri-original insight per card. This is a
// pure, tested generator for the one small contextual line the audit recommended adding:
// derived ONLY from Tawveeri's own evidence, never from Amazon, never fabricated when
// that evidence isn't available.
//
// NOT YET WIRED into campaign-card.tsx — same "built, not forced into the live card in
// the same pass as its own review" posture as destination-resolver.ts. Wiring it requires
// passing a real `comparableProductCount` for the category into getEligibleCampaigns()/
// CampaignCard, which touches the live-serving path this task's own gate says not to
// change without an explicit next step.
export interface OriginalValueContext {
  /** Count of Tawveeri's own catalog products in this category with a comparison
   *  possible (2+ stores) — the same "comparable" concept as comparable-count.sql /
   *  ADR-193, never a raw listing count. Null when not computed for this render. */
  comparableProductCount: number | null;
}

/**
 * Returns one short, factual, evidence-backed sentence, or null when there is no real
 * Tawveeri evidence to say anything with — a null result means the card renders with NO
 * contextual line rather than a generic filler sentence. Never mentions Amazon, price,
 * "best"/"recommended", or anything the ABSOLUTE_FORBIDDEN_PATTERNS in claim-guard.ts
 * would reject — these two files intentionally enforce the same boundary from different
 * directions (generation vs. detection).
 */
export function buildContextualInsightAr(ctx: OriginalValueContext): string | null {
  if (ctx.comparableProductCount === null || ctx.comparableProductCount <= 0) return null;
  return `توفيري يقارن حاليًا ${ctx.comparableProductCount} منتجًا في هذه الفئة عبر عدة متاجر سعودية.`;
}

export function buildContextualInsightEn(ctx: OriginalValueContext): string | null {
  if (ctx.comparableProductCount === null || ctx.comparableProductCount <= 0) return null;
  return `Tawveeri currently compares ${ctx.comparableProductCount} products in this category across multiple Saudi stores.`;
}
