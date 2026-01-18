import type { ProductCategory } from '@/lib/database/types';

/**
 * Normalize URL to absolute URL
 */
export function normalizeUrl(url: string, baseUrl: string): string {
  if (!url) return baseUrl;

  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Remove leading slash if baseUrl ends with slash
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = url.startsWith('/') ? url : `/${url}`;

  return `${base}${path}`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

/**
 * Build category URL with pagination
 */
export function buildCategoryUrl(
  baseUrl: string,
  category: ProductCategory,
  page: number = 1
): string {
  // This is a template - actual implementation depends on each store's URL structure
  // Store-specific scrapers should override this
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/category/${category}?page=${page}`;
}

