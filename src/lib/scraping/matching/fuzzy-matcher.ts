/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - distance / maxLength;
}

/**
 * Normalize product name for matching
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract key features from product name
 */
export function extractKeyFeatures(name: string): string[] {
  const normalized = normalizeProductName(name);
  const words = normalized.split(' ');
  
  // Remove common stop words
  const stopWords = ['the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
  const features = words.filter(word => word.length > 2 && !stopWords.includes(word));
  
  return features;
}

/**
 * Match two products and return similarity score
 */
// Samsung KSA official-catalog closure mission (2026-09-12, ADR pending): `brand`/`model`
// are typed as required `string` here, but the real callers pass a DB row's `products.brand`
// / `products.model` straight through — and live production data has null values in both,
// found live when Samsung's recovery run crashed on "Cannot read properties of null (reading
// 'toLowerCase')" for every product whose fuzzy-match candidate pool included an existing
// row with model=null (`ProductMatcher.fuzzyMatch`'s `.ilike('brand', ...)` prefilter has no
// model condition, so null-model rows are never excluded before reaching here). This is
// GENERIC matching code shared by every merchant, not Samsung-specific — the fix widens the
// accepted type to what production actually sends and is null-safe for ANY caller, never
// merchant-specific. Confirmed with the fuzzy-matcher.test.ts regression suite.
export function matchProducts(
  name1: string | null | undefined,
  brand1: string | null | undefined,
  model1: string | null | undefined,
  name2: string | null | undefined,
  brand2: string | null | undefined,
  model2: string | null | undefined
): number {
  // Normalize inputs
  const normName1 = normalizeProductName(name1 ?? '');
  const normName2 = normalizeProductName(name2 ?? '');
  const normBrand1 = (brand1 ?? '').toLowerCase().trim();
  const normBrand2 = (brand2 ?? '').toLowerCase().trim();

  // Brand must match (exact). An empty/missing brand on either side is UNKNOWN, not a
  // wildcard — required so two products that both happen to lack a brand never tie on that
  // alone (the founder's own "missing must not create a false match" invariant, applied here
  // too since it is the same defect class as the model case below).
  if (!normBrand1 || !normBrand2 || normBrand1 !== normBrand2) {
    return 0;
  }

  // Model similarity. UNKNOWN != EQUAL: a missing model on either side contributes ZERO
  // similarity, never a perfect one — `calculateSimilarity('', '')` returns 1 by its own
  // contract (maxLength===0), which would otherwise let two DIFFERENT products that both
  // simply lack a parsed model tie on a fabricated "100% model match" and silently merge.
  // A present model still compares normally, unaffected.
  const rawModel1 = (model1 ?? '').toLowerCase().trim();
  const rawModel2 = (model2 ?? '').toLowerCase().trim();
  const modelSimilarity = (rawModel1 && rawModel2) ? calculateSimilarity(rawModel1, rawModel2) : 0;

  // Name similarity
  const nameSimilarity = calculateSimilarity(normName1, normName2);

  // Feature-based similarity
  const features1 = extractKeyFeatures(normName1);
  const features2 = extractKeyFeatures(normName2);
  const commonFeatures = features1.filter(f => features2.includes(f));
  const featureSimilarity = features1.length > 0 
    ? commonFeatures.length / Math.max(features1.length, features2.length)
    : 0;

  // Weighted average: Model 50%, Name 30%, Features 20%
  const overallSimilarity = 
    modelSimilarity * 0.5 +
    nameSimilarity * 0.3 +
    featureSimilarity * 0.2;

  return overallSimilarity;
}






