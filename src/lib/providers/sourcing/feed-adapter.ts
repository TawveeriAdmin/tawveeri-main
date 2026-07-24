// src/lib/providers/sourcing/feed-adapter.ts
// OFFICIAL / AFFILIATE FEED sourcing adapter (ADR-085) — Tawveeri's long-term direction.
//
// The high-overlap Saudi retailers block scraping (ADR-082 close), so the sustainable
// path is a structured product feed (affiliate network export, retailer CSV/XML, or
// PA-API-style JSON). This adapter maps a feed's columns to the canonical ScrapedProduct
// shape via a per-provider FeedColumnMap, so a new feed is a config (URL + column map),
// not new code. It is intentionally a scaffold: the parsing/mapping contract is defined
// and unit-testable now; wiring a live feed URL happens when an affiliate agreement lands
// (a Founder/commercial boundary — credentials + terms).
//
// TPS: a feed row is EVIDENCE of an offer, nothing more. We emit only rows with a real
// title, a positive price, and a product URL; anything else is dropped (unknown beats
// incorrect). No identity is assigned here — that stays in TPS.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";

/** Maps a feed's field names → the canonical offer fields. */
export interface FeedColumnMap {
  nameEn: string;
  nameAr?: string;
  price: string;
  originalPrice?: string;
  url: string;
  image?: string;
  sku?: string;
  brand?: string;
  availability?: string;
}

/** Parse a single already-decoded feed record into a ScrapedProduct, or null if invalid. */
export function mapFeedRecord(rec: Record<string, unknown>, map: FeedColumnMap, storeSlug: string): ScrapedProduct | null {
  const str = (k?: string) => (k && typeof rec[k] === "string" ? (rec[k] as string).trim() : "");
  const num = (k?: string) => {
    if (!k) return 0;
    const n = parseFloat(String(rec[k] ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const nameEn = str(map.nameEn);
  const nameAr = str(map.nameAr) || nameEn;
  const price = num(map.price);
  const url = str(map.url);
  // Evidence-first: a real offer needs a name, a positive price, and a destination.
  if (!(nameEn || nameAr) || price <= 0 || !/^https?:\/\//i.test(url)) return null;
  const image = str(map.image);
  return {
    name_ar: nameAr,
    name_en: nameEn,
    brand: str(map.brand) || "",
    model: "",
    sku: str(map.sku) || null,
    current_price: price,
    original_price: map.originalPrice ? num(map.originalPrice) || null : null,
    availability: "in_stock",
    product_url: url,
    image_urls: image ? [image] : [],
    specifications: {},
    description_ar: null,
    description_en: null,
    _store_slug: storeSlug,
  } as unknown as ScrapedProduct;
}

/**
 * The feed adapter. `fetchOffers` is a scaffold until a provider carries a live
 * `feedUrl` + column map; it returns an explicit, non-throwing "not configured" result
 * so the sourcing router can fall back to the scraper (see scraper-adapter.ts).
 */
export const feedAdapter: SourcingAdapter = {
  mode: "official_feed",
  supports(provider: RetailerProvider): boolean {
    return (provider.sourcing === "official_feed" || provider.sourcing === "affiliate_feed" || provider.sourcing === "csv_xml") && !!provider.feedUrl;
  },
  async fetchOffers(provider: RetailerProvider, _opts?: SourcingOptions): Promise<SourcingResult> {
    if (!provider.feedUrl) {
      return { provider: provider.slug, mode: provider.sourcing, products: [], count: 0, errors: ["no feedUrl configured — awaiting affiliate/official feed agreement"] };
    }
    // Live fetch + column-map parsing lands with a real feed URL + credentials.
    return { provider: provider.slug, mode: provider.sourcing, products: [], count: 0, errors: ["feed fetch not yet implemented for this provider"] };
  },
};
