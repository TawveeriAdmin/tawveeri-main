// scripts/tps-core/ingest-via-provider.ts
// Feed-based ingestion (ADR-086): source a provider's offers through the provider
// framework (WooCommerce Store API / official feed / … , falling back to the scraper)
// and write them to raw_observations via the SAME unified IngestionService the scraper
// path uses. This makes the framework's feed sourcing a real, usable ingestion path —
// not just a tested adapter — so a WooCommerce retailer (shaker, or any future Woo/Salla
// shop) ingests clean structured JSON instead of scraped HTML.
//
// Production-safe: dedup downstream is by product URL (resolveListingIdentity), and the
// feed uses the same permalink the scraper does, so feed + scraper never double-count.
// Usage: npx tsx scripts/tps-core/ingest-via-provider.ts <slug> [--feed] [--max-pages N] [--dry]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { assertFingerprint } from "./tps-batch";
import { getProvider } from "../../src/lib/providers/registry";
import { sourceOffers } from "../../src/lib/providers/sourcing/router";
import type { RetailerProvider } from "../../src/lib/providers/types";
// NOTE: IngestionService pulls src/lib/database/supabase.ts, which validates env at
// MODULE LOAD. A static import hoists above the dotenv config() above, so it is
// dynamically imported below (after env is loaded).

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const slug = process.argv[2];
  if (!slug) { console.error("usage: ingest-via-provider <slug> [--feed] [--max-pages N] [--dry]"); process.exit(1); }
  const forceFeed = process.argv.includes("--feed");
  const dry = process.argv.includes("--dry");
  const mpIdx = process.argv.indexOf("--max-pages");
  const maxPages = mpIdx > -1 ? Number(process.argv[mpIdx + 1]) || 30 : 30;

  const base = getProvider(slug);
  if (!base) { console.error(`unknown provider: ${slug}`); process.exit(1); }
  // --feed forces the structured-feed path (sourcing=api) for a provider whose default
  // is still `scraper` while we verify the feed is equivalent-or-better.
  const provider: RetailerProvider = forceFeed ? { ...base, sourcing: "api" } : base;

  console.log(`[ingest] ${provider.slug} — sourcing=${provider.sourcing} feedUrl=${provider.feedUrl ?? "-"} maxPages=${maxPages}`);
  const t0 = Date.now();
  const res = await sourceOffers(provider, { maxPages });
  console.log(`[ingest] sourced ${res.count} offers via mode=${res.mode} in ${((Date.now() - t0) / 1000).toFixed(1)}s${res.errors ? ` errors=${JSON.stringify(res.errors)}` : ""}`);

  if (dry) {
    for (const p of res.products.slice(0, 5)) console.log(`   • ${(p.name_en || p.name_ar).slice(0, 50)} | ${p.current_price} SAR | ${p.product_url.slice(0, 40)}`);
    console.log("[ingest] --dry: nothing written.");
    return;
  }
  if (!res.count) { console.log("[ingest] no offers to write."); return; }

  const { IngestionService } = await import("../../src/lib/scraping/services/ingestion-service");
  const saved = await new IngestionService().ingestBatch(provider.slug, res.products, provider.storeId, null);
  console.log(`[ingest] wrote ${saved}/${res.count} raw observations for ${provider.slug} (store ${provider.storeId}).`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
