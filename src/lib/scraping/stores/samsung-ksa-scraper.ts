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

    const baseName = String(productLd.name || '').trim();
    if (!baseName || baseName.length < 3) return null;

    // SKU first — we use it as the final title disambiguator.
    const sku = typeof productLd.sku === 'string' && productLd.sku.trim()
      ? productLd.sku.trim()
      : (typeof productLd.mpn === 'string' ? productLd.mpn : null);

    // Title composition. Samsung's JSON-LD ships the SAME `name` for every
    // color / storage / regional SKU of a product family (e.g. "Galaxy S23+"
    // appears on 6+ variants, each with a different price). Without a
    // distinguishing suffix, ProductMatcher collapses them all into one
    // product row based on title+brand.
    //
    // Two layers of disambiguation:
    //   1. URL-slug tokens (color + storage + screen size) → human-readable
    //      suffix like "Cream 512GB" or "65" Smart Tv".
    //   2. SKU in parentheses at the end → catches the residual cases where
    //      two SKUs share identical URL-visible attributes but differ in
    //      regional / carrier / modem codes. Samsung distinguishes these
    //      internally (different prices are common).
    //
    // The /buy/ URL twin of any base URL carries the exact same JSON-LD
    // SKU and the exact same slug tokens, so it still collapses correctly
    // into a single product row via ProductMatcher.
    const variantSuffix = extractVariantSuffix(productUrl, baseName);
    const withVariant = variantSuffix ? `${baseName} ${variantSuffix}` : baseName;
    const name = sku ? `${withVariant} (${sku})` : withVariant;

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

/**
 * Pull variant tokens (color, storage, size) out of a Samsung product URL
 * slug so we can append them to the product name and keep variants
 * distinct in the ProductMatcher.
 *
 * Example — URL: `/sa_en/smartphones/galaxy-s/galaxy-s23-plus-cream-512gb-sm-s916bzecmea/`
 *           title: `"Galaxy S23+"`
 *           → returns `"512GB Cream"`
 *
 * Algorithm:
 *   1. Take the last path segment (skip trailing `/buy/` if present).
 *   2. Drop the Samsung SKU tail. SKUs have two shapes we handle:
 *      • a prefixed pair like `sm-s911bzkamea` → strip from the first
 *        prefix token onwards
 *      • a glued token like `qa65q60cauxsa` or `ua43du7000uxsa` → strip
 *        the single token that matches the prefix+digits+alpha pattern
 *   3. Remove hyphenated words that are already in the title (so we don't
 *      double-print "Galaxy S23 Plus" as both the base and the variant).
 *   4. Stitch adjacent `<number>-inch` / `<number>-mm` back into one token
 *      so "65-inch" becomes "65Inch".
 *   5. Uppercase storage/size tokens (128GB, 1TB, 65INCH), title-case
 *      color tokens (Cream, Graphite, Phantom, Black).
 */
export function extractVariantSuffix(productUrl: string, title: string): string {
  try {
    const parsed = new URL(productUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';

    let slug = parts[parts.length - 1];
    if (slug === 'buy' && parts.length >= 2) slug = parts[parts.length - 2];
    if (!slug) return '';

    let tokens = slug.split('-').filter(Boolean);

    // Drop SKU-prefix variants: -sm-…, -qa-…, -ua-… etc.
    // First of these prefix tokens marks the start of the SKU tail.
    const SKU_PREFIX_TOKENS = new Set([
      'sm', 'qa', 'ua', 'qe', 'hw', 'ls', 'fa', 'vs', 'dv', 'ww', 'wf', 'wt',
      'wd', 'rl', 'rt', 'rs', 'rf', 'rb', 'rh', 'rz', 'mc', 'mg', 'bn',
    ]);
    const prefixIdx = tokens.findIndex((t) => SKU_PREFIX_TOKENS.has(t.toLowerCase()));
    if (prefixIdx !== -1) tokens = tokens.slice(0, prefixIdx);

    // Drop SKUs that render as one glued token: e.g. `qa65q60cauxsa`.
    // Heuristic: token ≥8 chars AND contains both letters and digits AND
    // doesn't match a well-known non-SKU pattern (pure digits, storage
    // units, "inch", etc.).
    tokens = tokens.filter((t) => {
      if (/^\d+$/.test(t)) return true;
      if (/^\d+(gb|tb|mm)$/i.test(t)) return true;
      if (/^(inch|mm)$/i.test(t)) return true;
      if (t.length < 8) return true;
      const hasLetter = /[a-z]/i.test(t);
      const hasDigit = /\d/.test(t);
      return !(hasLetter && hasDigit);
    });

    // Strip tokens already present in the base title so we don't echo them.
    // Use a normalized-substring check (lowercased, alphanumerics only) so
    // that glued slug tokens like "40mm" still match a title that writes
    // them as "40 mm" (with a space). Falls back to hyphen-split word
    // matching for everything else.
    const titleNormalized = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const titleWords = new Set(
      title
        .toLowerCase()
        .replace(/\+/g, '-plus')
        .replace(/[^a-z0-9-]/g, '-')
        .split('-')
        .filter(Boolean),
    );
    tokens = tokens.filter((t) => {
      const lc = t.toLowerCase();
      if (titleWords.has(lc)) return false;
      // Only use substring match for tokens long enough that a false positive
      // is unlikely (3+ chars).
      if (lc.length >= 3 && titleNormalized.includes(lc)) return false;
      return true;
    });

    // Re-merge "<N>-inch" / "<N>-mm" pairs into one token.
    const merged: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length && /^\d+$/.test(tokens[i]) && /^(inch|mm)$/i.test(tokens[i + 1])) {
        merged.push(tokens[i] + tokens[i + 1]);
        i++;
      } else {
        merged.push(tokens[i]);
      }
    }

    if (merged.length === 0) return '';

    return merged
      .map((t) => {
        if (/^\d+(gb|tb|mm)$/i.test(t)) return t.toUpperCase();
        if (/^\d+inch$/i.test(t)) return t.replace(/inch$/i, '"');
        if (/^\d+$/.test(t)) return t;
        return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      })
      .join(' ');
  } catch {
    return '';
  }
}
