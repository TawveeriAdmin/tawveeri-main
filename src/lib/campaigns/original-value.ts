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

// V2.1 §8 — the mode-based insight actually wired into the live card. Says exactly what
// Tawveeri's own routing decision found, in the shopper's terms, never a technical
// confidence number. One fixed, hardcoded string per mode (never LLM/user-generated),
// so there is no injection surface and no need to run these through claim-guard the way
// admin-entered campaign copy is — see tests/campaigns/original-value.test.ts for the
// cross-check that they pass it anyway.
const CATEGORY_LABELS_AR: Record<string, string> = {
  tablet: 'الأجهزة اللوحية',
  tv: 'التلفزيونات',
  smartphone: 'الجوالات',
  coffee_machine: 'ماكينات القهوة',
  electric_kettle: 'الغلايات الكهربائية',
};
const CATEGORY_LABELS_EN: Record<string, string> = {
  tablet: 'tablets',
  tv: 'TVs',
  smartphone: 'smartphones',
  coffee_machine: 'coffee machines',
  electric_kettle: 'electric kettles',
};

export type ModeInsightMode = 'exact_product' | 'model_search' | 'category';

/** Never fabricates a category name it doesn't recognize — returns null (card renders
 *  with no insight line) rather than a generic filler when `category` isn't one of the
 *  known live categories. */
export function buildModeInsightAr(mode: ModeInsightMode, category: string | null): string | null {
  if (mode === 'exact_product') return 'توفيري تعرّف على نفس المنتج.';
  if (mode === 'model_search') return 'توفيري تعرّف على الموديل، لكن لم نثبت عرضًا مطابقًا بما يكفي.';
  const label = category ? CATEGORY_LABELS_AR[category] : null;
  return label ? `بحثك يطابق فئة ${label}.` : null;
}

export function buildModeInsightEn(mode: ModeInsightMode, category: string | null): string | null {
  if (mode === 'exact_product') return 'Tawveeri recognized the same product.';
  if (mode === 'model_search') return "Tawveeri recognized the model, but couldn't confirm a matching listing yet.";
  const label = category ? CATEGORY_LABELS_EN[category] : null;
  return label ? `Your search matches the ${label} category.` : null;
}
