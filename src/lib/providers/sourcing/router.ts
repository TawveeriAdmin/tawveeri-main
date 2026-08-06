// src/lib/providers/sourcing/router.ts
// Sourcing router (ADR-085): picks the adapter for a provider by its configured mode,
// preferring an official/affiliate feed when one is configured and falling back to the
// clean scraper otherwise. Fallback is EXPLICIT and one-way — we never pull the same
// offers from two sources (no duplicated evidence).
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";
import { feedAdapter } from "./feed-adapter";
import { wooCommerceFeedAdapter } from "./woocommerce-feed-adapter";
import { algoliaFeedAdapter } from "./algolia-feed-adapter";
import { sallaFeedAdapter } from "./salla-feed-adapter";
import { shopifyFeedAdapter } from "./shopify-feed-adapter";
import { magentoGraphqlAdapter } from "./magento-graphql-adapter";
import { nextjsSsrAdapter } from "./nextjs-ssr-adapter";
import { scraperAdapter } from "./scraper-adapter";

// Order = preference. A structured feed (Algolia index, Salla sitemap+JSON-LD, WooCommerce
// Store API, then a generic official/CSV/XML feed) is preferred over scraping; the scraper
// is the universal fallback. First adapter whose supports() matches wins. Algolia/Salla/
// WooCommerce/Next.js-SSR all use sourcing 'api' but disambiguate on their config
// (algolia{} / salla{} / feedUrl / nextjsSsr{}).
const ADAPTERS: SourcingAdapter[] = [algoliaFeedAdapter, sallaFeedAdapter, shopifyFeedAdapter, magentoGraphqlAdapter, nextjsSsrAdapter, wooCommerceFeedAdapter, feedAdapter, scraperAdapter];

/** The adapter that will actually serve this provider (feed if configured, else scraper). */
export function resolveSourcingAdapter(provider: RetailerProvider): SourcingAdapter {
  return ADAPTERS.find((a) => a.supports(provider)) ?? scraperAdapter;
}

/**
 * Fetch offers for a provider through its resolved adapter. If a configured feed
 * returns nothing usable, fall back to the scraper (evidence-first: prefer the feed,
 * but never leave a retailer un-sourced when a scraper exists).
 */
export async function sourceOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
  const primary = resolveSourcingAdapter(provider);
  const res = await primary.fetchOffers(provider, opts);
  if (res.count === 0 && primary.mode !== "scraper" && scraperAdapter.supports({ ...provider, sourcing: "scraper" })) {
    const fb = await scraperAdapter.fetchOffers({ ...provider, sourcing: "scraper" }, opts);
    return { ...fb, errors: [...(res.errors ?? []), ...(fb.errors ?? []), `fell back to scraper from ${primary.mode}`] };
  }
  return res;
}

export { ADAPTERS };
