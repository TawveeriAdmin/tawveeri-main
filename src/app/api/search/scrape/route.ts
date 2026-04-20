import { NextRequest, NextResponse } from 'next/server';
import { searchAllStores } from '@/lib/scraping/search/search-orchestrator';
import { searchCache } from '@/lib/scraping/cache';
import { filterTechProducts } from '@/lib/scraping/product-filter';
import { DEFAULT_SEARCH_STORES } from '@/lib/scraping/search/store-registry';
import { getRequestUserProfile } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

export const maxDuration = 240;
export const dynamic = 'force-dynamic';

/**
 * Return the subset of stores that have is_live_search_enabled=true on their
 * schedule. Non-admins can only invoke live scrape for these stores.
 */
async function getPubliclyAllowedStores(): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('scraping_schedules')
    .select('stores:store_id (slug), is_live_search_enabled')
    .eq('is_live_search_enabled', true);

  const slugs = new Set<string>();
  for (const row of (data ?? []) as unknown as Array<{ stores: { slug: string } | null }>) {
    if (row.stores?.slug) slugs.add(row.stores.slug);
  }
  return Array.from(slugs);
}

/**
 * POST /api/search/scrape
 * Search for products across stores using TypeScript scrapers
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { query, pages, sort, category } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 },
      );
    }

    // Admins can hit every configured scraper. Non-admins can only run live
    // search against stores that have is_live_search_enabled=true on their
    // schedule. If none are allowlisted, reject.
    const profile = await getRequestUserProfile(request);
    const isAdmin = profile?.role === 'admin';

    let normalizedStores: string[];
    if (isAdmin) {
      normalizedStores = [...DEFAULT_SEARCH_STORES];
    } else {
      const allowed = await getPubliclyAllowedStores();
      if (allowed.length === 0) {
        return NextResponse.json(
          { disabled: true, error: 'Live search is disabled. Results come from the catalog only.' },
          { status: 403 },
        );
      }
      normalizedStores = allowed;
    }
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
