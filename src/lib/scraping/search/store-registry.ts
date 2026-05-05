/**
 * 8 prioritized stores for MVP launch. Add a new store here + its scraper
 * in `./<slug>-search-scraper.ts` + the mapping in `search-orchestrator.ts`.
 */
export const SUPPORTED_SEARCH_STORES = [
  'amazon',
  'noon',
  'jarir',
  'extra',
  'almanea',
  'samsung_ksa',
  'shaker',
  'swsg',
] as const;

export const BLOCKED_STORES = [] as const;

export type SearchStoreSlug = (typeof SUPPORTED_SEARCH_STORES)[number];

export const DEFAULT_SEARCH_STORES: SearchStoreSlug[] = [...SUPPORTED_SEARCH_STORES];

const SUPPORTED_STORE_SET = new Set<string>(SUPPORTED_SEARCH_STORES);

export function isSupportedSearchStore(store: string): store is SearchStoreSlug {
  return SUPPORTED_STORE_SET.has(store);
}

export function normalizeSearchStores(input: unknown): SearchStoreSlug[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_SEARCH_STORES];
  }

  const normalized = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(isSupportedSearchStore);

  if (normalized.length === 0) {
    return [...DEFAULT_SEARCH_STORES];
  }

  return Array.from(new Set(normalized));
}
