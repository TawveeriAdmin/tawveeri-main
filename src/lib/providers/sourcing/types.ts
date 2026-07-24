// src/lib/providers/sourcing/types.ts
// The SOURCING adapter contract (ADR-085). Every sourcing mode — scraper today,
// official/affiliate/CSV/XML feed or API tomorrow — implements this one interface and
// yields the SAME ScrapedProduct[] shape, so raw_observations and all of TPS below it
// are untouched regardless of where an offer came from. This is the seam that lets
// Tawveeri migrate a retailer from scraping to an official feed by swapping an adapter.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider, SourcingMode } from "../types";

export interface SourcingOptions {
  /** Restrict to a category bucket the source understands (optional). */
  category?: string;
  /** Upper bound on pages/records to pull in one run. */
  maxPages?: number;
  /** Search query for query-based sources (search scrapers, feed search). */
  query?: string;
}

export interface SourcingResult {
  provider: string;
  mode: SourcingMode;
  products: ScrapedProduct[];
  count: number;
  /** Non-fatal issues (a partial pull is still evidence). */
  errors?: string[];
}

/**
 * A sourcing adapter for one mode. Implementations must be evidence-first: emit only
 * products they actually observed, never synthesize an offer, and surface partial
 * failures in `errors` rather than throwing (a partial pull is valid evidence).
 */
export interface SourcingAdapter {
  mode: SourcingMode;
  /** Whether this adapter can currently serve the given provider. */
  supports(provider: RetailerProvider): boolean;
  fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult>;
}
