// src/lib/providers/sourcing/salla-feed-adapter.ts
// Salla storefront sourcing adapter (ADR-095) — credential-free, covers the whole class.
//
// Salla powers 4,400+ live Saudi storefronts. Every Salla shop exposes its catalogue with
// NO credentials: an XML sitemap enumerates product URLs and every product page embeds
// `application/ld+json` `@type: Product` (name, offers.price, offers.priceCurrency, sku,
// brand, availability, image). One adapter therefore onboards Najm, BlackBox, and any
// future Salla merchant — configuration, not code. This is the Salla analogue of the
// WooCommerce Store-API / Algolia paths.
//
// TPS: emits OFFERS only, evidence-first. A product needs a name, a positive SAR price, and
// a URL, else it is dropped (unknown beats incorrect). Non-SAR offers are rejected outright
// (market scoping — never ingest a foreign-currency price). Bounded + concurrency-limited so
// it never hammers a merchant.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";
import { decodeEntities } from "./woocommerce-feed-adapter";

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) TawveeriBot/1.0";

async function fetchText(url: string, timeoutMs = 20000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

/** All <loc> values from a sitemap (index or urlset). */
function sitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

/**
 * A product URL for a JSON-LD storefront. Covers Salla (`/{slug}/p{digits}` or `/-/p{digits}`)
 * AND Zid (`/products/{slug}`) — both expose the same `application/ld+json @type:Product`
 * per page, so one adapter serves both platform classes (config-only onboarding).
 */
const isProductUrl = (u: string) =>
  /\/(?:-\/)?p\d{4,}(?:$|[/?#])/i.test(u) ||
  /\/p\d{4,}$/i.test(u) ||
  /\/products\/[^/?#]{2,}(?:$|[/?#])/i.test(u); // Zid

interface LdOffer { price?: string | number; priceCurrency?: string; availability?: string; }
interface LdProduct { "@type"?: string | string[]; name?: string; sku?: string; mpn?: string; image?: string | string[]; brand?: string | { name?: string }; offers?: LdOffer | LdOffer[]; }

/** Extract the first schema.org Product from a page's JSON-LD blocks. */
export function extractSallaProduct(html: string): LdProduct | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let json: unknown;
    try { json = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes: unknown[] = Array.isArray(json) ? json : (json as { "@graph"?: unknown[] })?.["@graph"] ?? [json];
    for (const n of nodes) {
      const t = (n as LdProduct)?.["@type"];
      const types = Array.isArray(t) ? t : [t];
      if (types.includes("Product")) return n as LdProduct;
    }
  }
  return null;
}

/** Map a schema.org Product (+ its URL) to a ScrapedProduct, or null if unusable / non-SAR. */
export function mapSallaProduct(p: LdProduct, url: string, storeSlug: string): ScrapedProduct | null {
  const name = decodeEntities(String(p.name || ""));
  const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const currency = String(offer?.priceCurrency || "").toUpperCase();
  const price = Math.round(Number(offer?.price ?? 0) * 100) / 100;
  // Market scoping: never ingest a non-SAR price (would fabricate a Saudi price).
  if (!name || !(price > 0) || (currency && currency !== "SAR") || !/^https?:\/\//i.test(url)) return null;
  const brand = typeof p.brand === "string" ? p.brand : (p.brand?.name ?? "");
  const image = Array.isArray(p.image) ? p.image[0] : p.image;
  const avail = String(offer?.availability || "").toLowerCase();
  return {
    name_ar: name,
    name_en: name,
    brand: decodeEntities(String(brand || "")) || "",
    model: "",
    sku: String(p.sku || p.mpn || "").trim() || null,
    current_price: price,
    original_price: null, // JSON-LD Offer carries one price; no reliable original — never fabricate
    availability: avail.includes("outofstock") || avail.includes("soldout") ? "out_of_stock" : "in_stock",
    product_url: url.split("#")[0],
    image_urls: image ? [String(image)] : [],
    specifications: {},
    description_ar: null,
    description_en: null,
    _store_slug: storeSlug,
  } as unknown as ScrapedProduct;
}

/** Bounded concurrency map. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

export const sallaFeedAdapter: SourcingAdapter = {
  mode: "api",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.salla?.origin;
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const origin = provider.salla!.origin.replace(/\/+$/, "");
    const errors: string[] = [];
    const maxProducts = Math.max(50, (opts?.maxPages ?? 0) * 100 || 600);

    // 1) Sitemap → product URLs (follow one level of sitemap-index nesting).
    const rootUrl = provider.salla!.sitemapUrl || `${origin}/sitemap.xml`;
    const rootXml = await fetchText(rootUrl);
    if (!rootXml) return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [`sitemap unreachable: ${rootUrl}`] };
    const rootLocs = sitemapLocs(rootXml);
    const childSitemaps = rootLocs.filter((u) => /\.xml($|\?)/i.test(u));
    const productUrls = new Set<string>();
    for (const u of rootLocs) if (isProductUrl(u)) productUrls.add(u);
    for (const sm of childSitemaps) {
      if (productUrls.size >= maxProducts) break;
      const xml = await fetchText(sm);
      if (!xml) { errors.push(`child sitemap failed: ${sm}`); continue; }
      for (const u of sitemapLocs(xml)) if (isProductUrl(u)) productUrls.add(u);
    }
    const urls = [...productUrls].slice(0, maxProducts);
    if (!urls.length) return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [...errors, "no product URLs found in sitemap"] };

    // 2) Per-page JSON-LD Product extraction (bounded concurrency).
    const mapped = await pool(urls, 8, async (u) => {
      const html = await fetchText(u);
      if (!html) return null;
      const ld = extractSallaProduct(html);
      if (!ld) return null;
      return mapSallaProduct(ld, u, provider.slug);
    });
    const products = mapped.filter((p): p is ScrapedProduct => !!p);
    if (products.length === 0) errors.push(`0 products parsed from ${urls.length} pages`);
    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
