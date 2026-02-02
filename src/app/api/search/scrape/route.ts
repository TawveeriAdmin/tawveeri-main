import { NextRequest, NextResponse } from 'next/server';
import type { PythonSearchResponse } from '@/lib/scraping/python-types';
import type { ScrapedSearchResult } from '@/lib/scraping/search-types';
import { mapPythonProductToScrapedProduct } from '@/lib/scraping/python-mapper';
import { searchCache } from '@/lib/scraping/cache';
import { filterTechProducts } from '@/lib/scraping/product-filter';

/**
 * POST /api/search/scrape
 * Search for products using Python scraping service
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const { query, stores, pages, sort } = body;

    // Validate input
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const normalizedStores = stores || ['amazon', 'noon', 'jarir'];
    const normalizedPages = pages || 1;
    const normalizedSort = sort || 'price_asc';

    // Log request
    console.log(`[Scrape API] Search request: query="${query}", stores=${normalizedStores.join(',')}, pages=${normalizedPages}`);

    // Check cache first
    if (searchCache) {
      const cachedResult = searchCache.get(query.trim(), normalizedStores, normalizedPages);
      if (cachedResult) {
        console.log(`[Scrape API] Cache HIT for query="${query}"`);
        return NextResponse.json(cachedResult, {
          headers: {
            'X-Cache-Status': 'HIT',
          },
        });
      }
      console.log(`[Scrape API] Cache MISS for query="${query}"`);
    }

    // Get Flask API URL from environment
    // Use 127.0.0.1 for server-side fetch (localhost might not work in some environments)
    const flaskUrl = process.env.FLASK_API_URL || 'http://127.0.0.1:5000';
    const timeout = 120000; // 120 seconds timeout
    
    console.log(`[Scrape API] Calling Flask at ${flaskUrl}/search`);
    
    // Note: Health check removed to avoid delays - we'll handle errors in the main request

    // Prepare request to Flask
    const requestBody = {
      query: query.trim(),
      stores: normalizedStores,
      pages: normalizedPages,
      sort: normalizedSort,
    };

    // Call Flask service with retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let flaskResponse: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(500 * attempt, 2000);
          console.log(`[Scrape API] Retry attempt ${attempt}/${maxRetries} after ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        flaskResponse = await fetch(`${flaskUrl}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        
        // Success - break out of retry loop
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof Error && error.name === 'AbortError') {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Request timeout - scraping took too long' },
            { status: 504 }
          );
        }
        
        // If this was the last attempt, return error
        if (attempt >= maxRetries) {
          clearTimeout(timeoutId);
          const errorMsg = lastError.message || 'Unknown error';
          console.error(`[Scrape API] Network error after ${maxRetries + 1} attempts:`, errorMsg);
          return NextResponse.json(
            { 
              error: 'Failed to connect to scraping service after multiple attempts. Is Flask running?',
              details: errorMsg,
              flaskUrl: flaskUrl,
              hint: 'Make sure Flask is running: npm run flask:start'
            },
            { status: 503 }
          );
        }
      }
    }
    
    clearTimeout(timeoutId);
    
    if (!flaskResponse) {
      return NextResponse.json(
        { 
          error: 'Failed to get response from scraping service',
          details: lastError?.message || 'Unknown error',
          flaskUrl: flaskUrl
        },
        { status: 503 }
      );
    }

    // Handle Flask response
    if (!flaskResponse.ok) {
      let errorData: any = {};
      try {
        const text = await flaskResponse.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // If response is not JSON, use status text
        errorData = { error: flaskResponse.statusText || 'Scraping service error' };
      }
      
      console.error(`[Scrape API] Flask error ${flaskResponse.status}:`, errorData);
      
      // Provide helpful error messages based on status code
      let errorMessage = errorData.error || `Scraping service error (${flaskResponse.status})`;
      if (flaskResponse.status === 403) {
        errorMessage = 'Access denied by scraping service. This usually means Flask is not running or CORS is blocking the request. Please start Flask with: npm run flask:start';
      } else if (flaskResponse.status === 404) {
        errorMessage = 'Scraping service endpoint not found. Please check Flask configuration and ensure it\'s running.';
      } else if (flaskResponse.status >= 500) {
        errorMessage = 'Scraping service internal error. Please check Flask logs for details.';
      }
      
      // Try to read response text for debugging
      let responseText = '';
      try {
        const text = await flaskResponse.clone().text();
        responseText = text;
      } catch (e) {
        responseText = 'Unable to read response';
      }
      
      console.error(`[Scrape API] Flask returned ${flaskResponse.status}:`, {
        error: errorMessage,
        details: errorData,
        flaskUrl: flaskUrl,
        responseText: responseText.substring(0, 200) // Limit length
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorData,
          status: flaskResponse.status,
          flaskUrl: flaskUrl,
          hint: flaskResponse.status === 403 ? 'Start Flask with: npm run flask:start' : undefined
        },
        { status: flaskResponse.status }
      );
    }

    // Parse Flask response
    const pythonData: PythonSearchResponse = await flaskResponse.json();

    // Map Python response to TypeScript format
    let mappedProducts = pythonData.products.map(mapPythonProductToScrapedProduct);
    
    // Debug: Check Jarir products for images
    const jarirProducts = mappedProducts.filter(p => (p as any).store === 'jarir');
    if (jarirProducts.length > 0) {
      const jarirWithImages = jarirProducts.filter(p => p.image_urls && p.image_urls.length > 0);
      const jarirWithoutImages = jarirProducts.filter(p => !p.image_urls || p.image_urls.length === 0);
      console.log(`[Scrape API] Jarir products: ${jarirProducts.length} total, ${jarirWithImages.length} with images, ${jarirWithoutImages.length} without images`);
      if (jarirWithoutImages.length > 0) {
        console.log(`[Scrape API] Jarir products without images:`, jarirWithoutImages.slice(0, 3).map(p => ({
          title: p.name_en?.substring(0, 50),
          image_urls: p.image_urls,
          store: (p as any).store
        })));
      }
    }
    
    // Filter out non-tech products (e.g., books, food items when searching "apple")
    const originalCount = mappedProducts.length;
    mappedProducts = filterTechProducts(mappedProducts);
    const filteredCount = mappedProducts.length;
    
    if (originalCount !== filteredCount) {
      console.log(`[Scrape API] Filtered ${originalCount - filteredCount} non-tech products (${originalCount} → ${filteredCount})`);
    }

    // Build response
    const result: ScrapedSearchResult = {
      products: mappedProducts,
      count: pythonData.count,
      query: pythonData.query,
      storeResults: pythonData.store_results,
      priceStats: pythonData.price_stats,
      searchTime: pythonData.search_time,
      errors: pythonData.errors,
    };

    // Store in cache
    if (searchCache) {
      searchCache.set(query.trim(), normalizedStores, normalizedPages, result);
    }

    const duration = Date.now() - startTime;
    console.log(`[Scrape API] Search completed: ${result.count} products found in ${duration}ms (Flask: ${pythonData.search_time}s)`);
    if (pythonData.errors && Object.keys(pythonData.errors).length > 0) {
      console.warn(`[Scrape API] Store errors:`, pythonData.errors);
    }

    return NextResponse.json(result, {
      headers: {
        'X-Cache-Status': 'MISS',
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Scrape API] Error after ${duration}ms:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/scrape
 * Health check endpoint
 */
export async function GET() {
  const flaskUrl = process.env.FLASK_API_URL || 'http://127.0.0.1:5000';
  
  try {
    const response = await fetch(`${flaskUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        status: 'ok',
        flask: data,
      });
    } else {
      return NextResponse.json(
        { status: 'error', message: 'Flask service not healthy' },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Flask service not available',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

