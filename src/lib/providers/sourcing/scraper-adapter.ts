// src/lib/providers/sourcing/scraper-adapter.ts
// SCRAPER sourcing adapter (ADR-085) — the default/fallback mode today. Delegates to
// the existing per-store scrapers via the orchestrator, so the provider framework
// reuses all current scraping logic unchanged and simply presents it under the uniform
// SourcingAdapter contract. When a retailer gains an official feed, the sourcing router
// prefers the feed adapter and this becomes the fallback (never both — evidence isn't
// duplicated). Heavy scraper deps are lazy-imported so non-ingestion code never bundles them.
import type { ScrapedProduct } from "@/lib/scraping/base/types";
import type { RetailerProvider } from "../types";
import type { SourcingAdapter, SourcingOptions, SourcingResult } from "./types";

export const scraperAdapter: SourcingAdapter = {
  mode: "scraper",
  supports(provider: RetailerProvider): boolean {
    return provider.sourcing === "scraper";
  },
  async fetchOffers(provider: RetailerProvider, opts?: SourcingOptions): Promise<SourcingResult> {
    const errors: string[] = [];
    let products: ScrapedProduct[] = [];
    try {
      const { ScrapingOrchestrator } = await import("@/lib/scraping/services/scraping-orchestrator");
      const scraper = new ScrapingOrchestrator().getScraperForStore(provider.slug);
      if (!scraper) {
        return { provider: provider.slug, mode: "scraper", products: [], count: 0, errors: [`no scraper registered for ${provider.slug}`] };
      }
      products = await scraper.discoverProducts(opts?.category ?? "", opts?.maxPages ?? 1);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    return { provider: provider.slug, mode: "scraper", products, count: products.length, errors: errors.length ? errors : undefined };
  },
};
