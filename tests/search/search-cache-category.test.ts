/**
 * @jest-environment jsdom
 */
// tests/search/search-cache-category.test.ts
// Search-cache category-delivery fix. A cache HIT (repeat identical search within the same
// tab) used to restore rawProducts/serverTotal and return early — skipping the exact code
// path that computes effectiveCategory — silently starving a category-gated campaign (e.g.
// Amazon Campaign V1) on a repeat search. The fix stores the server's ORIGINAL resolved
// category alongside the cached results, so a cache hit can re-run the SAME
// explicit>resolved>null precedence rule (resolveEffectiveCategory) against it, without ever
// re-classifying the query text locally.
import { getSearchCache, setSearchCache, resolveEffectiveCategory } from '@/app/[locale]/(public)/search/search-client';
import { isCampaignEligible } from '@/lib/campaigns/eligibility';
import type { AffiliateCampaign } from '@/lib/campaigns/types';

const CACHE_KEY = 'search_results_cache';
const product = (id: string) => ({ id, title: `p-${id}` } as unknown as never);

// Same fixture shape as tests/campaigns/category-resolution-delivery-fix.test.ts — does NOT
// reproduce the real campaign's tracking_id/destination_url, which this fix must not touch.
function makeTabletCampaign(): AffiliateCampaign {
  return {
    id: 'test-tablet-campaign',
    merchant: 'amazon',
    title_ar: 'عنوان', title_en: 'Title',
    cta_ar: 'استعرض العرض', cta_en: 'View offer',
    destination_url: 'https://www.amazon.sa/s?k=test',
    tracking_id: null,
    categories: ['tablet'],
    placement: 'post_search',
    enabled: true,
    start_at: '2026-09-02T13:36:52.663Z',
    end_at: '2027-03-02T13:29:41.401Z',
    verified_at: null,
    source: 'test',
    disclosure_ar: 'مادة إعلانية • رابط عمولة', disclosure_en: 'Advertisement • Commission link',
    is_test: true,
    created_by: null,
    created_at: '2026-09-02T13:29:42.529Z',
    updated_at: '2026-09-02T13:36:53.756Z',
  };
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('search cache — resolvedCategory contract', () => {
  it('A/B. round trip: a cached response restores the SAME resolvedCategory the original API response produced', () => {
    // Uncached (first) search: query -> resolvedCategory=tablet -> effectiveCategory=tablet
    const uncachedEffective = resolveEffectiveCategory('all', 'tablet');
    expect(uncachedEffective).toBe('tablet');

    // Write the cache exactly as the fetch handler does after that first search.
    setSearchCache('تابلت هونر', 'all', 'tablet', [product('1')], 41);

    // Cached (repeat) search restore.
    const cached = getSearchCache();
    expect(cached).not.toBeNull();
    expect(cached!.resolvedCategory).toBe('tablet');
    const cachedEffective = resolveEffectiveCategory('all', cached!.resolvedCategory);
    expect(cachedEffective).toBe('tablet');

    // Same query + same cached response context -> same resolvedCategory -> same effectiveCategory.
    expect(cachedEffective).toBe(uncachedEffective);
  });

  it('D. explicit category selection still overrides the cached resolved category', () => {
    setSearchCache('تابلت هونر', 'all', 'tablet', [product('1')], 41);
    const cached = getSearchCache()!;
    // Shopper had explicitly picked "laptop" via a filter by the time this cache is read.
    expect(resolveEffectiveCategory('laptop', cached.resolvedCategory)).toBe('laptop');
  });

  it('E. a cached ambiguous query (server resolved nothing) remains unknown, never fabricated', () => {
    setSearchCache('شيء غريب', 'all', null, [product('1')], 3);
    const cached = getSearchCache()!;
    expect(cached.resolvedCategory).toBeNull();
    expect(resolveEffectiveCategory('all', cached.resolvedCategory)).toBeNull();
  });

  it('F. a legacy cache entry written before this fix (no resolvedCategory field at all) fails safely to null, never a guess', () => {
    // Simulates a sessionStorage entry from the OLD setSearchCache signature/shape.
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      query: 'تابلت هونر', category: 'all', products: [product('1')], total: 41, timestamp: Date.now(),
    }));
    const cached = getSearchCache();
    expect(cached).not.toBeNull();
    expect(cached!.resolvedCategory).toBeNull();
    expect(resolveEffectiveCategory('all', cached!.resolvedCategory)).toBeNull();
    // The pre-existing fields must still restore correctly — this is purely additive.
    expect(cached!.query).toBe('تابلت هونر');
    expect(cached!.total).toBe(41);
    expect(cached!.products).toHaveLength(1);
  });

  it('G. the cached products/total (the actual search results) are byte-identical in and out — this is metadata-only', () => {
    const products = [product('1'), product('2'), product('3')];
    setSearchCache('تابلت هونر', 'all', 'tablet', products, 41);
    const cached = getSearchCache()!;
    expect(cached.products).toEqual(products);
    expect(cached.total).toBe(41);
    expect(cached.query).toBe('تابلت هونر');
    expect(cached.category).toBe('all');
  });

  it('a malformed/corrupt cache entry never throws and never fabricates a category', () => {
    sessionStorage.setItem(CACHE_KEY, 'not valid json{{{');
    expect(getSearchCache()).toBeNull();
  });
});

describe('search cache — campaign eligibility on cache hit (item C)', () => {
  const campaign = makeTabletCampaign();
  const now = new Date('2026-09-04T12:00:00Z');
  const ctx = (category: string | null) => ({
    now, placement: 'post_search' as const, category,
    globalEnabled: true, allowedMerchants: new Set<'amazon' | 'noon'>(['amazon']),
  });

  it('a repeat "تابلت هونر" search restored entirely from cache still makes the tablet campaign eligible', () => {
    // First (uncached) search wrote this cache entry, exactly as setSearchCache is called
    // in the fetch handler.
    setSearchCache('تابلت هونر', 'all', 'tablet', [product('1')], 41);

    // Repeat search hits the cache-restore branch — no fetch, no local re-classification.
    const cached = getSearchCache()!;
    const effectiveCategory = resolveEffectiveCategory('all', cached.resolvedCategory);

    expect(effectiveCategory).toBe('tablet');
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(true);
  });

  it('a legacy cache entry (no resolvedCategory) restores to an ineligible campaign, never a fabricated eligibility', () => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      query: 'تابلت هونر', category: 'all', products: [product('1')], total: 41, timestamp: Date.now(),
    }));
    const cached = getSearchCache()!;
    const effectiveCategory = resolveEffectiveCategory('all', cached.resolvedCategory);
    expect(effectiveCategory).toBeNull();
    expect(isCampaignEligible(campaign, ctx(effectiveCategory))).toBe(false);
  });
});
