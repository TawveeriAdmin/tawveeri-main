import type { ScrapedSearchResult } from './search-types';

interface CacheEntry {
  data: ScrapedSearchResult;
  timestamp: number;
}

/**
 * Simple in-memory cache for search results
 * Cache key format: scrape:{query}:{stores}:{pages}
 */
class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number; // Time to live in milliseconds

  constructor(ttlSeconds: number = 600) {
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Generate cache key from search parameters
   */
  private getKey(query: string, stores: string[], pages: number): string {
    const storesKey = stores.sort().join(',');
    return `scrape:${query.toLowerCase().trim()}:${storesKey}:${pages}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(query: string, stores: string[], pages: number): ScrapedSearchResult | null {
    const key = this.getKey(query, stores, pages);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store result in cache
   */
  set(query: string, stores: string[], pages: number, data: ScrapedSearchResult): void {
    const key = this.getKey(query, stores, pages);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create singleton instance
const cacheEnabled = process.env.SCRAPE_CACHE_ENABLED === 'true';
const cacheTtl = parseInt(process.env.SCRAPE_CACHE_TTL || '600', 10);
const searchCache = cacheEnabled ? new SearchCache(cacheTtl) : null;

// Clean expired entries every 5 minutes
if (searchCache) {
  setInterval(() => {
    searchCache.clearExpired();
  }, 5 * 60 * 1000);
}

export { searchCache };
export type { SearchCache };


