import type { ProductCategory } from '@/lib/database/types';

/**
 * Approved-category allowlist for Tawveeri (Founder product-first directive 2026-07-27).
 *
 * Tawveeri is an electronics + home-appliances comparison platform. Mixed-category hypermarkets
 * (LuLu, Carrefour) and marketplaces (Noon, Amazon) MUST NOT contribute supermarket / grocery /
 * fashion / toys / furniture / consumable products. This is a hard allowlist enforced at
 * ACQUISITION time (in the validator, so every store is gated) and is also safe to re-check before
 * customer publication.
 *
 * `personal_care` is intentionally EXCLUDED (personal-care *consumables* risk; hair-dryers/shavers
 * that are genuine appliances get classified as `appliance` by determineCategory).
 */
export const APPROVED_CATEGORIES: ReadonlySet<ProductCategory> = new Set<ProductCategory>([
  'tv', 'laptop', 'smartphone', 'tablet', 'audio', 'camera', 'gaming', 'accessories',
  'monitor', 'printer', 'networking', 'smart_home', 'wearable', 'appliance', 'kitchen', 'refrigerator',
]);

/**
 * Strict non-scope signal — food/grocery/beauty-consumables/fashion/toys/furniture terms that NEVER
 * appear in a genuine electronics/appliance product title. Deliberately does NOT match legitimate
 * appliances (vacuum CLEANER, WATER dispenser, steam cleaner, air fryer, coffee MACHINE, etc.).
 * Used to catch grocery items that a keyword categorizer misfiled into an approved bucket
 * (e.g. "Ferrero Rocher Chocolate Tablet" → `tablet`).
 */
const NONSCOPE_TITLE = new RegExp(
  [
    // food & grocery
    'chocolate', 'ferrero', 'raffaello', 'nutella', 'biscuit', 'cookie', 'wafer', '\\bcandy\\b', 'gummy',
    'snack', 'chips', 'crisps', 'cereal', 'cornflakes', 'oats\\b', 'coffee bean', 'ground coffee', 'tea bag',
    'juice', '\\bsoda\\b', '\\bcola\\b', 'beverage', 'ketchup', 'mayonnaise', '\\bsauce\\b', 'seasoning',
    '\\bspice\\b', '\\brice\\b', '\\bflour\\b', '\\bsugar\\b', 'cooking oil', 'olive oil', 'noodle', '\\bpasta\\b',
    '\\bhoney\\b', '\\bjam\\b', 'canned', 'frozen food', 'mineral water',
    // beauty/personal consumables
    'shampoo', 'conditioner', 'body wash', '\\bsoap\\b', 'toothpaste', 'deodorant', '\\bperfume\\b', 'cologne',
    'face cream', 'moisturizer', 'makeup', 'lipstick', 'mascara', 'nail polish', '\\bdiaper', 'sanitary',
    'tissue', '\\bwipes\\b', 'detergent', 'fabric softener', '\\bbleach\\b',
    // fashion / toys / furniture
    't-shirt', '\\bdress\\b', '\\bjeans\\b', 'trouser', '\\bsneaker', '\\bsandal', '\\babaya\\b', '\\bhijab\\b',
    '\\btoy\\b', '\\bdoll\\b', '\\blego\\b', 'board game', '\\bsofa\\b', 'mattress', '\\bpillow\\b', '\\bcurtain\\b',
    '\\bcarpet\\b', '\\bbedsheet', 'towel set',
  ].join('|'),
  'i',
);

/** True iff a product is within Tawveeri's approved electronics/appliances scope. */
export function isInScope(name: string | null | undefined, category: ProductCategory | string | null | undefined): boolean {
  if (!category || !APPROVED_CATEGORIES.has(category as ProductCategory)) return false;
  const n = name || '';
  if (NONSCOPE_TITLE.test(n)) return false;
  return true;
}
