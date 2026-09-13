// scripts/tps-analysis/verify-production-reproducibility.ts
// ─────────────────────────────────────────────────────────────────────────────
// Samsung KSA official-gateway repair mission (2026-09-13), Section 8 requirement:
// "After capture, run the REAL production plugin without audit-only URL/path
// hints. Do NOT count identities that only work because an audit script
// injected a URL-path hint unavailable to production."
//
// This is the honest test: the REAL, unmodified SamsungKsaScraper.updateProductPrice()
// (now capturing the spec table for real), the REAL adaptRow() (now injecting
// captured spec text), and the REAL category-registry sweep loop — exactly the
// same "try every category's detect(), take whichever accepts" logic
// progressive-engine.ts runs in production. No URL-path routing, no bypass,
// no local script overrides of any kind.
//
// Read-only. No DB writes.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { readFileSync, writeFileSync } from 'fs';
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
import { adaptRow } from '../tps-core/progressive-engine';
import { CATEGORY_DEFS } from '../tps-core/category-registry';

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: verify-production-reproducibility.ts <urls.json array file>'); process.exit(1); }
  const urls: string[] = JSON.parse(readFileSync(inputFile, 'utf8'));
  console.log(`Verifying ${urls.length} URLs through the REAL production pipeline (scraper -> adaptRow -> category sweep)...`);

  const scraper = new SamsungKsaScraper();
  const results: Array<{
    url: string;
    scraped: boolean;
    specCount: number;
    detectedCategory: string | null;
    productionIdentityKey: string | null;
    productionStatus: string | null;
    currentPrice: number | null;
  }> = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let row: { scraped: boolean; specCount: number; detectedCategory: string | null; productionIdentityKey: string | null; productionStatus: string | null; currentPrice: number | null };
    try {
      const product = await scraper.updateProductPrice(url);
      if (!product) {
        row = { scraped: false, specCount: 0, detectedCategory: null, productionIdentityKey: null, productionStatus: null, currentPrice: null };
      } else {
        const specCount = Object.keys((product.specifications as { raw?: Record<string, unknown> })?.raw ?? {}).length;
        // Spread the FULL scraped product — this must match IngestionService.ingestBatch's
        // own `payload: { ...p, ... }` exactly (src/lib/scraping/services/ingestion-service.ts),
        // or this script tests a weaker input than real production ever does. PROVEN BUG
        // (2026-09-13): an earlier version of this script only passed
        // {name_en,name_ar,brand,specifications} — omitting `model`/`sku` — which made every
        // audio identity relying on `extractManufacturerModel(payload)` (the shared
        // key-integrity authority, ADR-058) appear "blocked" here when real production,
        // which DOES receive the full object, was never actually blocked at all.
        const payload: Record<string, unknown> = { ...product };
        const { nameAr, nameEn, brand } = adaptRow(payload, null);
        let detectedCategory: string | null = null;
        let productionIdentityKey: string | null = null;
        let productionStatus: string | null = null;
        // EXACTLY the real sweep's loop shape (progressive-engine.ts): try every
        // registered category's detect(), first acceptor wins. No URL routing.
        for (const def of Object.values(CATEGORY_DEFS)) {
          if (!def.plugin.detect(nameAr, nameEn)) continue;
          const norm = def.normalize(nameAr, nameEn, brand, payload);
          const identity = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
          detectedCategory = def.category;
          productionIdentityKey = identity.key;
          productionStatus = identity.status;
          break;
        }
        row = { scraped: true, specCount, detectedCategory, productionIdentityKey, productionStatus, currentPrice: product.current_price };
      }
    } catch (e) {
      row = { scraped: false, specCount: 0, detectedCategory: null, productionIdentityKey: null, productionStatus: null, currentPrice: null };
      console.warn(`  [${i + 1}/${urls.length}] FETCH ERROR: ${url}`, e instanceof Error ? e.message : e);
    }
    results.push({ url, ...row });
    console.log(`[${i + 1}/${urls.length}] specs=${row.specCount} cat=${row.detectedCategory ?? '-'} -> ${row.productionIdentityKey ?? 'NOT_REPRODUCIBLE'} (${row.productionStatus ?? 'n/a'}) — ${url.slice(-60)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }

  const reproducible = results.filter((r) => r.productionIdentityKey && r.productionStatus !== 'invalid');
  console.log('\n=== SUMMARY ===');
  console.log('Total URLs:', results.length);
  console.log('Now production-reproducible (real scraper -> real adaptRow -> real unmodified plugin detect()):', reproducible.length);
  console.log('Still NOT production-reproducible:', results.length - reproducible.length);

  writeFileSync(
    resolve(process.cwd(), 'scripts/tps-analysis/.production-reproducibility-result.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log('\nSaved to scripts/tps-analysis/.production-reproducibility-result.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
