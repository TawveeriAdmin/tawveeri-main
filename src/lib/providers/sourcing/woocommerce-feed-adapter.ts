// src/lib/providers/sourcing/woocommerce-feed-adapter.ts
// WooCommerce Store API sourcing adapter (ADR-086) — a REAL, credential-free feed.
//
// The WooCommerce Store API (`/wp-json/wc/store/v1/products`) is PUBLIC on standard
// WooCommerce shops (verified live on shakersa.com: 1,081 products, paginated). It
// returns clean structured JSON — no HTML parsing, no anti-bot, order-of-magnitude
// more robust and complete than a cheerio scraper — so it is the preferred sourcing
// mode for any WooCommerce retailer. This is the framework's first WORKING feed
// (not a scaffold): it proves the official-feed path end-to-end without waiting for a
// commercial affiliate agreement, and generalizes to the whole class of Salla/Woo Saudi
// shops. A provider opts in with `sourcing: "api"` + `feedUrl: "<store origin>"`.
//
// TPS: emits OFFERS only, evidence-first — a row needs a name, a positive price, and a
// product URL, else it is dropped (unknown beats incorrect). Prices arrive in MINOR
// units (currency_minor_unit) and are converted; variable-product ranges take the min.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";

interface WooImage { src?: string }
interface WooBrand { name?: string }
interface WooPrices { price?: string; regular_price?: string; sale_price?: string; currency_minor_unit?: number }
interface WooProduct {
  id?: number; name?: string; permalink?: string; sku?: string;
  prices?: WooPrices; images?: WooImage[]; brands?: WooBrand[];
  is_in_stock?: boolean; type?: string;
}

/** Decode the numeric/basic HTML entities WooCommerce names carry (&#8211;, &amp; …). */
export function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)); } catch { return ""; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ""; } })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

/** WooCommerce prices are integers in minor units — "22885" @ minor_unit 2 ⇒ 228.85. */
function minorToMajor(raw: string | undefined, minorUnit = 2): number {
  if (!raw) return 0;
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n)) return 0;
  return n / Math.pow(10, minorUnit);
}

/** Map one Store-API product to a ScrapedProduct, or null if it isn't a usable offer. */
export function mapWooProduct(p: WooProduct, storeSlug: string): ScrapedProduct | null {
  const name = decodeEntities(p.name || "");
  const url = (p.permalink || "").trim();
  const minor = p.prices?.currency_minor_unit ?? 2;
  const sale = minorToMajor(p.prices?.sale_price, minor);
  const regular = minorToMajor(p.prices?.regular_price, minor);
  const base = minorToMajor(p.prices?.price, minor);
  const current = sale > 0 ? sale : base > 0 ? base : regular;
  if (!name || current <= 0 || !/^https?:\/\//i.test(url)) return null;
  const original = regular > current ? regular : null;
  const image = p.images?.[0]?.src || "";
  return {
    name_ar: name,
    name_en: name,
    brand: decodeEntities(p.brands?.[0]?.name || "") || "",
    model: "",
    sku: (p.sku || "").trim() || null,
    current_price: current,
    original_price: original,
    availability: p.is_in_stock === false ? "out_of_stock" : "in_stock",
    product_url: url,
    image_urls: image ? [image] : [],
    specifications: {},
    description_ar: null,
    description_en: null,
    _store_slug: storeSlug,
  } as unknown as ScrapedProduct;
}

const PER_PAGE = 100;

export const wooCommerceFeedAdapter: SourcingAdapter = {
  mode: "api",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.feedUrl;
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const origin = (provider.feedUrl || "").replace(/\/+$/, "");
    const products: ScrapedProduct[] = [];
    const errors: string[] = [];
    const maxPages = Math.max(1, opts?.maxPages ?? 30);
    const search = opts?.query ? `&search=${encodeURIComponent(opts.query)}` : "";
    let totalPages = maxPages;
    for (let page = 1; page <= Math.min(maxPages, totalPages); page++) {
      const url = `${origin}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}${search}`;
      try {
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; TawveeriBot/1.0)", accept: "application/json" } });
        if (!res.ok) { errors.push(`page ${page}: HTTP ${res.status}`); break; }
        const tp = Number(res.headers.get("x-wp-totalpages"));
        if (Number.isFinite(tp) && tp > 0) totalPages = tp;
        const rows = (await res.json()) as WooProduct[];
        if (!Array.isArray(rows) || rows.length === 0) break;
        for (const r of rows) { const m = mapWooProduct(r, provider.slug); if (m) products.push(m); }
      } catch (e) {
        errors.push(`page ${page}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
