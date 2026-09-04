// src/lib/search/canonical-category.ts
// Canonical mapping: src/lib/agent/task-parser.ts's parseShoppingTask().category (the NLU/
// decision-engine vocabulary) -> the value consumed by usage_events telemetry and campaign
// eligibility (categories[] in affiliate_campaigns, matched by
// src/lib/campaigns/eligibility.ts's categoryMatches()). The two vocabularies drifted
// independently — task-parser.ts resolves fine-grained appliance subcategories
// (refrigerator/washing_machine/dishwasher/vacuum/microwave/oven/air_fryer/coffee_maker/
// kettle/blender/…) and uses "mobile", while the STOREFRONT product taxonomy
// (src/lib/scraping/utils/category-utils.ts's CATEGORY_KEYWORDS keys, the same list
// products.category values are drawn from) buckets large appliances under `appliance`,
// countertop appliances under `kitchen`, and phones under `smartphone` — MEASURED in the
// Amazon Campaign V1 delivery-gap investigation (a "جوال"/"ايفون" search resolving category
// "mobile" would never match a campaign row configured with categories:['smartphone']).
//
// Multi-category Amazon expansion (Sept 2026): campaign categories are NOT required to
// match the storefront product-catalog bucket — each campaign is an independent Amazon
// destination, gated by its OWN categories[] value. For the categories the founder approved
// as distinct first-wave campaigns (air_fryer, coffee_machine, vacuum, electric_kettle,
// blender), this map returns the FINE-GRAINED classifier-level value instead of the coarse
// storefront bucket, so "قلاية هوائية" and "ماكينة قهوة" resolve to two different, correctly
// separable campaign categories instead of both collapsing to "kitchen". Categories with no
// approved campaign yet (oven, cooker, toaster, microwave, refrigerator, washing_machine,
// dishwasher) keep mapping to their coarse storefront bucket, unchanged — additive only, no
// broad rename of the taxonomy.
//
// This mapping feeds ONLY usage_events.category and campaign eligibility — never product
// ranking/gating, which reads constraintTask.category (the raw classifier value) directly
// and never passes through this file. Unknown beats incorrect: an unmapped classifier
// category returns null, never a guessed value.
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
  // Large home appliances: task-parser.ts resolves these individually. `vacuum` is an
  // approved first-wave campaign category (kept distinct, identity-mapped); refrigerator/
  // washing_machine/dishwasher have no approved campaign yet and stay bucketed under the
  // storefront taxonomy's `appliance` (category-utils.ts, "Large home appliances ... Added
  // 2026-07-27") — do NOT split these out until their own campaigns are approved.
  refrigerator: 'appliance',
  washing_machine: 'appliance',
  dishwasher: 'appliance',
  vacuum: 'vacuum',
  // Kitchen countertop appliances: task-parser.ts resolves these individually. air_fryer,
  // coffee_maker (-> "coffee_machine", the founder's chosen campaign-category name), kettle
  // (-> "electric_kettle"), and blender are approved first-wave campaign categories, kept
  // distinct. microwave/oven/toaster/cooker have no approved campaign yet and stay bucketed
  // under the storefront taxonomy's `kitchen`.
  microwave: 'kitchen',
  oven: 'kitchen',
  air_fryer: 'air_fryer',
  coffee_maker: 'coffee_machine',
  kettle: 'electric_kettle',
  toaster: 'kitchen',
  blender: 'blender',
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
