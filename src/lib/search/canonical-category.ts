// src/lib/search/canonical-category.ts
// Canonical mapping: src/lib/agent/task-parser.ts's parseShoppingTask().category (the NLU/
// decision-engine vocabulary) -> the storefront taxonomy actually stored in
// products.category and consumed by campaign eligibility (categories[] in
// affiliate_campaigns, matched by src/lib/campaigns/eligibility.ts's categoryMatches()).
// The two vocabularies drifted independently — task-parser.ts resolves fine-grained
// appliance subcategories (refrigerator/washing_machine/dishwasher/vacuum/microwave/oven/…)
// and uses "mobile", while the storefront taxonomy (src/lib/scraping/utils/category-utils.ts's
// CATEGORY_KEYWORDS keys, the same list products.category values are drawn from) buckets large
// appliances under `appliance`, countertop appliances under `kitchen`, and phones under
// `smartphone` — MEASURED in the Amazon Campaign V1 delivery-gap investigation (a "جوال"/
// "ايفون" search resolving category "mobile" would never match a campaign row configured
// with categories:['smartphone']).
//
// This is the ONE place that reconciles them, so a resolved category is never passed
// downstream (usage_events telemetry, campaign eligibility) under a name nothing else
// recognizes. Unknown beats incorrect: an unmapped classifier category returns null, never
// a guessed storefront bucket.
const CLASSIFIER_TO_STOREFRONT_CATEGORY: Record<string, string> = {
  // Identical vocabulary in both places — listed explicitly so the contract is complete,
  // not implied by a pass-through default.
  tablet: 'tablet',
  laptop: 'laptop',
  tv: 'tv',
  audio: 'audio',
  camera: 'camera',
  air_conditioner: 'air_conditioner',
  // The proven mismatch this fix targets.
  mobile: 'smartphone',
  // Large home appliances: task-parser.ts resolves these individually; the storefront
  // taxonomy buckets them all under `appliance` (category-utils.ts, "Large home appliances
  // ... Added 2026-07-27").
  refrigerator: 'appliance',
  washing_machine: 'appliance',
  dishwasher: 'appliance',
  vacuum: 'appliance',
  // Kitchen countertop appliances: task-parser.ts resolves these individually; the
  // storefront taxonomy buckets them under `kitchen`.
  microwave: 'kitchen',
  oven: 'kitchen',
  air_fryer: 'kitchen',
  coffee_maker: 'kitchen',
  kettle: 'kitchen',
  toaster: 'kitchen',
  blender: 'kitchen',
  cooker: 'kitchen',
};

/**
 * Map a task-parser-resolved category to the storefront/campaign taxonomy. Returns null
 * for an unresolved input, or for a classifier category with no confident storefront
 * equivalent (e.g. `air_purifier`, not currently a distinct storefront bucket) — never
 * fabricates a mapping.
 */
export function toStorefrontCategory(classifierCategory: string | null | undefined): string | null {
  if (!classifierCategory) return null;
  return CLASSIFIER_TO_STOREFRONT_CATEGORY[classifierCategory] ?? null;
}
