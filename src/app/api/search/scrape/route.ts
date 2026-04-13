import { NextRequest, NextResponse } from 'next/server';
import { searchAllStores, sortGroupedProducts } from '@/lib/scraping/search/search-orchestrator';
import { searchCache } from '@/lib/scraping/cache';
import { filterTechProducts } from '@/lib/scraping/product-filter';
import { DEFAULT_SEARCH_STORES, normalizeSearchStores } from '@/lib/scraping/search/store-registry';
import { fetchFirecrawlSearchGroups } from '@/lib/firecrawl/search-enrichment';

/**
 * POST /api/search/scrape
 * Search for products across stores using TypeScript scrapers
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { query, stores, pages, sort, category } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 },
      );
    }

    const normalizedStores = normalizeSearchStores(stores);
    const normalizedPages = pages || 1;
    const normalizedSort = sort || 'relevance';

    console.log(`[Scrape API] Search request: query="${query}", stores=${normalizedStores.join(',')}, pages=${normalizedPages}`);

    // Check cache
    if (searchCache) {
      const cachedResult = searchCache.get(query.trim(), normalizedStores, normalizedPages);
      if (cachedResult) {
        console.log(`[Scrape API] Cache HIT for query="${query}"`);
        return NextResponse.json(cachedResult, {
          headers: { 'X-Cache-Status': 'HIT' },
        });
      }
      console.log(`[Scrape API] Cache MISS for query="${query}"`);
    }

    // Run TypeScript scrapers directly
    const result = await searchAllStores(query.trim(), normalizedStores, normalizedPages, normalizedSort, category || undefined);

    // Merge Firecrawl listing extractions (same URLs as demo), query-matched, up to 5 per site
    if (process.env.FIRECRAWL_API_KEY) {
      try {
        const fcStart = Date.now();
        console.log(`[Scrape API] Firecrawl enrichment starting for query="${query.trim()}"`);
        const { groups: fcGroups, errors: fcErrors, storeCounts: fcStoreCounts } =
          await fetchFirecrawlSearchGroups(query.trim());
        console.log(
          `[Scrape API] Firecrawl enrichment done in ${Date.now() - fcStart}ms (groups=${fcGroups.length})`,
        );

        const urlSet = new Set<string>();
        for (const g of result.products) {
          urlSet.add(g.product_url);
          for (const s of g.stores) urlSet.add(s.product_url);
        }
        const deduped = fcGroups.filter((g) => !urlSet.has(g.product_url));

        if (deduped.length > 0) {
          result.products = [...deduped, ...result.products];
          for (const [slug, count] of Object.entries(fcStoreCounts)) {
            result.storeResults[slug] = (result.storeResults[slug] || 0) + count;
          }
          sortGroupedProducts(result.products, normalizedSort, query.trim(), new Map());
          const prices = result.products.map((p) => p.best_price).filter((p) => p > 0);
          result.priceStats = {
            min: prices.length > 0 ? Math.min(...prices) : null,
            max: prices.length > 0 ? Math.max(...prices) : null,
            avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
          };
        }

        if (Object.keys(fcErrors).length > 0) {
          result.errors = { ...(result.errors || {}), ...fcErrors };
        }
      } catch (fcErr) {
        console.warn('[Scrape API] Firecrawl enrichment failed:', fcErr);
        result.errors = {
          ...(result.errors || {}),
          firecrawl: fcErr instanceof Error ? fcErr.message : 'Firecrawl enrichment failed',
        };
      }
    }

    // Filter non-tech products
    const originalCount = result.products.length;
    result.products = filterTechProducts(result.products);
    result.count = result.products.length;

    if (originalCount !== result.count) {
      console.log(`[Scrape API] Filtered ${originalCount - result.count} non-tech products (${originalCount} -> ${result.count})`);
    }

    const pricesFinal = result.products.map((p) => p.best_price).filter((p) => p > 0);
    result.priceStats = {
      min: pricesFinal.length > 0 ? Math.min(...pricesFinal) : null,
      max: pricesFinal.length > 0 ? Math.max(...pricesFinal) : null,
      avg: pricesFinal.length > 0 ? pricesFinal.reduce((a, b) => a + b, 0) / pricesFinal.length : null,
    };

    const recount: Record<string, number> = {};
    for (const g of result.products) {
      for (const s of g.stores) {
        recount[s.store] = (recount[s.store] || 0) + 1;
      }
    }
    result.storeResults = recount;

    // Store in cache
    if (searchCache) {
      searchCache.set(query.trim(), normalizedStores, normalizedPages, result);
    }

    const duration = Date.now() - startTime;
    console.log(`[Scrape API] Search completed: ${result.count} products found in ${duration}ms (${result.searchTime}s)`);
    if (result.errors && Object.keys(result.errors).length > 0) {
      console.warn(`[Scrape API] Store errors:`, result.errors);
    }

    return NextResponse.json(result, {
      headers: { 'X-Cache-Status': 'MISS' },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Scrape API] Error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/search/scrape
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: 'typescript',
    stores: DEFAULT_SEARCH_STORES,
  });
}
