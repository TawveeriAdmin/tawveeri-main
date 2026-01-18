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
export function matchProducts(
  name1: string,
  brand1: string,
  model1: string,
  name2: string,
  brand2: string,
  model2: string
): number {
  // Normalize inputs
  const normName1 = normalizeProductName(name1);
  const normName2 = normalizeProductName(name2);
  const normBrand1 = brand1.toLowerCase().trim();
  const normBrand2 = brand2.toLowerCase().trim();
  const normModel1 = model1.toLowerCase().trim();
  const normModel2 = model2.toLowerCase().trim();

  // Brand must match (exact)
  if (normBrand1 !== normBrand2) {
    return 0;
  }

  // Model similarity
  const modelSimilarity = calculateSimilarity(normModel1, normModel2);
  
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

