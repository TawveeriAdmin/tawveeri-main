import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';
import { FIRECRAWL_DEMO_SITES, type FirecrawlSiteConfig } from '@/lib/firecrawl/sites';
import { scrapeWebsite } from '@/lib/firecrawl/client';
import { extractTopProducts } from '@/lib/firecrawl/parser';
import { extractNumericPriceFromText } from '@/lib/firecrawl/price-utils';

const PRODUCTS_PER_SITE = 5;

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
    const lower = token.toLowerCase();
    if (titleLower.includes(lower) || t.includes(token)) hits += 1;
  }
  return hits >= threshold;
}

function toSearchProduct(site: FirecrawlSiteConfig, demo: {
  title: string;
  priceText: string;
  productUrl: string;
  imageUrl?: string;
}): SearchProduct {
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

/**
 * Fetches listing pages via Firecrawl, extracts up to PRODUCTS_PER_SITE items per site,
 * keeps only rows whose title matches the search query, returns GroupedSearchProduct[].
 */
export async function fetchFirecrawlSearchGroups(query: string): Promise<{
  groups: GroupedSearchProduct[];
  errors: Record<string, string>;
  storeCounts: Record<string, number>;
}> {
  const groups: GroupedSearchProduct[] = [];
  const errors: Record<string, string> = {};
  const storeCounts: Record<string, number> = {};

  let creditsExhausted = false;

  for (const site of FIRECRAWL_DEMO_SITES) {
    if (creditsExhausted) break;

    const scrape = await scrapeWebsite(site.url);
    if (!scrape.ok) {
      if (scrape.status === 'credits_exhausted') creditsExhausted = true;
      errors[`firecrawl:${site.slug}`] = scrape.error || scrape.status;
      continue;
    }

    const demos = extractTopProducts(scrape.markdown, scrape.links, site.url, PRODUCTS_PER_SITE);
    let added = 0;
    for (const demo of demos) {
      if (!titleMatchesQuery(demo.title, query)) continue;
      const sp = toSearchProduct(site, demo);
      groups.push(toGrouped(site, sp));
      added += 1;
    }
    if (added > 0) {
      storeCounts[site.slug] = (storeCounts[site.slug] || 0) + added;
    }
  }

  return { groups, errors, storeCounts };
}
