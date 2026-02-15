import { NextRequest, NextResponse } from 'next/server';
import { searchCache } from '@/lib/scraping/cache';

/**
 * POST /api/search/scrape/clear-cache
 * Clear the scraping cache
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check for admin users
    // const authHeader = request.headers.get('authorization');
    // if (!isAdmin(authHeader)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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
export async function GET() {
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


