// scripts/tps-core/activate-store.ts
// Merchant-onboarding activation: bring a technically-reachable store into
// production ingestion. Discovers products across categories via the store's cron
// scraper (getScraperForStore) and writes valid raw observations through the
// authoritative IngestionService (the same path the cron uses). Reachability must
// be verified first (no proxy/founder decision needed). After this, run the TPS
// backfill so the store participates in normalization/matching/DNA/corroboration.
//
//   npx tsx scripts/tps-core/activate-store.ts <slug> [pagesPerCategory=2]
//
// Idempotent-ish: adds observations; TPS dedups downstream. Read-only on the store's
// site; append-only to raw_observations.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";

const CATEGORIES = ["smartphone", "tv", "tablet", "laptop", "audio", "camera", "air_conditioner", "refrigerator", "washing_machine", "monitor", "wearable"];

(async () => {
  const slug = process.argv[2];
  const pages = Number(process.argv[3] || 2);
  if (!slug) { console.error("usage: activate-store.ts <slug> [pages]"); process.exit(1); }
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");

  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const { rows } = await pg.query(`select id from stores where slug=$1`, [slug]);
  if (!rows.length) { console.error(`store slug '${slug}' not in stores table`); process.exit(1); }
  const storeId = Number(rows[0].id);

  const { ScrapingOrchestrator } = await import("../../src/lib/scraping/services/scraping-orchestrator");
  const { IngestionService } = await import("../../src/lib/scraping/services/ingestion-service");
  const orch = new (ScrapingOrchestrator as unknown as { new (): { getScraperForStore(s: string): { discoverProducts(c: string, p: number): Promise<Record<string, unknown>[]> } } })();
  const scraper = orch.getScraperForStore(slug);
  const ing = new IngestionService();

  const bySku = new Map<string, Record<string, unknown>>();
  for (const cat of CATEGORIES) {
    try {
      const products = await Promise.race([
        scraper.discoverProducts(cat, pages),
        new Promise<Record<string, unknown>[]>((_, r) => setTimeout(() => r(new Error("timeout")), 60000)),
      ]);
      let added = 0;
      for (const p of products) { const k = String(p.sku || p.product_url || p.name_en || ""); if (k && !bySku.has(k)) { bySku.set(k, p); added++; } }
      console.log(`  ${cat.padEnd(18)} discovered=${products.length} new=${added}`);
    } catch (e) { console.log(`  ${cat.padEnd(18)} FAIL: ${(e as Error).message.slice(0, 50)}`); }
  }
  const products = [...bySku.values()];
  const valid = products.filter((p) => (p.name_en || p.name_ar) && Number(p.current_price) > 0 && p.product_url);
  console.log(`\ncollected=${products.length} valid=${valid.length}`);
  const saved = await ing.ingestBatch(slug, valid as never[], storeId, null);
  console.log(`ingested ${saved} raw observations for ${slug} (store ${storeId})`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
