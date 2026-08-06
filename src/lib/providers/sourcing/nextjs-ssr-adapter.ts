// src/lib/providers/sourcing/nextjs-ssr-adapter.ts
// Next.js-SSR storefront sourcing adapter — credential-free, covers the whole class
// (verified live against Black Box KSA, blackbox.com.sa, 2026-08-06).
//
// This platform shape is neither Salla/Zid (no JSON-LD, no Salla storefront API) nor
// standard Magento GraphQL (no public /graphql; Magento-shaped media paths come from a
// proprietary `api.ops.*` backend behind a custom Next.js frontend, not the documented
// Magento storefront API). What IS public and credential-free:
//   1) `sitemap.xml` enumerates every product URL.
//   2) Every product page server-renders its full record into
//      `<script id="__NEXT_DATA__">` as `props.pageProps` — sku, name, final_price,
//      is_in_stock, qty, images, category[] — no JS execution required to read it.
// No CAPTCHA/Cloudflare challenge was observed on product pages during verification;
// the sitemap itself intermittently served a one-off Cloudflare interstitial that
// resolved on a plain retry (no JS challenge solved) — treated as ordinary flake, not a
// bot-wall, and given a bounded retry here.
//
// PRICE-INTEGRITY GUARD: Black Box operates a first-party, structured "1 SAR add-on"
// cart mechanic (native i18n strings RiyalOfferDuplicateNotAllowed / RiyalOfferQtyIncrease
// NotAllowed; an active "مهرجان الريال" / riyal-festival campaign category, id 1133).
// The exact qualifying product PAIRS were not verified to first-party specificity within
// this onboarding (sampled fridge/washer/dishwasher products did not carry riyal-festival
// membership or any addon/bundle field). Per "unknown beats incorrect" and the hard
// invariant that a conditional 1 SAR add-on must never become a standalone price: this
// adapter DROPS any observation priced at or below RIYAL_OFFER_FLOOR_SAR rather than
// modeling an unverified bundle. A dropped observation is evidence-first silence, not a
// fabricated price.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";
import { decodeEntities } from "./woocommerce-feed-adapter";

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) TawveeriBot/1.0";

/** Never accept a standalone price at or below this floor — the conditional "1 SAR"
 *  add-on safety net (see file header). 5 SAR, not 1, to absorb currency/rounding noise
 *  around the exact addon value without ever legitimizing a real appliance/electronics
 *  price this low. */
const RIYAL_OFFER_FLOOR_SAR = 5;

async function fetchText(url: string, timeoutMs = 20000, retries = 1): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) return await res.text();
    } catch {
      // fall through to retry
    }
  }
  return null;
}

function sitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

const isProductUrl = (u: string) => /\/product\/[^/?#]+-p-\d{6,}(?:$|[/?#])/i.test(u);

/**
 * A `free_gifts[]` entry — the CONDITIONAL ADD-ON mechanism this platform actually uses
 * (verified live 2026-08-06 on 16 of 366 sampled appliance products; sampled special
 * prices ranged 59–1849 SAR, never literally "1"). Preserved as evidence in
 * `specifications.free_gifts` for provenance — NEVER read into a price field. This is the
 * hard SAR-1 safety invariant: `mapNextjsSsrProduct` below reads price ONLY from the
 * qualifying product's own `prices_with_tax`/`display_price`, and never touches this array.
 */
interface NextDataFreeGift {
  product_name?: string;
  product_name_ar?: string;
  product_price?: string | number;
  product_special_price?: string | number;
  url?: string;
  product_image?: string;
}
interface NextDataPricesWithTax { price?: number | string; original_price?: number | string; }
interface NextDataProductProps {
  sku?: string;
  name?: string[] | string;
  display_price?: number | string;
  prices_with_tax?: NextDataPricesWithTax;
  stock?: { is_in_stock?: boolean; qty?: number };
  /** Absolute CDN image URLs (preferred over the relative `image` field). */
  _media_?: { image?: { image?: string; position?: string | number }[] };
  free_gifts?: NextDataFreeGift[];
  [key: string]: unknown;
}

/** Extract `props.pageProps.displayedProductsRatings` (the real product record — verified
 *  live 2026-08-06; the outer `pageProps` carries only page chrome/i18n) from a Next.js
 *  `__NEXT_DATA__` script block. */
function extractNextData(html: string): NextDataProductProps | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const json = JSON.parse(m[1]) as { props?: { pageProps?: { displayedProductsRatings?: NextDataProductProps } } };
    return json.props?.pageProps?.displayedProductsRatings ?? null;
  } catch {
    return null;
  }
}

/** Map one Next.js SSR product record to a ScrapedProduct, or null if unusable/quarantined. */
export function mapNextjsSsrProduct(p: NextDataProductProps, url: string): ScrapedProduct | null {
  const rawName = Array.isArray(p.name) ? p.name[0] : p.name;
  const name = decodeEntities(String(rawName || "")).trim();
  const rawPrice = p.prices_with_tax?.price ?? p.display_price;
  const price = Math.round(Number(rawPrice ?? 0) * 100) / 100;
  if (!name || !(price > 0) || !p.sku) return null;
  // PRICE-INTEGRITY GUARD — see file header. Drop, never store, never fabricate a bundle.
  if (price <= RIYAL_OFFER_FLOOR_SAR) return null;
  const rawOriginal = p.prices_with_tax?.original_price;
  const original = rawOriginal != null ? Math.round(Number(rawOriginal) * 100) / 100 : null;
  const image = p._media_?.image?.[0]?.image; // absolute CDN URL (store.ops.blackbox.com.sa)
  const inStock = p.stock?.is_in_stock === true;
  const specifications: Record<string, unknown> = {};
  if (p.free_gifts?.length) {
    // Evidence-only (provenance never dropped) — NOT a price, NEVER read as one downstream.
    specifications.free_gifts = p.free_gifts.map((g) => ({
      name_ar: g.product_name_ar ?? null,
      name_en: g.product_name ?? null,
      addon_price: g.product_special_price ?? null,
      addon_regular_price: g.product_price ?? null,
      url: g.url ?? null,
    }));
  }
  return {
    name_ar: name,
    name_en: name,
    brand: "",
    model: "",
    sku: String(p.sku).trim() || null,
    gtin: null,
    current_price: price,
    original_price: original && original > price ? original : null, // real discount only
    availability: inStock ? "in_stock" : "out_of_stock",
    product_url: url.split("#")[0],
    image_urls: image ? [String(image)] : [],
    specifications,
    description_ar: null,
    description_en: null,
  } as unknown as ScrapedProduct;
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const nextjsSsrAdapter: SourcingAdapter = {
  mode: "api",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.nextjsSsr?.origin;
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const cfg = provider.nextjsSsr!;
    const origin = cfg.origin.replace(/\/+$/, "");
    const errors: string[] = [];
    const maxProducts = Math.max(20, (opts?.maxPages ?? 0) * 100 || 300);

    const rootUrl = cfg.sitemapUrl || `${origin}/sitemap.xml`;
    // Bounded retry: a Cloudflare interstitial was observed once on the sitemap and
    // resolved on a plain retry (verification note above) — never a JS challenge.
    const rootXml = await fetchText(rootUrl, 20000, 1);
    if (!rootXml) {
      return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [`sitemap unreachable: ${rootUrl}`] };
    }

    let productUrls = sitemapLocs(rootXml).filter(isProductUrl);
    if (cfg.categoryKeywords?.length) {
      const kws = cfg.categoryKeywords.map((k) => k.toLowerCase());
      productUrls = productUrls.filter((u) => kws.some((k) => u.toLowerCase().includes(k)));
    }
    if (!productUrls.length) {
      return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [...errors, "no in-scope product URLs found in sitemap"] };
    }
    const urls = productUrls.slice(0, maxProducts);

    const mapped = await pool(urls, 4, async (u) => {
      const html = await fetchText(u);
      if (!html) return null;
      const props = extractNextData(html);
      if (!props) return null;
      return mapNextjsSsrProduct(props, u);
    });
    const products = mapped.filter((p): p is ScrapedProduct => !!p);
    const dropped = urls.length - products.length;
    if (products.length === 0) errors.push(`0 products parsed from ${urls.length} pages`);
    else if (dropped > 0) errors.push(`${dropped}/${urls.length} pages yielded no usable product (redirect, missing SKU/price, or below the ${RIYAL_OFFER_FLOOR_SAR} SAR price-integrity floor)`);
    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
