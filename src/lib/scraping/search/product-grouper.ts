import type { ScrapedProduct } from '../base/types';
import type { SearchProduct } from './types';
import { extractSpecsFromTitle } from '../config/spec-configs';
import { matchProducts } from '../matching/fuzzy-matcher';

export interface GroupedSearchProduct extends ScrapedProduct {
  stores: SearchProduct[];
  best_price: number;
  store_count: number;
}

/**
 * Brand alias map — normalizes brand variants to a canonical form.
 */
export const BRAND_ALIASES: Record<string, string> = {
  galaxy: 'samsung',
  'hewlett-packard': 'hp',
  'hewlett packard': 'hp',
  lenovo: 'lenovo',
  'lg electronics': 'lg',
  huawei: 'huawei',
  honor: 'honor',
  oneplus: 'oneplus',
  'one plus': 'oneplus',
  xiaomi: 'xiaomi',
  redmi: 'xiaomi',
  poco: 'xiaomi',
  realme: 'realme',
  oppo: 'oppo',
  vivo: 'vivo',
  nothing: 'nothing',
  motorola: 'motorola',
  moto: 'motorola',
  tcl: 'tcl',
  hisense: 'hisense',
  jbl: 'jbl',
  harman: 'jbl',
  beats: 'beats',
  bose: 'bose',
  anker: 'anker',
  soundcore: 'anker',
};

/**
 * Color words to strip from titles when building fingerprints.
 */
const COLOR_WORDS = [
  'black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'purple',
  'pink', 'gray', 'grey', 'titanium', 'graphite', 'midnight', 'starlight',
  'space gray', 'space grey', 'sierra blue', 'alpine green', 'deep purple',
  'natural titanium', 'blue titanium', 'white titanium', 'black titanium',
  'desert titanium', 'cream', 'lavender', 'phantom', 'mystic', 'coral',
  'mint', 'yellow', 'orange', 'bronze',
  // Arabic colors
  'أسود', 'أبيض', 'فضي', 'ذهبي', 'أزرق', 'أحمر', 'أخضر', 'بنفسجي',
  'رمادي', 'تيتانيوم', 'وردي',
];

/**
 * Condition words to strip from titles.
 */
const CONDITION_WORDS = [
  'renewed', 'refurbished', 'used', 'pre-owned', 'open box', 'like new',
  'certified', 'renewed premium',
  'مجدد', 'مستعمل', 'مفتوح',
];

function normalizeBrand(brand: string): string {
  const lower = brand.toLowerCase().trim();
  return BRAND_ALIASES[lower] || lower;
}

function normalizeModelForFingerprint(name: string): string {
  let normalized = name.toLowerCase();

  // Remove color words (longest first to handle multi-word colors)
  const sorted = [...COLOR_WORDS].sort((a, b) => b.length - a.length);
  for (const color of sorted) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegex(color)}\\b`, 'gi'), '');
  }

  // Remove condition words
  for (const cond of CONDITION_WORDS) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegex(cond)}\\b`, 'gi'), '');
  }

  // Remove parenthetical content like "(US Version)" or "(International)"
  normalized = normalized.replace(/\([^)]*\)/g, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a fingerprint for grouping: brand|model_normalized|storage|category
 */
function buildFingerprint(product: SearchProduct): string {
  const brand = normalizeBrand(product.brand);
  const title = product.name_en || product.name_ar || '';
  const model = normalizeModelForFingerprint(title);
  const specs = extractSpecsFromTitle(title);
  const storage = specs.storage_gb || '';

  return `${brand}|${model}|${storage}|${product.category}`;
}

/**
 * Pick the best representative product from a group.
 * Prefers: highest relevance score proxy (longest English name, has images).
 */
function pickRepresentative(products: SearchProduct[]): SearchProduct {
  return products.reduce((best, p) => {
    const bestScore = scoreRepresentative(best);
    const pScore = scoreRepresentative(p);
    return pScore > bestScore ? p : best;
  });
}

function scoreRepresentative(p: SearchProduct): number {
  let score = 0;
  if (p.name_en && p.name_en.length > 0) score += p.name_en.length;
  if (p.image_urls && p.image_urls.length > 0) score += 50;
  if (p.brand) score += 20;
  if (p.model) score += 20;
  return score;
}

/**
 * Group search products that represent the same physical product from different stores.
 *
 * Algorithm:
 * 1. Build fingerprint per product (brand|normalized_model|storage|category)
 * 2. Group by identical fingerprints
 * 3. Fuzzy-match ungrouped products against existing groups (threshold >= 0.75, brand must match)
 * 4. Build GroupedSearchProduct[] output
 */
export function groupSearchProducts(
  products: SearchProduct[],
  _query: string,
): GroupedSearchProduct[] {
  if (products.length === 0) return [];

  // Step 1+2: Group by fingerprint
  const fingerprintGroups = new Map<string, SearchProduct[]>();
  const ungrouped: SearchProduct[] = [];

  for (const product of products) {
    const brand = normalizeBrand(product.brand);
    // Skip products with no brand — can't reliably group them
    if (!brand) {
      ungrouped.push(product);
      continue;
    }

    const fp = buildFingerprint(product);
    const existing = fingerprintGroups.get(fp);
    if (existing) {
      // Don't add duplicate stores (same store, same product)
      const isDuplicateStore = existing.some(e => e.store === product.store);
      if (isDuplicateStore) {
        // Keep the one with the better price
        const existingFromSameStore = existing.find(e => e.store === product.store)!;
        if (product.current_price > 0 && product.current_price < existingFromSameStore.current_price) {
          const idx = existing.indexOf(existingFromSameStore);
          existing[idx] = product;
        }
      } else {
        existing.push(product);
      }
    } else {
      fingerprintGroups.set(fp, [product]);
    }
  }

  // Step 3: Fuzzy-match ungrouped products against existing groups
  const groupEntries = [...fingerprintGroups.entries()];
  for (const product of ungrouped) {
    let bestMatch: { key: string; score: number } | null = null;

    for (const [key, group] of groupEntries) {
      const representative = group[0];
      const score = matchProducts(
        product.name_en || product.name_ar || '',
        product.brand,
        product.model,
        representative.name_en || representative.name_ar || '',
        representative.brand,
        representative.model,
      );

      if (score >= 0.75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { key, score };
      }
    }

    if (bestMatch) {
      const group = fingerprintGroups.get(bestMatch.key)!;
      const isDuplicateStore = group.some(e => e.store === product.store);
      if (!isDuplicateStore) {
        group.push(product);
      }
    } else {
      // Create a new group for this product
      const fp = `ungrouped-${product.store}-${product.sku || Math.random().toString(36).slice(2)}`;
      fingerprintGroups.set(fp, [product]);
    }
  }

  // Step 4: Build output
  const result: GroupedSearchProduct[] = [];

  for (const group of fingerprintGroups.values()) {
    const representative = pickRepresentative(group);
    const prices = group.map(p => p.current_price).filter(p => p > 0);
    const bestPrice = prices.length > 0 ? Math.min(...prices) : 0;

    result.push({
      // Representative product info
      name_ar: representative.name_ar,
      name_en: representative.name_en,
      brand: representative.brand,
      model: representative.model,
      sku: representative.sku,
      current_price: bestPrice,
      original_price: representative.original_price,
      availability: group.some(p => p.availability === 'in_stock') ? 'in_stock' : representative.availability,
      product_url: representative.product_url,
      image_urls: representative.image_urls,
      specifications: representative.specifications,
      category: representative.category,
      description_ar: representative.description_ar,
      description_en: representative.description_en,
      is_deal: group.some(p => p.is_deal),
      coupon_code: representative.coupon_code,
      // Group-specific fields
      stores: group,
      best_price: bestPrice,
      store_count: new Set(group.map(p => p.store)).size,
    });
  }

  return result;
}
