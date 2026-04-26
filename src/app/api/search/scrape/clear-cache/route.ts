import { NextRequest, NextResponse } from 'next/server';
import { searchCache } from '@/lib/scraping/cache';
import { requireRequestAdmin } from '@/lib/auth/api-auth';

/**
 * POST /api/search/scrape/clear-cache
 * Clear the scraping cache. Admin-only because the cache belongs to the live
 * scraper surface.
 */
export async function POST(request: NextRequest) {
  try {
    try {
      await requireRequestAdmin(request);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Admin access required' },
        { status: 403 },
      );
    }

    if (searchCache) {
      searchCache.clear();
      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Cache is not enabled',
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/scrape/clear-cache
 * Get cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin access required' },
      { status: 403 },
    );
  }

  if (searchCache) {
    const stats = searchCache.getStats();
    return NextResponse.json({
      enabled: true,
      ...stats,
    });
  } else {
    return NextResponse.json({
      enabled: false,
      message: 'Cache is not enabled',
    });
  }
}

