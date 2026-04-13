import { extractNumericPriceFromText } from '@/lib/firecrawl/price-utils';

/** True if the string looks like a URL or hostname path, not a product name. */
export function isUrlLikeTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t)) return true;
  if (/\s*:\/\/\s*/.test(t)) return true;
  // Domain-like token with path
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(t)) return true;
  return false;
}

export function isAllowedProductUrl(productUrl: string, baseUrl: string): boolean {
  try {
    const u = new URL(productUrl);
    const b = new URL(baseUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.hostname === b.hostname) return true;
    if (u.hostname.endsWith(`.${b.hostname}`)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isValidHttpsImageUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidFirecrawlProduct(
  demo: {
    title: string;
    priceText: string;
    productUrl: string;
    imageUrl?: string;
  },
  baseUrl: string,
): boolean {
  const title = demo.title?.trim() ?? '';
  if (!title || title.length > 200) return false;
  if (isUrlLikeTitle(title)) return false;
  if (extractNumericPriceFromText(demo.priceText) <= 0) return false;
  if (!isAllowedProductUrl(demo.productUrl, baseUrl)) return false;
  if (demo.imageUrl && !isValidHttpsImageUrl(demo.imageUrl)) return false;
  return true;
}
