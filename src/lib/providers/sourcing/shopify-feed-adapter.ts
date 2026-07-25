// src/lib/providers/sourcing/shopify-feed-adapter.ts
// Shopify storefront sourcing adapter (ADR-104) — credential-free, covers the whole class.
//
// Every Shopify store publishes its full catalogue at `/products.json` (paginated, ≤250/page):
// clean JSON with title, vendor, product_type, variants[].price/sku/barcode and images — no
// credentials, no scraping. One adapter therefore onboards ANY Shopify merchant by config.
//
// MARKET SCOPING (critical): products.json prices carry NO currency code. Tawveeri is a Saudi
// (SAR) platform, so the adapter resolves the shop currency out-of-band (meta.json, else the
// homepage `Shopify.currency.active`) and REJECTS the whole store unless it is SAR — never
// ingesting a foreign-currency price as if it were SAR (unknown beats incorrect). Bonus: a
// variant `barcode` is usually a GTIN, captured for the ADR-100 identity/corroboration lever.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";
import { isValidGtin } from "@/lib/enrichment/icecat";

const UA = "Mozilla/5.0 (compatible; TawveeriBot/1.0; +shopify-feed)";

interface ShopVariant { price?: string; available?: boolean; sku?: string; barcode?: string | number; }
interface ShopImage { src?: string; }
interface ShopProduct { title?: string; handle?: string; vendor?: string; product_type?: string; variants?: ShopVariant[]; images?: ShopImage[]; }

async function getJson(url: string, ms = 15000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Resolve the shop's active currency (SAR gate). meta.json first, then a homepage token. */
export async function detectShopifyCurrency(origin: string): Promise<string | null> {
  const meta = (await getJson(`${origin}/meta.json`)) as { currency?: string } | null;
  if (meta?.currency) return String(meta.currency).toUpperCase();
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(origin, { headers: { "user-agent": UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/Shopify\.currency\s*=\s*\{[^}]*["']active["']\s*:\s*["']([A-Z]{3})["']/i) || html.match(/["']currency["']\s*:\s*["']([A-Z]{3})["']/);
    return m ? m[1].toUpperCase() : null;
  } catch { return null; }
}

/** Map one Shopify product to a ScrapedProduct, or null if unusable. */
export function mapShopifyProduct(p: ShopProduct, origin: string): ScrapedProduct | null {
  const name = String(p.title || "").trim();
  const v = (p.variants || [])[0];
  const price = Math.round(Number(v?.price ?? 0) * 100) / 100;
  if (!name || !(price > 0) || !p.handle) return null;
  const variantWithBarcode = (p.variants || []).find((x) => isValidGtin(x.barcode));
  const anyAvailable = (p.variants || []).some((x) => x.available);
  return {
    name_ar: name,
    name_en: name,
    brand: String(p.vendor || "").trim(),
    model: "",
    sku: String(v?.sku || "").trim() || null,
    gtin: variantWithBarcode ? String(variantWithBarcode.barcode).replace(/\D+/g, "") : null,
    current_price: price,
    original_price: null, // products.json has no reliable compare-at at the product level
    availability: anyAvailable ? "in_stock" : "out_of_stock",
    product_url: `${origin}/products/${p.handle}`,
    image_urls: p.images?.[0]?.src ? [String(p.images[0].src)] : [],
    specifications: p.product_type ? { product_type: p.product_type } : {},
    description_ar: null,
    description_en: null,
  } as unknown as ScrapedProduct;
}

export const shopifyFeedAdapter: SourcingAdapter = {
  mode: "api",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "api" && !!provider.shopify?.origin;
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const origin = provider.shopify!.origin.replace(/\/+$/, "");
    const errors: string[] = [];

    // Market scoping: resolve + gate on SAR before ingesting anything.
    const currency = await detectShopifyCurrency(origin);
    if (currency && currency !== "SAR") {
      return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [`non-SAR store (${currency}) — rejected (market scoping)`] };
    }
    if (!currency) errors.push("currency undetermined — proceeding only if products exist; verify before trusting prices");

    const maxPages = Math.max(1, opts?.maxPages ?? 10);
    const products: ScrapedProduct[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const j = (await getJson(`${origin}/products.json?limit=250&page=${page}`)) as { products?: ShopProduct[] } | null;
      const arr = j?.products ?? [];
      if (!arr.length) break;
      for (const p of arr) { const m = mapShopifyProduct(p, origin); if (m) products.push(m); }
      if (arr.length < 250) break;
    }
    // If currency was undetermined AND we somehow got products, we still cannot assert SAR —
    // reject rather than risk a fabricated Saudi price (unknown beats incorrect).
    if (!currency && products.length) {
      return { provider: provider.slug, mode: "api", products: [], count: 0, errors: [...errors, "currency unverifiable — refusing to ingest (cannot confirm SAR)"] };
    }
    if (!products.length) errors.push("no products from /products.json");
    return { provider: provider.slug, mode: "api", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
