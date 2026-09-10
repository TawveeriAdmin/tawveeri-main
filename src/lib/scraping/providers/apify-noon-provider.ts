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

/**
 * Pinned to the exact build this integration was proven against (ADR-334/335 benchmark),
 * not Apify's mutable `latest` tag — saswave is third-party/community-maintained, and an
 * upstream schema change must never silently reach production. Verified via GET
 * /v2/acts/{actorId} → taggedBuilds.latest.buildNumber (only one build exists today,
 * "0.0.3", so pinning costs nothing now and protects against a future silent one).
 *
 * Upgrade flow when saswave ships a new build: run a small shadow batch against THAT
 * build via the same fetchNoonProductsBatch with an explicit override, diff its output
 * against this pinned build's known-good shape (schema fields present, price/SKU/market
 * still validate), and only then bump this constant — never follow `latest` automatically.
 */
const PINNED_ACTOR_BUILD = '0.0.3';

/**
 * Cost guards (Noon Apify production scale-up mission, 2026-09-10 — founder's explicit
 * financial gate: "a bug must not accidentally request an unlimited catalog run").
 *
 * MAX_BATCH_SIZE: a Tawveeri-side hard cap independent of Apify's own limits — a
 * misconfigured `max_products` param on the price-update cron can never balloon into one
 * giant, expensive Apify call. 250 is comfortably above any cadence tier this mission
 * designed (HOT/WARM/COLD, see ADR-335) and small enough that even a full-price mistake
 * costs cents, not dollars.
 *
 * PER_ITEM_COST_CEILING_USD: saswave's actual measured rate on this account's current
 * (FREE) Apify plan is $0.002/result (verified via GET /v2/users/me/usage/monthly after
 * live runs — NOT the $0.0008 GOLD-tier rate cited before this account's plan was
 * confirmed). This ceiling is set well above that measured rate so it only trips on a
 * genuine anomaly (e.g. the actor's own pricing changing upstream), not on normal
 * variance — Apify's `maxTotalChargeUsd` HARD-STOPS the run and charges nothing beyond
 * the cap, per Apify's own run-sync API contract.
 */
const MAX_BATCH_SIZE = 250;
const PER_ITEM_COST_CEILING_USD = 0.01;

export interface ApifyOffer {
  price?: number | null;
  sale_price?: number | null;
  stock?: number | null;
  is_buyable?: boolean;
  store_name?: string | null;
  offer_code?: string | null;
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

/**
 * Extracts the `?o=<offer_code>` Noon uses to deep-link a shopper to a SPECIFIC seller's
 * offer (Noon commerce data truth mission, price-contract review, 2026-09-10). Every
 * Tawveeri-stored Noon `product_url` carries one.
 */
export function extractOfferCode(url: string): string | null {
  return url.match(/[?&]o=([^&]+)/)?.[1] ?? null;
}

/** Sets (or replaces) the `?o=` offer-code param on a Noon URL, without disturbing anything else. */
export function withOfferCode(url: string, offerCode: string): string {
  if (/[?&]o=[^&]*/.test(url)) {
    return url.replace(/([?&])o=[^&]*/, `$1o=${offerCode}`);
  }
  return url.includes('?') ? `${url}&o=${offerCode}` : `${url}?o=${offerCode}`;
}

/**
 * A Noon SKU is a MARKETPLACE listing — the founder's price-contract review found up to 8
 * competing seller offers per SKU in a single 18-item sample, 9/18 (50%) with 2+ offers,
 * at genuinely different prices (measured spread e.g. 579–639 SAR on one SKU). Taking
 * `offers[0]` blindly is not a rule, it is array-order luck — exactly the defect this
 * review was built to catch before scale-up.
 *
 * Correct rule: prefer the offer whose `offer_code` matches what Tawveeri's stored URL
 * already points to (truth-in-advertising — the price shown must be the price the /go
 * exit actually lands on). Only when that offer has rotated away (no longer returned,
 * or a page never carried one) does the CURRENT cheapest currently-buyable offer win —
 * matching what a shopper landing on Noon's own page would see. Never selects a
 * non-buyable offer. Returns null when nothing is buyable (unknown beats incorrect).
 */
export function selectBestOffer(
  offers: ApifyOffer[],
  requestedOfferCode: string | null,
): { offer: ApifyOffer; matchedRequestedOffer: boolean } | null {
  const buyable = offers.filter((o) => o.is_buyable);
  if (buyable.length === 0) return null;

  if (requestedOfferCode) {
    const matched = buyable.find((o) => o.offer_code === requestedOfferCode);
    if (matched) return { offer: matched, matchedRequestedOffer: true };
  }

  const effectivePrice = (o: ApifyOffer) => o.sale_price ?? o.price ?? Number.POSITIVE_INFINITY;
  const cheapest = [...buyable].sort((a, b) => effectivePrice(a) - effectivePrice(b))[0];
  return { offer: cheapest, matchedRequestedOffer: false };
}

/**
 * Schema-contract safety (production scale-up mission, 2026-09-10): treat saswave's
 * response as an external contract, not a trusted internal shape. `variants` being an
 * ARRAY (even empty) is the normal "no active offer / delisted" case, measured live —
 * `variants` being MISSING entirely, or `product_title` being absent, is a materially
 * different signal: the actor's own response shape changed upstream. Distinguishing these
 * lets health monitoring alert on `ACTOR_SCHEMA_CHANGED` specifically, instead of that
 * silently blending into the ordinary "delisted" bucket.
 */
export function detectSchemaDrift(item: ApifyItem): string | null {
  if (!item.product_title) return 'MISSING_REQUIRED_FIELD: product_title';
  if (!Array.isArray(item.variants)) return 'MISSING_REQUIRED_FIELD: variants (not an array)';
  return null;
}

export function mapItemToScrapedProduct(item: ApifyItem, requestedUrl: string): ScrapedProduct | null {
  const schemaIssue = detectSchemaDrift(item);
  if (schemaIssue) {
    console.error(`[apify-noon-provider] ACTOR_SCHEMA_CHANGED for sku=${item.sku ?? 'unknown'}: ${schemaIssue}`);
    return null; // fail closed — never guess at a changed upstream shape
  }

  const requestedOfferCode = extractOfferCode(requestedUrl);
  const selection = selectBestOffer(item.variants?.[0]?.offers ?? [], requestedOfferCode);
  if (!selection) {
    // NO_ACTIVE_OFFER — a real commercial state (delisted / all offers unbuyable), not a
    // scraper failure. Logged distinctly so a health check can separate this from a
    // genuine retrieval problem (Noon Apify scale-up mission, §5 outcome classification).
    console.log(`[apify-noon-provider] NO_ACTIVE_OFFER sku=${item.sku ?? 'unknown'}`);
    return null;
  }
  const { offer, matchedRequestedOffer } = selection;
  if (!isConfirmedSaudi(offer)) {
    console.error(`[apify-noon-provider] WRONG_MARKET sku=${item.sku ?? 'unknown'} return_policy_url=${offer.return_policy?.url ?? 'none'}`);
    return null; // market not provably Saudi — drop, don't guess
  }

  // The offer rotated away from what Tawveeri's stored URL pointed to — quote the NEW
  // offer's own URL so the /go exit and the displayed price stay consistent going
  // forward, rather than silently drifting apart. Noon's own `?o=` convention.
  const productUrl = matchedRequestedOffer || !offer.offer_code
    ? requestedUrl
    : withOfferCode(requestedUrl, offer.offer_code);

  const price = offer.sale_price ?? offer.price ?? null;
  if (price == null || !Number.isFinite(price)) return null;
  const originalPrice = offer.sale_price != null && offer.price != null && offer.price !== offer.sale_price
    ? offer.price
    : null;

  // selectBestOffer only ever returns a buyable offer (never selects is_buyable: false) —
  // a non-buyable single offer already returned null above, so this is always in_stock or
  // limited_stock, never out_of_stock.
  const stock = offer.stock ?? null;
  const availability: ScrapedProduct['availability'] = stock != null && stock <= 3 ? 'limited_stock' : 'in_stock';

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
    product_url: productUrl,
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
  if (productUrls.length > MAX_BATCH_SIZE) {
    // Fail closed and LOUD rather than silently truncate or silently spend more than
    // intended — a batch this large was never a deliberate cadence decision.
    console.error(`[apify-noon-provider] batch of ${productUrls.length} exceeds MAX_BATCH_SIZE (${MAX_BATCH_SIZE}) — refusing, not truncating silently`);
    return new Map(productUrls.map((u) => [u, null]));
  }

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
    // Apify's own native run-level cost guards (docs.apify.com/api/v2/act-run-sync-get-
    // dataset-items-post): maxItems caps charged results at exactly what was requested;
    // maxTotalChargeUsd is a hard spend ceiling the platform itself enforces — the run
    // stops and nothing beyond the cap is charged, independent of any bug on Tawveeri's
    // side or a pricing change upstream in the actor.
    const maxTotalChargeUsd = (productUrls.length * PER_ITEM_COST_CEILING_USD).toFixed(4);
    const params = new URLSearchParams({
      token,
      build: PINNED_ACTOR_BUILD,
      maxItems: String(productUrls.length),
      maxTotalChargeUsd,
    });
    const res = await fetch(`${APIFY_RUN_URL}?${params}`, {
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
    let mapped = 0;
    for (const item of items) {
      if (!item.sku) {
        console.error('[apify-noon-provider] SKU_MISMATCH: item returned with no sku at all');
        continue;
      }
      const url = skuToUrl.get(item.sku) ?? skuToUrl.get(item.sku.replace(/-\d+$/, ''));
      if (!url) {
        console.error(`[apify-noon-provider] SKU_MISMATCH: returned sku=${item.sku} matches none of the ${productUrls.length} requested URLs`);
        continue;
      }
      const scraped = mapItemToScrapedProduct(item, url);
      result.set(url, scraped);
      if (scraped) mapped++;
    }
    // Health summary line (§19) — greppable via `railway logs`, the same pattern this
    // codebase already uses ([price-quarantine], [egress-probe-report]) rather than a new
    // monitoring system: PRODUCTS_REQUESTED, PRODUCTS_RETRIEVED, ACTIVE_OFFERS in one line.
    console.log(`[apify-noon-provider] batch summary: requested=${productUrls.length} retrieved=${items.length} active_offers=${mapped}`);
  } catch (err) {
    clearTimeout(timeout);
    console.error('[apify-noon-provider] ACTOR_FAILURE:', err instanceof Error ? err.message : err);
  }
  return result;
}
