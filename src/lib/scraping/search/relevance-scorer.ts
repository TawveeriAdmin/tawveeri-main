import type { SearchProduct } from './types';
import type { GroupedSearchProduct } from './product-grouper';
import { BRAND_ALIASES } from './product-grouper';
import { determineCategory } from '../utils/category-utils';
import { getBilingualRelevanceBoost } from './search-query-bilingual';

// ─── Accessory Keywords ─────────────────────────────────────────────────────

const ACCESSORY_KEYWORDS = [
  'case', 'cover', 'protector', 'screen protector', 'tempered glass',
  'holder', 'stand', 'mount', 'charger', 'cable', 'adapter', 'hub',
  'sleeve', 'pouch', 'bag', 'skin', 'sticker', 'decal', 'film',
  'lens protector', 'camera protector', 'camera lens', 'back cover', 'bumper',
  'grip', 'ring', 'strap', 'band', 'dock', 'cradle', 'wallet',
  'folio', 'shell', 'armor', 'armour', 'shield', 'guard',
  'magsafe', 'kickstand', 'rugged', 'shockproof', 'tpu', 'silicone',
  'privacy screen', 'privacy glass', 'privacy filter', 'anti-spy',
  '3in1', '3-in-1', '2in1', '2-in-1', 'bundle pack',
  'كفر', 'جراب', 'حافظة', 'حماية', 'شاحن', 'كيبل', 'سلك',
  'لاصق', 'واقي', 'واقي شاشة', 'غطاء', 'حامل', 'ستاند',
  'توصيلة', 'محول', 'قلم', 'ملصق',
];

const ACCESSORY_BRANDS = [
  'tech21', 'spigen', 'otterbox', 'otter box', 'casetify', 'caseology',
  'ringke', 'uag', 'urban armor', 'esr', 'supcase', 'poetic',
  'mous', 'totallee', 'pitaka', 'dbrand', 'zagg', 'belkin',
  'anker', 'baseus', 'nillkin', 'mofi', 'dux ducis', 'torras',
  'rhinoshield', 'catalyst', 'lifeproof', 'incipio', 'moshi',
  'elago', 'vrs design', 'ghostek', 'raptic', 'smartish',
  'xonda', 'panzerglass', 'amazingthing', 'amazing thing',
  'ugreen', 'jsaux', 'benks', 'switcheasy', 'uniq', 'laut',
  'care by', 'green lion', 'devia', 'hoco', 'rock', 'joyroom',
];

const ACCESSORY_PREPOSITION_PATTERNS = [
  /\bfor\s+/i,
  /\bcompatible\s+with\b/i,
  /\bfits\s+/i,
  /\bdesigned\s+for\b/i,
  /\bsuitable\s+for\b/i,
  /\bworks\s+with\b/i,
  /\bمتوافق\s+مع\b/,
  /\bمناسب\s+لـ?\b/,
  /\bيناسب\b/,
  /\bلجهاز\b/,
  /\bلهاتف\b/,
];

/** Specs patterns that indicate a main product (not an accessory) */
const MAIN_PRODUCT_SPEC_PATTERNS = [
  /\b\d+\s*gb\b/i,   // storage/RAM
  /\b\d+\s*tb\b/i,
  /\b\d+\s*mp\b/i,    // megapixels
  /\b\d+\s*mah\b/i,   // battery (large devices)
  /\bsnapdragon\b/i,
  /\bexynos\b/i,
  /\ba\d+\s*(bionic|chip)\b/i,
  /\bm[1-4]\s*(pro|max|ultra)?\b/i,
];

// ─── Known Brands (superset including brand aliases values) ─────────────────

const KNOWN_BRANDS = new Set([
  'samsung', 'apple', 'huawei', 'xiaomi', 'oppo', 'vivo', 'realme',
  'oneplus', 'google', 'sony', 'lg', 'nokia', 'motorola', 'honor',
  'nothing', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'msi',
  'razer', 'toshiba', 'panasonic', 'philips', 'tcl', 'hisense',
  'jbl', 'bose', 'beats', 'marshall', 'sennheiser', 'jabra',
  'canon', 'nikon', 'fujifilm', 'gopro', 'dji',
  'logitech', 'corsair', 'steelseries',
  ...Object.values(BRAND_ALIASES),
]);

// ─── Category Keywords (for intent detection from query) ────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  smartphone: ['phone', 'smartphone', 'mobile', 'iphone', 'galaxy s', 'galaxy z', 'pixel', 'هاتف', 'جوال', 'موبايل'],
  laptop: ['laptop', 'notebook', 'macbook', 'chromebook', 'لابتوب'],
  tablet: ['tablet', 'ipad', 'galaxy tab', 'تابلت', 'آيباد'],
  tv: ['tv', 'television', 'oled', 'qled', 'تلفزيون', 'شاشة'],
  audio: ['headphone', 'earbuds', 'earphone', 'airpods', 'speaker', 'soundbar', 'سماعة', 'سماعات'],
  camera: ['camera', 'dslr', 'mirrorless', 'كاميرا'],
  gaming: ['gaming', 'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'بلايستيشن'],
};

// Model tokens that hint at specific products (not accessories)
const MODEL_TOKEN_PATTERN = /^(?:s\d+|a\d+|z\d+|note\d*|fold\d*|flip\d*|pro|max|ultra|plus|lite|mini|se|\d{2,}|x[ts]?\d*|gt\d*|neo\d*|fe)$/i;

// ─── 5a. Query Intent Detection ─────────────────────────────────────────────

interface QueryIntent {
  intendedCategory: string | null;
  isAccessoryQuery: boolean;
  coreTerms: string[];
  brand: string | null;
  modelHints: string[];
}

function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(t => t.length > 0);

  // Check if query is for an accessory
  const isAccessoryQuery = ACCESSORY_KEYWORDS.some(kw => q.includes(kw));

  // Detect brand
  let brand: string | null = null;
  for (const token of tokens) {
    if (KNOWN_BRANDS.has(token)) {
      brand = token;
      break;
    }
    const aliased = BRAND_ALIASES[token];
    if (aliased) {
      brand = aliased;
      break;
    }
  }

  // Detect intended category
  let intendedCategory: string | null = null;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      intendedCategory = cat;
      break;
    }
  }
  // Infer category from brand + model hints (e.g. "samsung s25" → smartphone)
  if (!intendedCategory && brand) {
    const phoneBrands = ['samsung', 'apple', 'huawei', 'xiaomi', 'oppo', 'vivo', 'realme', 'oneplus', 'google', 'honor', 'nothing', 'motorola', 'nokia'];
    if (phoneBrands.includes(brand)) {
      const hasModelHint = tokens.some(t => MODEL_TOKEN_PATTERN.test(t));
      if (hasModelHint) intendedCategory = 'smartphone';
    }
  }

  // Extract model hints
  const modelHints = tokens.filter(t => MODEL_TOKEN_PATTERN.test(t) && !KNOWN_BRANDS.has(t));

  // Core terms = tokens minus known accessory keywords
  const accessoryTokens = new Set(ACCESSORY_KEYWORDS.flatMap(kw => kw.split(/\s+/)));
  const coreTerms = tokens.filter(t => !accessoryTokens.has(t));

  return { intendedCategory, isAccessoryQuery, coreTerms, brand, modelHints };
}

// ─── 5b. Price Clustering ───────────────────────────────────────────────────

interface PriceTier {
  min: number;
  max: number;
  center: number;
  count: number;
}

interface PriceContext {
  tiers: PriceTier[];
  mainProductTier: PriceTier | null;
  accessoryTier: PriceTier | null;
  mainProductPriceMin: number;
}

function clusterPrices(products: SearchProduct[]): PriceContext {
  const prices = products
    .map(p => p.current_price)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  const noContext: PriceContext = {
    tiers: [],
    mainProductTier: null,
    accessoryTier: null,
    mainProductPriceMin: 0,
  };

  if (prices.length < 5) return noContext;

  // Gap-based clustering
  const tiers: PriceTier[] = [];
  let tierStart = prices[0];
  let tierSum = prices[0];
  let tierCount = 1;

  for (let i = 1; i < prices.length; i++) {
    const currentCenter = tierSum / tierCount;
    const gap = prices[i] - prices[i - 1];

    // Start new tier if gap > 2x current tier center
    if (gap > currentCenter * 2 && tierCount >= 1) {
      tiers.push({
        min: tierStart,
        max: prices[i - 1],
        center: currentCenter,
        count: tierCount,
      });
      tierStart = prices[i];
      tierSum = prices[i];
      tierCount = 1;
    } else {
      tierSum += prices[i];
      tierCount++;
    }
  }
  // Push last tier
  tiers.push({
    min: tierStart,
    max: prices[prices.length - 1],
    center: tierSum / tierCount,
    count: tierCount,
  });

  if (tiers.length < 2) return noContext;

  // Main product tier = highest-center tier with >= 3 products
  // Fall back to >= 2 if no tier has 3
  let mainTier = tiers.filter(t => t.count >= 3).sort((a, b) => b.center - a.center)[0] || null;
  if (!mainTier) {
    mainTier = tiers.filter(t => t.count >= 2).sort((a, b) => b.center - a.center)[0] || null;
  }

  if (!mainTier) return noContext;

  // Accessory tier = tiers below 15% of main tier center
  const threshold = mainTier.center * 0.15;
  const accessoryTiers = tiers.filter(t => t.center < threshold);
  const accessoryTier = accessoryTiers.length > 0
    ? {
        min: Math.min(...accessoryTiers.map(t => t.min)),
        max: Math.max(...accessoryTiers.map(t => t.max)),
        center: accessoryTiers.reduce((s, t) => s + t.center * t.count, 0) / accessoryTiers.reduce((s, t) => s + t.count, 0),
        count: accessoryTiers.reduce((s, t) => s + t.count, 0),
      }
    : null;

  return {
    tiers,
    mainProductTier: mainTier,
    accessoryTier,
    mainProductPriceMin: mainTier.min,
  };
}

// ─── 5c. Product Classification ─────────────────────────────────────────────

type ProductClass = 'main_product' | 'accessory';

function classifyProduct(
  product: SearchProduct,
  intent: QueryIntent,
  priceContext: PriceContext,
): ProductClass {
  const title = (product.name_en || product.name_ar || '').toLowerCase();

  // If no price clustering data, use simple title-only heuristic
  if (!priceContext.mainProductTier) {
    return classifyByTitle(title, intent);
  }

  let score = 0; // positive = accessory, negative = main product

  // Signal 1: Accessory keywords in title (weight 0.25)
  const hasAccessoryKeyword = ACCESSORY_KEYWORDS.some(kw => title.includes(kw));
  const hasMainSpecs = MAIN_PRODUCT_SPEC_PATTERNS.some(p => p.test(title));
  if (hasAccessoryKeyword && !hasMainSpecs) {
    score += 0.25;
  } else if (hasMainSpecs && !hasAccessoryKeyword) {
    score -= 0.25;
  }

  // Signal 2: "For X" preposition pattern (weight 0.20)
  const hasForPattern = ACCESSORY_PREPOSITION_PATTERNS.some(p => p.test(title));
  if (hasForPattern) {
    score += 0.20;
  }

  // Signal 3: Price tier membership (weight 0.30)
  const price = product.current_price;
  if (price > 0) {
    const { mainProductTier, accessoryTier } = priceContext;
    if (mainProductTier && price >= mainProductTier.min * 0.7) {
      score -= 0.30;
    } else if (accessoryTier && price <= accessoryTier.max * 1.3) {
      score += 0.30;
    } else if (mainProductTier && price < mainProductTier.min * 0.3) {
      // Well below main tier but not in accessory tier
      score += 0.15;
    }
  }

  // Signal 4: Category from determineCategory() (weight 0.15)
  const detectedCategory = determineCategory(product.name_en || product.name_ar || '');
  if (intent.intendedCategory) {
    if (detectedCategory === 'accessories') {
      score += 0.15;
    } else if (detectedCategory === intent.intendedCategory) {
      score -= 0.15;
    }
  }

  // Signal 5: Known accessory brand (weight 0.10)
  const titleLower = title.toLowerCase();
  const isAccessoryBrand = ACCESSORY_BRANDS.some(b => titleLower.startsWith(b));
  if (isAccessoryBrand && (!intent.brand || !titleLower.startsWith(intent.brand))) {
    score += 0.10;
  } else if (intent.brand && titleLower.includes(intent.brand)) {
    score -= 0.10;
  }

  return score > 0 ? 'accessory' : 'main_product';
}

/** Fallback classification when no price clustering is available */
function classifyByTitle(title: string, intent: QueryIntent): ProductClass {
  const hasAccessoryKw = ACCESSORY_KEYWORDS.some(kw => title.includes(kw));
  const hasForPattern = ACCESSORY_PREPOSITION_PATTERNS.some(p => p.test(title));
  const hasMainSpecs = MAIN_PRODUCT_SPEC_PATTERNS.some(p => p.test(title));
  const isAccessoryBrand = ACCESSORY_BRANDS.some(b => title.startsWith(b));

  let signals = 0;
  if (hasAccessoryKw) signals++;
  if (hasForPattern) signals++;
  if (isAccessoryBrand && (!intent.brand || !title.startsWith(intent.brand))) signals++;
  if (hasMainSpecs) signals--;

  return signals >= 2 ? 'accessory' : 'main_product';
}

// ─── 5d. Relevance Scoring ──────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ScoringContext {
  intent: QueryIntent;
  priceContext: PriceContext;
  storeRankMap: Map<SearchProduct, number>;
}

function scoreRelevance(product: SearchProduct, query: string, ctx: ScoringContext): number {
  const title = (product.name_en || product.name_ar || '').toLowerCase();
  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter(w => w.length > 0);

  if (!title || queryWords.length === 0) return 0;

  let score = 0;

  // Exact phrase match (+25)
  if (title.includes(q)) {
    score += 25;
  }

  // Word overlap with word-boundary matching (+20 max)
  const matchedWords = queryWords.filter(w => {
    if (w.length <= 2 || /^\d+$/.test(w)) return title.includes(w);
    return new RegExp(`\\b${escapeRegex(w)}\\b`, 'i').test(title);
  });
  const wordOverlap = matchedWords.length / queryWords.length;
  score += wordOverlap * 20;

  // English query vs Arabic (or mixed) product titles — Gulf retailers
  score += getBilingualRelevanceBoost(q, title);

  // Bigram match (+10 max)
  let bigramScore = 0;
  for (let i = 0; i < queryWords.length - 1; i++) {
    if (title.includes(queryWords[i] + ' ' + queryWords[i + 1])) {
      bigramScore += 10 / Math.max(queryWords.length - 1, 1);
    }
  }
  score += Math.min(bigramScore, 10);

  // Model hint match (+15 max)
  if (ctx.intent.modelHints.length > 0) {
    const matchedHints = ctx.intent.modelHints.filter(h => {
      if (h.length <= 2) return title.includes(h);
      return new RegExp(`\\b${escapeRegex(h)}\\b`, 'i').test(title);
    });
    score += (matchedHints.length / ctx.intent.modelHints.length) * 15;
  }

  // Brand match (+10)
  if (ctx.intent.brand && title.includes(ctx.intent.brand)) {
    score += 10;
  }

  // Title specificity — shorter matching titles rank higher (+5 max)
  if (wordOverlap > 0.5) {
    const titleWords = title.split(/\s+/).length;
    const brevity = Math.min(queryWords.length / titleWords, 1);
    score += brevity * 5;
  }

  // Store rank bonus (+5 max)
  const storeRank = ctx.storeRankMap.get(product) ?? 50;
  score += Math.max(0, 5 - storeRank * 0.3);

  // Price position — closeness to tier center (+5 max)
  if (ctx.priceContext.mainProductTier && product.current_price > 0) {
    const tier = ctx.priceContext.mainProductTier;
    if (product.current_price >= tier.min * 0.7 && product.current_price <= tier.max * 1.3) {
      const distFromCenter = Math.abs(product.current_price - tier.center) / tier.center;
      score += Math.max(0, 5 * (1 - distFromCenter));
    }
  }

  // Rating/reviews bonus (+5 max)
  const rating = product.rating;
  const reviews = product.review_count;
  if (rating && rating > 0) {
    score += Math.min((rating / 5) * 3, 3);
  }
  if (reviews && reviews > 0) {
    score += Math.min(Math.log10(reviews + 1), 2);
  }

  return score;
}

// ─── 5e. Two-Tier Ranking (Entry Point) ─────────────────────────────────────

export function rankProducts(
  groups: GroupedSearchProduct[],
  query: string,
  storeRankMap: Map<SearchProduct, number>,
): void {
  if (groups.length === 0) return;

  const intent = detectQueryIntent(query);

  // Collect all individual products for clustering
  const allProducts = groups.flatMap(g => g.stores);
  const priceContext = clusterPrices(allProducts);

  const ctx: ScoringContext = { intent, priceContext, storeRankMap };

  // Classify + score each group
  const groupMeta = new Map<GroupedSearchProduct, { classification: ProductClass; score: number }>();

  for (const group of groups) {
    // Classification: if ANY store entry is classified as main_product, group is main_product
    let isMain = false;
    let maxScore = -Infinity;

    for (const p of group.stores) {
      const cls = classifyProduct(p, intent, priceContext);
      if (cls === 'main_product') isMain = true;

      const s = scoreRelevance(p, query, ctx);
      if (s > maxScore) maxScore = s;
    }

    groupMeta.set(group, {
      classification: isMain ? 'main_product' : 'accessory',
      score: maxScore,
    });
  }

  // Sort: if not an accessory query, main products first; otherwise flat by score
  if (intent.isAccessoryQuery) {
    groups.sort((a, b) => {
      const metaA = groupMeta.get(a)!;
      const metaB = groupMeta.get(b)!;
      return metaB.score - metaA.score;
    });
  } else {
    groups.sort((a, b) => {
      const metaA = groupMeta.get(a)!;
      const metaB = groupMeta.get(b)!;

      // Main products always before accessories
      if (metaA.classification !== metaB.classification) {
        return metaA.classification === 'main_product' ? -1 : 1;
      }
      // Within same tier, sort by score desc
      return metaB.score - metaA.score;
    });
  }
}
