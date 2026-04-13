import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import type { FirecrawlDemoProduct } from '@/lib/firecrawl/types';
import { FIRECRAWL_DEMO_SITES, type FirecrawlSiteConfig } from '@/lib/firecrawl/sites';
import { scrapeWebsite } from '@/lib/firecrawl/client';
import { extractTopProducts } from '@/lib/firecrawl/parser';
import { extractNumericPriceFromText } from '@/lib/firecrawl/price-utils';
import { isValidFirecrawlProduct } from '@/lib/firecrawl/validation';

const PRODUCTS_PER_SITE = 5;

function firecrawlConcurrency(): number {
  const raw = process.env.FIRECRAWL_CONCURRENCY;
  if (!raw) return 4;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 4;
  return Math.min(n, 10);
}

/** EN query tokens → extra substrings to match in AR/EN titles (appliance / electronics). */
const QUERY_TOKEN_ALIASES: Record<string, string[]> = {
  washing: ['washing', 'washer', 'washers', 'غسالة', 'غساله', 'غسالات'],
  machine: ['machine', 'machines', 'automatic', 'اوتوماتيك', 'اتوماتيك'],
  dryer: ['dryer', 'dryers', 'نشافة', 'مجفف', 'تجفيف'],
  fridge: ['fridge', 'refrigerator', 'freezer', 'ثلاجة', 'فريزر'],
  laptop: ['laptop', 'notebooks', 'لابتوب', 'كمبيوتر'],
  phone: ['phone', 'phones', 'mobile', 'smartphone', 'iphone', 'جوال', 'هاتف', 'هواتف'],
  tv: ['tv', 'television', 'oled', 'qled', 'تلفزيون', 'شاشة'],
};

function tokenMatchesTitle(token: string, titleLower: string, titleRaw: string): boolean {
  const lower = token.toLowerCase();
  if (titleLower.includes(lower) || titleRaw.includes(token)) return true;
  const aliases = QUERY_TOKEN_ALIASES[lower];
  if (aliases) {
    return aliases.some((a) => titleLower.includes(a.toLowerCase()) || titleRaw.includes(a));
  }
  return false;
}

function titleMatchesQuery(title: string, query: string): boolean {
  const t = title.trim();
  const q = query.trim();
  if (!q || !t) return false;

  const tokens = q.split(/\s+/).filter((x) => x.length > 1);
  if (tokens.length === 0) {
    return t.toLowerCase().includes(q.toLowerCase()) || t.includes(q);
  }

  const titleLower = t.toLowerCase();
  const threshold = tokens.length <= 3 ? tokens.length : Math.ceil(tokens.length / 2);
  let hits = 0;
  for (const token of tokens) {
    if (tokenMatchesTitle(token, titleLower, t)) hits += 1;
  }
  if (hits >= threshold) return true;

  // Relaxed: any substantive token (≥3 chars) matches — helps EN vs AR listings.
  if (tokens.length <= 4) {
    for (const token of tokens) {
      if (token.length >= 3 && tokenMatchesTitle(token, titleLower, t)) return true;
    }
  }
  return false;
}

function resolveScrapeUrl(site: FirecrawlSiteConfig, query: string): string {
  const built = site.buildSearchUrl?.(query.trim());
  if (built && built.length > 0) return built;
  return site.url;
}

function absolutize(maybeRelative: string, baseUrl: string): string {
  const t = maybeRelative.trim();
  if (!t) return '';
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return '';
  }
}

function normalizeProductKey(productUrl: string): string {
  try {
    const u = new URL(productUrl);
    u.hash = '';
    if (u.pathname.endsWith('/') && u.pathname.length > 1) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return productUrl;
  }
}

/** When parser falls back to listing URL, many rows share one URL — dedupe by title+price instead. */
function urlsSameDocument(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    ua.hash = '';
    ub.hash = '';
    return ua.href === ub.href;
  } catch {
    return false;
  }
}

function productDedupeKey(
  demo: { productUrl: string; title: string; priceText: string },
  scrapeUrl: string,
): string {
  if (urlsSameDocument(demo.productUrl, scrapeUrl)) {
    return `listing:${demo.title.toLowerCase().slice(0, 120)}|${demo.priceText}`;
  }
  return normalizeProductKey(demo.productUrl);
}

/**
 * Maps Firecrawl v2 `data.json` to demo rows (absolute URLs).
 */
export function parseExtractedProducts(
  extracted: Record<string, unknown> | null,
  baseUrl: string,
): FirecrawlDemoProduct[] {
  if (!extracted) return [];
  const products = extracted.products;
  if (!Array.isArray(products)) return [];

  const out: FirecrawlDemoProduct[] = [];
  for (const raw of products) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    if (!title) continue;

    const priceText =
      typeof o.price_text === 'string'
        ? o.price_text.trim()
        : o.price_text != null
          ? String(o.price_text).trim()
          : '';

    let productUrl = '';
    if (typeof o.product_url === 'string' && o.product_url.trim()) {
      productUrl = absolutize(o.product_url.trim(), baseUrl);
    }
    if (!productUrl) continue;

    let imageUrl: string | undefined;
    if (typeof o.image_url === 'string' && o.image_url.trim()) {
      const img = absolutize(o.image_url.trim(), baseUrl);
      if (img) imageUrl = img;
    }

    out.push({
      title: title.slice(0, 180),
      priceText: priceText || 'N/A',
      productUrl,
      imageUrl,
    });
  }
  return out;
}

function toSearchProduct(
  site: FirecrawlSiteConfig,
  demo: {
    title: string;
    priceText: string;
    productUrl: string;
    imageUrl?: string;
  },
): SearchProduct {
  const price = extractNumericPriceFromText(demo.priceText);
  return {
    name_ar: demo.title,
    name_en: demo.title,
    brand: '',
    model: '',
    sku: null,
    current_price: price,
    original_price: null,
    availability: 'in_stock',
    product_url: demo.productUrl,
    image_urls: demo.imageUrl ? [demo.imageUrl] : [],
    specifications: {},
    category: 'electronics',
    description_ar: null,
    description_en: null,
    store: site.slug,
    store_name: site.nameEn,
  };
}

function toGrouped(site: FirecrawlSiteConfig, sp: SearchProduct): GroupedSearchProduct {
  return {
    name_ar: sp.name_ar,
    name_en: sp.name_en,
    brand: sp.brand,
    model: sp.model,
    sku: sp.sku,
    current_price: sp.current_price,
    original_price: sp.original_price,
    availability: sp.availability,
    product_url: sp.product_url,
    image_urls: sp.image_urls,
    specifications: sp.specifications,
    category: sp.category,
    description_ar: sp.description_ar,
    description_en: sp.description_en,
    stores: [sp],
    best_price: sp.current_price,
    store_count: 1,
  };
}

type SiteBatchResult = {
  groups: GroupedSearchProduct[];
  errors: Record<string, string>;
  storeCounts: Record<string, number>;
  creditsExhausted: boolean;
};

async function enrichOneSite(site: FirecrawlSiteConfig, query: string): Promise<SiteBatchResult> {
  const groups: GroupedSearchProduct[] = [];
  const errors: Record<string, string> = {};
  const storeCounts: Record<string, number> = {};
  let creditsExhausted = false;

  const scrapeUrl = resolveScrapeUrl(site, query);
  const scrape = await scrapeWebsite(scrapeUrl);
  if (!scrape.ok) {
    if (scrape.status === 'credits_exhausted') creditsExhausted = true;
    errors[`firecrawl:${site.slug}`] = scrape.error || scrape.status;
    return { groups, errors, storeCounts, creditsExhausted };
  }

  const seenKeys = new Set<string>();
  let added = 0;

  const fromJson = parseExtractedProducts(scrape.extractedJson, scrapeUrl);
  for (const demo of fromJson) {
    if (added >= PRODUCTS_PER_SITE) break;
    if (!titleMatchesQuery(demo.title, query)) continue;
    if (!isValidFirecrawlProduct(demo, scrapeUrl)) continue;
    const key = productDedupeKey(demo, scrapeUrl);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    groups.push(toGrouped(site, toSearchProduct(site, demo)));
    added += 1;
  }

  if (added < PRODUCTS_PER_SITE) {
    const fallback = extractTopProducts(
      scrape.markdown,
      scrape.links,
      scrapeUrl,
      PRODUCTS_PER_SITE,
    );
    for (const demo of fallback) {
      if (added >= PRODUCTS_PER_SITE) break;
      if (!titleMatchesQuery(demo.title, query)) continue;
      if (!isValidFirecrawlProduct(demo, scrapeUrl)) continue;
      const key = productDedupeKey(demo, scrapeUrl);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      groups.push(toGrouped(site, toSearchProduct(site, demo)));
      added += 1;
    }
  }

  if (added > 0) {
    storeCounts[site.slug] = added;
  }

  return { groups, errors, storeCounts, creditsExhausted };
}

/**
 * Fetches listing/search pages via Firecrawl v2 (markdown + links + JSON extract),
 * up to PRODUCTS_PER_SITE validated items per site, query-matched.
 * Sites are processed in parallel batches to cap wall-clock time.
 */
export async function fetchFirecrawlSearchGroups(query: string): Promise<{
  groups: GroupedSearchProduct[];
  errors: Record<string, string>;
  storeCounts: Record<string, number>;
}> {
  const groups: GroupedSearchProduct[] = [];
  const errors: Record<string, string> = {};
  const storeCounts: Record<string, number> = {};

  const chunkSize = firecrawlConcurrency();
  const sites = FIRECRAWL_DEMO_SITES;
  let stopAfterCredits = false;

  for (let i = 0; i < sites.length; i += chunkSize) {
    if (stopAfterCredits) break;
    const batch = sites.slice(i, i + chunkSize);
    const batchResults = await Promise.all(batch.map((site) => enrichOneSite(site, query)));

    for (const r of batchResults) {
      groups.push(...r.groups);
      Object.assign(errors, r.errors);
      for (const [slug, count] of Object.entries(r.storeCounts)) {
        storeCounts[slug] = (storeCounts[slug] || 0) + count;
      }
      if (r.creditsExhausted) stopAfterCredits = true;
    }
  }

  return { groups, errors, storeCounts };
}
