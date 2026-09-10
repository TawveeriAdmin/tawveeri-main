import type { ScrapedProduct } from '../base/types';
import { determineCategory } from '../utils/category-utils';
import { extractNoonSku } from '../stores/noon-scraper';

/**
 * Noon managed-provider retrieval layer (Noon Managed Data Source Proof mission,
 * 2026-09-10). Noon runs Akamai Bot Manager (confirmed directly — ADR-333, the block
 * page itself references errors.edgesuite.net) and blocked every direct-infrastructure
 * path Tawveeri tried, including a genuine residential-proxy browser session (ADR-333).
 * No safe, evasion-free direct fix exists. This wraps the Apify Actor
 * `saswave/noon-product-scraper`, live-benchmarked against 18 known Noon SKUs pulled from
 * production (ADR-334): 100% fetch success, 100% SKU identity match, 100% confirmed Saudi
 * market (en-sa return-policy URL) on every item with an active offer, honest empty-offer
 * reporting (not fabricated prices) for delisted/out-of-stock items.
 *
 * TRANSPORT ONLY — this module returns the SAME ScrapedProduct shape every other Noon
 * path already produces. It does not touch normalization, identity, ranking, or the
 * affiliate link; those stay exactly as they are (get-comparison.ts, product-service.ts,
 * the provider registry's existing `param` network). Apify is replaceable in place: if
 * Noon later ships an official feed, only this file changes.
 */

const ACTOR_ID = 'saswave~noon-product-scraper';
const APIFY_RUN_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

export interface ApifyOffer {
  price?: number | null;
  sale_price?: number | null;
  stock?: number | null;
  is_buyable?: boolean;
  store_name?: string | null;
  return_policy?: { url?: string | null };
}

export interface ApifyVariant {
  offers?: ApifyOffer[];
}

export interface ApifySpec {
  code?: string;
  name?: string;
  value?: unknown;
}

export interface ApifyItem {
  sku?: string;
  product_title?: string;
  brand?: string;
  long_description?: string | null;
  specifications?: ApifySpec[];
  image_urls?: string[];
  variants?: ApifyVariant[];
  product_rating?: { value?: number; count?: number };
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

/**
 * Only a Saudi (`/en-sa/`) return-policy URL counts as market-confirmed. Noon's Apify
 * actors cover UAE/Egypt too (§ "CRITICAL MARKET VALIDATION" — HTTP 200 alone is never
 * proof); a non-Saudi or unconfirmable item is dropped rather than trusted (unknown beats
 * incorrect), even though this specific actor call is always issued with Saudi URLs.
 */
export function isConfirmedSaudi(offer: ApifyOffer | undefined): boolean {
  const url = offer?.return_policy?.url ?? '';
  return url.includes('/en-sa/') || url.includes('noon.com/en-sa');
}

export function mapItemToScrapedProduct(item: ApifyItem, requestedUrl: string): ScrapedProduct | null {
  const offer = item.variants?.[0]?.offers?.[0];
  if (!offer) return null; // no active offer — genuinely unavailable, not a fabricated price
  if (!isConfirmedSaudi(offer)) return null; // market not provably Saudi — drop, don't guess

  const price = offer.sale_price ?? offer.price ?? null;
  if (price == null || !Number.isFinite(price)) return null;
  const originalPrice = offer.sale_price != null && offer.price != null && offer.price !== offer.sale_price
    ? offer.price
    : null;

  const stock = offer.stock ?? null;
  const availability: ScrapedProduct['availability'] = !offer.is_buyable
    ? 'out_of_stock'
    : stock != null && stock <= 3
      ? 'limited_stock'
      : 'in_stock';

  const title = item.product_title || '';
  const brand = item.brand || 'Unknown';
  const model = (() => {
    let m = title;
    if (brand && brand !== 'Unknown') m = m.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
    return m.split(' ').slice(0, 4).join(' ') || title;
  })();

  const specifications: Record<string, unknown> = {};
  for (const spec of item.specifications ?? []) {
    const key = spec.code || spec.name;
    if (key) specifications[key] = spec.value;
  }

  return {
    name_ar: title,
    name_en: title,
    brand,
    model,
    sku: item.sku ?? extractNoonSku(requestedUrl),
    current_price: price,
    original_price: originalPrice,
    availability,
    product_url: requestedUrl,
    image_urls: item.image_urls ?? [],
    specifications,
    category: determineCategory(title),
    description_ar: null,
    description_en: stripHtml(item.long_description),
    stock_quantity: stock,
    merchant_rating: item.product_rating?.value ?? null,
    merchant_review_count: item.product_rating?.count ?? null,
  };
}

/**
 * Fetches current price/availability for a batch of already-known Noon product URLs in
 * ONE Apify run (measured: 18 URLs in ~18s, vs. per-URL calls which would each pay a
 * separate actor-startup cost). Returns a Map keyed by the EXACT requested URL so the
 * caller can look up results positionally — matching by SKU internally, since Apify's
 * dataset order is not guaranteed to match input order.
 */
export async function fetchNoonProductsBatch(productUrls: string[]): Promise<Map<string, ScrapedProduct | null>> {
  const result = new Map<string, ScrapedProduct | null>(productUrls.map((u) => [u, null]));
  if (productUrls.length === 0) return result;

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn('[apify-noon-provider] APIFY_API_TOKEN not set — every URL in this batch fails closed');
    return result;
  }

  const skuToUrl = new Map<string, string>();
  for (const url of productUrls) {
    const sku = extractNoonSku(url);
    if (sku) skuToUrl.set(sku, url);
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.APIFY_NOON_TIMEOUT_MS || 180000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${APIFY_RUN_URL}?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_urls: productUrls }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[apify-noon-provider] run failed: HTTP ${res.status}`);
      return result;
    }
    const items = (await res.json()) as ApifyItem[];
    for (const item of items) {
      if (!item.sku) continue;
      const url = skuToUrl.get(item.sku) ?? skuToUrl.get(item.sku.replace(/-\d+$/, ''));
      if (!url) continue;
      result.set(url, mapItemToScrapedProduct(item, url));
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('[apify-noon-provider] batch fetch error:', err instanceof Error ? err.message : err);
  }
  return result;
}
