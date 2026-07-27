/**
 * Approved-27 scope (Founder Directive 2026-07-27): only retailers in the approved portfolio may
 * appear in search. samsung_ksa and shaker are NOT approved → removed from the active registry
 * (their scraper classes + config JSON are retained-but-dormant / archived in place). swsg is
 * approved (= Sheta & Saif). Add a new store here + its scraper in `./<slug>-search-scraper.ts`
 * + the mapping in `search-orchestrator.ts`, and register it in `approved-retailers.ts`.
 */
export const SUPPORTED_SEARCH_STORES = [
  'amazon',
  'noon',
  'jarir',
  'extra',
  'almanea',
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
