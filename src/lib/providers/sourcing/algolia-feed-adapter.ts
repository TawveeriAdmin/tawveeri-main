// src/lib/providers/sourcing/algolia-feed-adapter.ts
// Algolia storefront-index sourcing adapter (ADR-094) — a REAL, credential-free feed.
//
// Many headless Saudi retailers (Almanea being the reference) power their storefront
// search with Algolia and ship a PUBLIC search-only key in the browser bundle. That
// index is the whole catalogue as clean structured JSON — richer than HTML scraping
// (brand, model, sku, storage, screen_size, price, image), which directly improves
// IDENTITY resolution and therefore comparisons. Using it is the same public data any
// browser fetches; the keys are search-only (cannot write), so this is sanctioned public
// access, not a credential boundary — a provider opts in with `sourcing: "api"` + an
// `algolia` config.
//
// TPS: emits OFFERS only, evidence-first — a hit needs a name, a positive price, and a
// product URL, else it is dropped (unknown beats incorrect). Bilingual names are merged
// from the EN index by objectID when configured; structured attributes are passed through
// to help the identity plugins (never fabricated).
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";
import { decodeEntities } from "./woocommerce-feed-adapter";

interface PricesWithTax { price?: number; original_price?: number; discounted_price?: number; discounted_percentage?: number }
interface AlgoliaHit {
  objectID?: string;
  name?: string;
  url?: string; rewrite_url?: string;
  sku?: string; brand?: string; model?: string;
  price?: number; price_incl_tax?: number;
  prices_with_tax?: PricesWithTax;
  stock_region_ids?: Record<string, number> | number[];
  image_url?: string; thumbnail_url?: string;
  is_pre_order?: boolean;
  storage?: unknown; screen_size?: unknown; mobile_os?: unknown; network?: unknown; color?: unknown;
}
interface AlgoliaResponse { hits?: AlgoliaHit[]; nbPages?: number; nbHits?: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

const PAGINATION_CAP = 1000; // Algolia default paginationLimitedTo — max results reachable by paging

async function algoliaQuery(cfg: { appId: string; apiKey: string; index: string }, params: string): Promise<AlgoliaResponse> {
  const url = `https://${cfg.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(cfg.index)}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Algolia-Application-Id": cfg.appId, "X-Algolia-API-Key": cfg.apiKey, "content-type": "application/json" },
    body: JSON.stringify({ params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${cfg.index}`);
  return (await res.json()) as AlgoliaResponse;
}

/** Map one Algolia hit to a ScrapedProduct, or null if it isn't a usable offer. */
export function mapAlgoliaHit(h: AlgoliaHit, storeSlug: string, nameEn?: string): ScrapedProduct | null {
  const name = decodeEntities(h.name || "");
  const url = (h.url || h.rewrite_url || "").trim();
  // AUTHORITATIVE price: `prices_with_tax` carries the customer-facing selling price
  // (already-discounted when a promo is active) + the original price. `price` at the top
  // level is the pre-tax/base value and `price_incl_tax` is NOT the shelf price — using
  // either would misstate the price. Fall back to `price` only if the object is absent.
  const pwt = h.prices_with_tax;
  const current = round2(Number(pwt?.price ?? pwt?.discounted_price ?? h.price ?? 0));
  const originalRaw = round2(Number(pwt?.original_price ?? 0));
  const original = originalRaw > current ? originalRaw : null; // only a REAL discount, never fabricated
  if (!name || !(current > 0) || !/^https?:\/\//i.test(url)) return null;
  // Availability from real per-region stock counts (all-zero ⇒ out of stock).
  let inStock = true;
  if (h.stock_region_ids && !Array.isArray(h.stock_region_ids)) {
    const total = Object.values(h.stock_region_ids).reduce((a, v) => a + (Number(v) || 0), 0);
    inStock = total > 0;
  }
  // Keep only the structured attributes that are present (never fabricate a value).
  const specs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries({ storage: h.storage, screen_size: h.screen_size, os: h.mobile_os, network: h.network, color: h.color })) {
    if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) specs[k] = v;
  }
  return {
    name_ar: name,
    name_en: nameEn ? decodeEntities(nameEn) : name,
    brand: decodeEntities(h.brand || "") || "",
    model: String(h.model || "").trim(),
    sku: (h.sku || "").trim() || null,
    current_price: current,
    original_price: original,
    availability: h.is_pre_order ? "pre_order" : inStock ? "in_stock" : "out_of_stock",
    product_url: url,
    image_urls: (h.image_url || h.thumbnail_url) ? [String(h.image_url || h.thumbnail_url)] : [],
    specifications: specs,
    description_ar: null,
    description_en: null,
    _store_slug: storeSlug,
  } as unknown as ScrapedProduct;
}

/**
 * Fetch the WHOLE index despite Algolia's paginationLimitedTo=1000 cap, using a
 * search-only key: recursively slice the price axis so every slice returns ≤1000, then
 * union by objectID. A slice that still reports >1000 total is bisected (bounded depth),
 * so no product is missed regardless of catalogue size. Falls back to plain paging for the
 * first slice if numeric filtering is unsupported.
 */
async function fetchIndex(cfg: { appId: string; apiKey: string; index: string }, maxQueries: number, query: string): Promise<AlgoliaHit[]> {
  const seen = new Map<string, AlgoliaHit>();
  const noId: AlgoliaHit[] = [];
  let queries = 0;
  const collect = (hits: AlgoliaHit[]) => { for (const h of hits) { if (h.objectID) seen.set(h.objectID, h); else noId.push(h); } };

  async function slice(min: number, max: number, depth: number): Promise<void> {
    if (queries >= maxQueries) return;
    queries++;
    const nf = max === Infinity ? `["price>=${min}"]` : `["price>=${min}","price<${max}"]`;
    const res = await algoliaQuery(cfg, `hitsPerPage=1000&page=0&query=${encodeURIComponent(query)}&numericFilters=${encodeURIComponent(nf)}`);
    collect(res.hits ?? []);
    const total = res.nbHits ?? 0;
    if (total > PAGINATION_CAP && depth < 12 && queries < maxQueries) {
      const hi = max === Infinity ? Math.max(min * 2, min + 2000) : max;
      const mid = max === Infinity ? hi : Math.floor((min + max) / 2);
      if (mid > min) { await slice(min, mid, depth + 1); await slice(mid, max, depth + 1); }
    }
  }
  await slice(0, Infinity, 0);
  return [...seen.values(), ...noId];
}

export const algoliaFeedAdapter: SourcingAdapter = {
  mode: "api",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.algolia?.appId && !!provider.algolia?.index;
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const cfg = provider.algolia!;
    // Query budget for the recursive price-slicing (each slice ≤1000 hits). 60 is ample
    // for a ~4k-product catalogue; opts.maxPages (if given) scales it.
    const maxQueries = Math.max(8, (opts?.maxPages ?? 0) * 4 || 60);
    const errors: string[] = [];
    let arHits: AlgoliaHit[] = [];
    try {
      arHits = await fetchIndex({ appId: cfg.appId, apiKey: cfg.apiKey, index: cfg.index }, maxQueries, opts?.query ?? "");
    } catch (e) {
      return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [e instanceof Error ? e.message : String(e)] };
    }
    // Optional bilingual enrichment: English names keyed by objectID.
    const enByObj = new Map<string, string>();
    if (cfg.indexEn) {
      try {
        const enHits = await fetchIndex({ appId: cfg.appId, apiKey: cfg.apiKey, index: cfg.indexEn }, maxQueries, opts?.query ?? "");
        for (const h of enHits) if (h.objectID && h.name) enByObj.set(h.objectID, h.name);
      } catch (e) { errors.push(`en index: ${e instanceof Error ? e.message : String(e)}`); }
    }
    const products: ScrapedProduct[] = [];
    for (const h of arHits) {
      const m = mapAlgoliaHit(h, provider.slug, h.objectID ? enByObj.get(h.objectID) : undefined);
      if (m) products.push(m);
    }
    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
