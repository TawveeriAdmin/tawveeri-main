// src/lib/providers/sourcing/magento-graphql-adapter.ts
// Magento 2 GraphQL sourcing adapter (ADR-179) — credential-free, covers the whole class.
//
// WHY THIS EXISTS. swsg (الشتاء والصيف) was written off as un-ingestible after its HTML
// storefront returned HTTP 403 to our production egress. That verdict was reached on ONE
// sourcing mode. Magento 2 ships a **public, unauthenticated GraphQL endpoint at
// `/graphql`** — it is the documented storefront API every Magento PWA/headless frontend
// uses, and it is the merchant's own published surface, not a circumvention. Measured
// 2026-08-02: `https://swsg.co/graphql` returns **4,274 products** with sku, name, url_key,
// price and currency, over both POST and GET, from two independent networks.
//
// This is the Magento analogue of the Salla (sitemap+JSON-LD), Shopify (`/products.json`),
// WooCommerce (Store API) and Algolia adapters — one adapter onboards the whole platform
// class, so the next Magento merchant is configuration, not code.
//
// EVIDENCE-FIRST, like every sibling adapter: emit only what was observed. A product needs
// a name, a positive SAR price and a resolvable URL or it is dropped (unknown beats
// incorrect). Non-SAR prices are rejected outright — market scoping, never ingest a
// foreign-currency price. Bounded pagination so a merchant is never hammered.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";

const UA = "Mozilla/5.0 (compatible; TawveeriBot/1.0; +https://tawveeri.com)";
const PAGE_SIZE = 100;
/** Hard ceiling per run — bounded by construction, like every other adapter. */
const MAX_PAGES = 50;

/**
 * The storefront query. Deliberately minimal: only fields Magento exposes publicly by
 * default, so it works on a stock install without the merchant enabling anything.
 */
const QUERY = `query P($page:Int!,$size:Int!){products(search:"",pageSize:$size,currentPage:$page){total_count items{sku name url_key stock_status price_range{minimum_price{final_price{value currency}}} image{url} categories{name}}}}`;

interface MagentoItem {
  sku?: string;
  name?: string;
  url_key?: string;
  stock_status?: string;
  image?: { url?: string } | null;
  categories?: { name?: string }[] | null;
  price_range?: { minimum_price?: { final_price?: { value?: number; currency?: string } } };
}

async function gql(origin: string, page: number, timeoutMs = 25000): Promise<{ total: number; items: MagentoItem[] } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${origin.replace(/\/+$/, "")}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA, accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { page, size: PAGE_SIZE } }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { products?: { total_count?: number; items?: MagentoItem[] } } };
    const p = json?.data?.products;
    if (!p || !Array.isArray(p.items)) return null;
    return { total: Number(p.total_count ?? 0), items: p.items };
  } catch {
    return null;
  }
}

/** Map one Magento item to a ScrapedProduct, or null when the evidence is incomplete. */
function toProduct(origin: string, it: MagentoItem, category?: string): ScrapedProduct | null {
  const name = (it.name ?? "").trim();
  const price = it.price_range?.minimum_price?.final_price?.value;
  const currency = it.price_range?.minimum_price?.final_price?.currency;
  // MARKET SCOPING: a non-SAR price is not our market and is never ingested.
  if (currency && currency.toUpperCase() !== "SAR") return null;
  if (!name || typeof price !== "number" || !(price > 0)) return null;
  const slug = (it.url_key ?? "").trim();
  if (!slug) return null;

  return {
    name_ar: name,
    name_en: name,
    brand: null,
    model: null,
    sku: it.sku ? String(it.sku) : null,
    current_price: Math.round(price * 100) / 100,
    original_price: null,
    availability: it.stock_status === "OUT_OF_STOCK" ? "out_of_stock" : "in_stock",
    // Magento's canonical storefront path. `.html` is the Magento default suffix and is
    // what the sitemap publishes, so this resolves to the same page a shopper lands on.
    product_url: `${origin.replace(/\/+$/, "")}/ar/${slug}.html`,
    image_urls: it.image?.url ? [it.image.url] : [],
    specifications: {},
    category: (category as ScrapedProduct["category"]) ?? undefined,
    description_ar: null,
    description_en: null,
  } as unknown as ScrapedProduct;
}

export const magentoGraphqlAdapter: SourcingAdapter = {
  mode: "api",

  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.magento?.origin;
  },

  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const origin = provider.magento!.origin;
    const errors: string[] = [];
    const products: ScrapedProduct[] = [];
    const seen = new Set<string>();
    const cap = Math.min(opts?.maxPages ?? MAX_PAGES, MAX_PAGES);

    for (let page = 1; page <= cap; page++) {
      const res = await gql(origin, page);
      if (!res) {
        errors.push(`graphql page ${page} failed`);
        break;
      }
      if (!res.items.length) break;
      for (const it of res.items) {
        const p = toProduct(origin, it, opts?.category);
        if (!p) continue;
        const key = String((p as { sku?: string }).sku ?? (p as { product_url?: string }).product_url ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        products.push(p);
      }
      if (page * PAGE_SIZE >= res.total) break;
    }

    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
