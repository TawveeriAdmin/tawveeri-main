import type { ScrapedProduct } from '../base/types';
import { loadStoreConfig } from '../config/scraper-config';
import { determineCategory } from '../utils/category-utils';
import { GenericHtmlStoreScraper } from './generic-html-store-scraper';

/**
 * Samsung KSA scraper.
 *
 * Samsung's PDPs render server-side and ship a schema.org Product JSON-LD
 * block containing name, sku, brand, price, availability, image, description,
 * and aggregateRating. No Puppeteer needed for detail extraction (which
 * matters because Puppeteer is unreliable on the current dev host).
 *
 * Discovery uses the site's sitemap — see scripts/seed-samsung-ksa-sitemap.ts.
 * This class overrides `updateProductPrice` so both the dispatched cron path
 * AND the sitemap seed script can pull rich data from the same call.
 */
export class SamsungKsaScraper extends GenericHtmlStoreScraper {
  constructor() {
    super(loadStoreConfig('samsung_ksa'));
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    // Errors propagate so the seed script can distinguish "real problem"
    // (caught in its try/catch → trigger rate-limit cooldown) from "page
    // fetched OK but has no purchase price" (returned null → skip quietly).
    // Archive SKUs (legacy AC models) return null without logging an error.
    //
    // Plain fetch — bypasses the config's requires_js flag that would
    // otherwise route this through Puppeteer. Samsung's SSR + JSON-LD
    // makes JS rendering unnecessary, and avoiding Puppeteer keeps this
    // scraper usable on hosts where Chrome for Testing misbehaves.
    const html = await this.fetchPage(productUrl);
    const $ = this.getCheerio(html);

    const productLd = findProductJsonLd($);
    if (!productLd) return null;

    const name = String(productLd.name || '').trim();
    if (!name || name.length < 3) return null;

    const offers = (productLd.offers as Record<string, unknown> | undefined) || {};
    const currentPrice = toNumber(offers.price);
    if (!currentPrice || currentPrice <= 0) return null;

    // Samsung sometimes ships highPrice as the crossed-out original.
    let originalPrice = toNumber(
      (offers as { highPrice?: unknown; listPrice?: unknown }).highPrice
      ?? (offers as { listPrice?: unknown }).listPrice,
    );
    if (originalPrice !== null && originalPrice <= currentPrice) {
      originalPrice = null;
    }

    // Brand — Samsung's JSON-LD nests brand as `{@id, name}` sometimes,
    // plain string other times.
    const brandRaw = productLd.brand as Record<string, unknown> | string | undefined;
    const brand = typeof brandRaw === 'string'
      ? brandRaw.trim()
      : (typeof brandRaw?.name === 'string' ? brandRaw.name.trim() : 'Samsung');

    const sku = typeof productLd.sku === 'string' && productLd.sku.trim()
      ? productLd.sku.trim()
      : (typeof productLd.mpn === 'string' ? productLd.mpn : null);

    const availability = parseLdAvailability(offers.availability);

    // aggregateRating is on the Product root (Samsung's shape) OR nested
    // under offers (Extra/spec-compliant shape). Try both.
    const agg = (productLd.aggregateRating
      ?? offers.aggregateRating) as Record<string, unknown> | undefined;
    const ratingValue = toNumber(agg?.ratingValue);
    const rawCount = agg?.reviewCount ?? agg?.ratingCount;
    const reviewCount = typeof rawCount === 'string'
      ? parseInt(rawCount.replace(/[^0-9]/g, ''), 10) || null
      : (typeof rawCount === 'number' ? Math.round(rawCount) : null);
    const merchantRating = ratingValue !== null && ratingValue >= 0 && ratingValue <= 5
      ? Number(ratingValue.toFixed(2))
      : null;
    // Treat "0/0" as "no rating" so Tawveeri doesn't render misleading zeros.
    const hasRating = merchantRating !== null && (merchantRating > 0 || (reviewCount ?? 0) > 0);

    // Image: JSON-LD's `image` is a single URL string. Samsung's gallery
    // lives in HTML (different DOM blocks per product family) — for the
    // initial seed we take the JSON-LD primary image and skip the gallery.
    // A later HTML-extraction pass can backfill the rest.
    const imageUrl = typeof productLd.image === 'string' ? productLd.image.trim() : '';
    const imageUrls = imageUrl ? [imageUrl] : [];

    const description = typeof productLd.description === 'string'
      ? productLd.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
      : null;

    // Locale-route description: Samsung's /sa_en/ PDPs are in English;
    // /sa/ or /sa_ar/ would be Arabic. updateEnrichedFields' fill-if-empty
    // merge lets a future run on the other locale fill the missing side.
    const isArabicUrl = /\/sa(_ar)?\//i.test(productUrl) && !/\/sa_en\//i.test(productUrl);

    return {
      name_ar: name,
      name_en: name,
      brand,
      model: sku || name,
      sku,
      current_price: currentPrice,
      original_price: originalPrice,
      availability,
      product_url: productUrl,
      image_urls: imageUrls,
      specifications: {},
      category: determineCategory(name),
      description_ar: isArabicUrl ? description : null,
      description_en: isArabicUrl ? null : description,
      merchant_rating: hasRating ? merchantRating : null,
      merchant_review_count: hasRating ? reviewCount : null,
    };
  }
}

// ── Local JSON-LD helpers ──────────────────────────────────────────────────
// Duplicated from ExtraScraper for now. When Almanea gets the same
// treatment, lift these into src/lib/scraping/utils/json-ld-extractor.ts.

import type * as cheerio from 'cheerio';

function findProductJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw || !raw.includes('"Product"')) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const hit = pickProductNode(parsed);
      if (hit) return hit;
    } catch {
      /* skip malformed block */
    }
  }
  return null;
}

function pickProductNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = pickProductNode(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
    return obj;
  }
  const graph = obj['@graph'];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const hit = pickProductNode(item);
      if (hit) return hit;
    }
  }
  return null;
}

function parseLdAvailability(val: unknown): ScrapedProduct['availability'] {
  if (typeof val !== 'string') return 'in_stock';
  const v = val.toLowerCase();
  if (v.includes('outofstock')) return 'out_of_stock';
  if (v.includes('limitedavailability') || v.includes('limited')) return 'limited_stock';
  if (v.includes('preorder')) return 'pre_order';
  return 'in_stock';
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? null : n;
}
