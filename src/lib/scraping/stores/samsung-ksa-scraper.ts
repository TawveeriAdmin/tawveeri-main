import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
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

  async discoverProducts(category: ProductCategory, maxPages: number = 1): Promise<ScrapedProduct[]> {
    const urls = await fetchSamsungSitemapUrls(category);
    const limit = Math.max(1, maxPages) * 12;
    const products: ScrapedProduct[] = [];

    for (const url of urls.slice(0, limit)) {
      try {
        const product = await this.updateProductPrice(url);
        if (product) products.push(product);
      } catch (error) {
        console.warn(`[Samsung KSA] sitemap product failed: ${url}`, error instanceof Error ? error.message : error);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return products;
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

const SAMSUNG_SITEMAPS_BY_CATEGORY: Partial<Record<ProductCategory, string[]>> = {
  smartphone: ['https://www.samsung.com/sa_en/im-sitemap.xml'],
  tablet: ['https://www.samsung.com/sa_en/im-sitemap.xml'],
  wearable: ['https://www.samsung.com/sa_en/im-sitemap.xml'],
  accessories: ['https://www.samsung.com/sa_en/im-sitemap.xml'],
  tv: ['https://www.samsung.com/sa_en/vd-sitemap.xml'],
  monitor: ['https://www.samsung.com/sa_en/vd-sitemap.xml'],
  // Galaxy Buds are genuine standalone earbud PRODUCTS, not accessories — they live under
  // im-sitemap.xml's `/audio-sound/galaxy-buds/` (4 path segments, already shape-valid),
  // separate from vd-sitemap.xml's `/audio-devices/` (soundbars/sound towers). Both sitemaps
  // are searched; the category-path filter below keeps them from bleeding into each other.
  audio: ['https://www.samsung.com/sa_en/vd-sitemap.xml', 'https://www.samsung.com/sa_en/im-sitemap.xml'],
  appliance: ['https://www.samsung.com/sa_en/da-sitemap.xml'],
  // Samsung KSA official catalog closure mission (2026-09-12): vacuum cleaners are a real,
  // current, standalone consumer line — `da-sitemap.xml` carries 2 genuine PDPs
  // (`/vacuum-cleaners/stick/bespoke-jet-ai-...`, `/vacuum-cleaners/stick/vs9000rl-...`) plus
  // one correctly-excluded `/compare/` page. The prior "pure accessory/vacuum lines are
  // excluded" note below predates this mission's explicit requirement (§9) to cover vacuum
  // cleaners as a core category — this is a scope correction, not a re-litigation of that
  // decision. Matches the TPS layer's existing `vacuum` category (category-registry.ts).
  vacuum: ['https://www.samsung.com/sa_en/da-sitemap.xml'],
};

/**
 * Samsung shares ONE sitemap file across several unrelated product lines (im-sitemap.xml
 * alone mixes smartphones/tablets/watches/rings/mobile-accessories under one file — measured
 * live: 165 smartphone URLs, 197 tablet, 45 watch, 35 ring, 378 mobile-accessories, all in the
 * same 839-URL document). `isSamsungKsaProductUrl` only checks that a URL is SHAPED like a
 * product page — without this filter, `discoverProducts`'s alphabetical slice returns whatever
 * sorts first in the shared file, which is never actually "smartphones" (e.g. requesting
 * `smartphone` returned Galaxy Buds — `audio-sound` sorts before `smartphones` alphabetically).
 * One path-segment allowlist per category line, so each request only ever sees its own line.
 * appliance is bounded to the residential lines the platform's categories cover — commercial
 * `system-air-conditioners` (VRF/ducted building systems, not consumer) is deliberately
 * excluded, same bounded-category pattern as `NextjsSsrConfig.categoryKeywords`
 * (ADR-179/219). Vacuum cleaners get their own `vacuum` line (added 2026-09-12) rather than
 * folding into `appliance` — a separate TPS category already exists for it.
 */
const CATEGORY_PATH_FILTERS: Partial<Record<ProductCategory, RegExp>> = {
  smartphone: /\/smartphones\//i,
  tablet: /\/tablets\//i,
  wearable: /\/(watches|rings)\//i,
  tv: /\/(tvs|lifestyle-tvs|commercial-tvs)\//i,
  monitor: /\/monitors\//i,
  audio: /\/(audio-devices|audio-sound\/galaxy-buds)\//i,
  appliance: /\/(air-conditioners|home-appliances|washers-and-dryers|refrigerators|dishwashers|cooking-appliances|microwave-ovens)\//i,
  accessories: /\/(mobile-accessories|tv-accessories|home-appliance-accessories|display-accessories|projector-accessories|audio-accessories)\//i,
  vacuum: /\/vacuum-cleaners\//i,
};

// Samsung KSA official-catalog closure mission (2026-09-12): only HIGH-VALUE standalone
// accessories are worth ingesting now (founder-named examples: SmartTag, standalone S Pen —
// Galaxy Buds are already a genuine separate `audio` line, not filtered here). All 378 of
// Samsung's `mobile-accessories` sitemap URLs pass the path filter above, and the great
// majority are exactly the low-value long-tail the mission says must not consume it (cases,
// chargers, cables, screen protectors). Filtered by name at the URL-slug level — cheap,
// avoids fetching hundreds of PDPs to find ~23 that matter — not a full accessory-catalog
// ingestion. Broader accessory expansion (cases, chargers, etc.) is out of scope, unchanged.
// Exported so scripts/seed-samsung-ksa-sitemap.ts's unified (category-agnostic) sweep can
// apply the exact same scope decision instead of drifting from it.
export const HIGH_VALUE_ACCESSORY_SLUG = /\/mobile-accessories\/.*(smarttag|s-pen)/i;

/**
 * All of Samsung's `mobile-accessories` PDP URLs are exactly 3 path segments
 * (`/sa_en/mobile-accessories/PRODUCT-SLUG/`), one shallower than every other category's
 * `/sa_en/CATEGORY/FAMILY/PRODUCT-SLUG/` shape. This check used a flat `parts.length < 4`
 * floor and silently rejected ALL of them — including the founder-named high-value
 * standalone accessories (SmartTag, S Pen) — found while re-auditing source coverage for
 * this mission. Every one of the 378 sampled terminals is a genuine product slug (verified:
 * none match a generic/index word), so detecting the accessory path shape directly (rather
 * than requiring an explicit category argument neither caller always has — this function is
 * also reused by the category-agnostic seed script) and relaxing to 3 segments only for it
 * carries negligible false-positive risk; every other path shape keeps the 4-segment floor.
 *
 * Exported (was module-private) so `scripts/seed-samsung-ksa-sitemap.ts` can import this
 * instead of keeping its own second, independently-drifting copy — the exact defect class
 * this mission spent most of its time finding elsewhere in the same file.
 */
export function isSamsungKsaProductUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!/samsung\.com$/i.test(parsed.hostname)) return false;
  const parts = parsed.pathname.split('/').filter(Boolean);
  const minSegments = /\/mobile-accessories\//i.test(parsed.pathname) ? 3 : 4;
  if (parts.length < minSegments) return false;
  if (parts[0].toLowerCase() !== 'sa_en') return false;

  const terminal = parts[parts.length - 1].toLowerCase();
  if (!terminal || NON_PRODUCT_SLUGS.has(terminal)) return false;
  if (terminal.startsWith('all-') || terminal.startsWith('see-all')) return false;

  return true;
}

async function fetchSamsungSitemapUrls(category: ProductCategory): Promise<string[]> {
  const sitemapUrls = SAMSUNG_SITEMAPS_BY_CATEGORY[category] ?? [];
  const pathFilter = CATEGORY_PATH_FILTERS[category];
  const urlSet = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchXml(sitemapUrl);
    for (const loc of extractLocs(xml)) {
      const cleaned = loc.replace(/["\\\s]+$/, '').trim();
      if (!isSamsungKsaProductUrl(cleaned)) continue;
      if (pathFilter && !pathFilter.test(cleaned)) continue;
      if (category === 'accessories' && !HIGH_VALUE_ACCESSORY_SLUG.test(cleaned)) continue;
      urlSet.add(cleaned);
    }
  }

  return Array.from(urlSet).sort();
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/xml, text/xml, */*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

function extractLocs(xml: string): string[] {
  return (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((match) => match.replace(/<\/?loc>/g, '').trim());
}

const NON_PRODUCT_SLUGS = new Set([
  'compare',
  'buying-guide',
  'tips',
  'learn-about',
  'explore',
  'all',
  'overview',
  'offers',
  'see-all',
  'index',
]);

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
