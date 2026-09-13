// scripts/tps-analysis/ingest-samsung-gated-cohort.ts
// ─────────────────────────────────────────────────────────────────────────────
// Samsung KSA official-catalog Phase 1 execution (2026-09-13). Bounded, one-time
// ingestion of the previously-gated cohort (identities with real evidence but
// no prior raw_observations, per ADR-354/355/356's own classification) through
// the REAL, already-fixed production path — no parallel Samsung system:
//
//   SamsungKsaScraper.updateProductPrice(url)   (real scraper, now spec-table +
//                                                 no-offer aware)
//   -> IngestionService.ingestBatch(...)        (real raw_observations write,
//                                                 store_id=6, exact same
//                                                 function the hourly cron uses)
//
// Canonicalization is a SEPARATE, subsequent step:
//   npx tsx scripts/tps-core/normalize-incremental.ts --stores 6 --batches 20 --limit 500
//
// Bounded: only the URL list given on argv[2] (a JSON array), never a full
// catalog crawl. Idempotent: raw_observations is append-only and safe to
// re-run; ingestBatch does not dedupe, so this script is meant to run ONCE per
// URL set. No parallel Samsung write path is created — this literally reuses
// the same two production classes the real recurring scrape uses.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
// Dynamic imports, deliberately: these modules read process.env.NEXT_PUBLIC_SUPABASE_URL
// etc. at MODULE-LOAD time (top-level const in src/lib/database/supabase.ts). A static
// `import` is hoisted above the `config()` call above regardless of source order, so the
// env would still be empty when the module initializes. seed-samsung-ksa-sitemap.ts
// already established this exact pattern for the same reason.

async function main() {
  const { SamsungKsaScraper } = await import('../../src/lib/scraping/stores/samsung-ksa-scraper');
  const { IngestionService } = await import('../../src/lib/scraping/services/ingestion-service');

  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: ingest-samsung-gated-cohort.ts <urls.json array file>'); process.exit(1); }
  const urls: string[] = JSON.parse(readFileSync(inputFile, 'utf8'));
  console.log(`Ingesting ${urls.length} Samsung KSA URLs through the real production path (scraper -> IngestionService)...`);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: storeRow, error: storeErr } = await sb.from('stores').select('id').eq('slug', 'samsung_ksa').single();
  if (storeErr || !storeRow) { console.error('Could not resolve samsung_ksa store id:', storeErr?.message); process.exit(1); }
  const storeId = (storeRow as { id: number | string }).id;
  console.log('Resolved samsung_ksa store_id:', storeId);

  const scraper = new SamsungKsaScraper();
  const ingestion = new IngestionService();

  let withOffer = 0, noOffer = 0, failed = 0, noIdentity = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const product = await scraper.updateProductPrice(url);
      if (!product) {
        noIdentity++;
        console.log(`[${i + 1}/${urls.length}] NO IDENTITY — ${url.slice(-60)}`);
      } else {
        await ingestion.ingestBatch('samsung_ksa', [product], Number(storeId), null);
        if (product.current_price != null) withOffer++; else noOffer++;
        console.log(`[${i + 1}/${urls.length}] INGESTED ${product.current_price != null ? `price=${product.current_price}` : 'NO_OFFER'} — ${product.category} — ${url.slice(-60)}`);
      }
    } catch (e) {
      failed++;
      console.warn(`[${i + 1}/${urls.length}] FAILED: ${e instanceof Error ? e.message : e} — ${url.slice(-60)}`);
    }
    await new Promise((res) => setTimeout(res, 300));
  }

  console.log('\n=== INGESTION SUMMARY ===');
  console.log('Total URLs:', urls.length);
  console.log('Ingested WITH a current price:', withOffer);
  console.log('Ingested WITHOUT a current price (Product Truth only):', noOffer);
  console.log('No identity at all (skipped):', noIdentity);
  console.log('Fetch/write failures:', failed);
  console.log('\nNext step: npx tsx scripts/tps-core/normalize-incremental.ts --stores 6 --batches 20 --limit 500');
}

main().catch((e) => { console.error(e); process.exit(1); });
