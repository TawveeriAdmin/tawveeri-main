import { NextRequest, NextResponse } from 'next/server';
import { searchAllStores } from '@/lib/scraping/search/search-orchestrator';
import { searchCache } from '@/lib/scraping/cache';
import { filterTechProducts } from '@/lib/scraping/product-filter';

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

    const normalizedStores = stores || ['amazon', 'noon', 'jarir'];
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
    stores: ['amazon', 'noon', 'jarir', 'extra'],
  });
}
