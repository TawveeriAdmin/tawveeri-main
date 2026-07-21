/**
 * Store-identity + run-id propagation through the discover-products ingestion chain.
 *
 * Regression guard for the E3-follow-up remediation. The first post-deploy Jarir
 * run exposed two gaps on the discover-products path (the adapter path was
 * already correct):
 *   - raw_observations written by IngestionService had store_id but NULL
 *     scraping_run_id (the run id was never propagated).
 *   - price_history written by recordPriceHistory had NULL store_id (it was
 *     resolved but not written).
 *
 * These are pure unit tests: @/lib/database is mocked and the inserted rows are
 * captured, so no database is required.
 */

import { IngestionService } from '@/lib/scraping/services/ingestion-service';
import { ProductService } from '@/lib/scraping/services/product-service';
import fs from 'fs';
import path from 'path';

// ── Chainable Supabase mock ───────────────────────────────────
// Records every insert as { table, rows }. select/eq/maybeSingle return
// caller-provided fixtures so recordPriceHistory can resolve its lookups.
type Insert = { table: string; rows: any };

function makeMockClient(fixtures: Record<string, any>) {
  const inserts: Insert[] = [];

  function from(table: string) {
    const builder: any = {
      _table: table,
      insert(rows: any) {
        inserts.push({ table, rows });
        // supabase insert returns a thenable resolving to { error, count }
        return Promise.resolve({ error: null, count: Array.isArray(rows) ? rows.length : 1 });
      },
      select() { return builder; },
      eq() { return builder; },
      maybeSingle() { return Promise.resolve({ data: fixtures[table] ?? null, error: null }); },
      single() { return Promise.resolve({ data: fixtures[table] ?? null, error: null }); },
    };
    return builder;
  }

  return { client: { from }, inserts };
}

// Mock the database module so the services under test use our client.
let currentMock = makeMockClient({});
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentMock.client,
}));

describe('discover-products ingestion propagates store_id and scraping_run_id', () => {
  const JARIR_STORE_ID = 1;
  const RUN_ID = 89;

  it('raw_observations receives the passed store_id AND scraping_run_id at insert', async () => {
    currentMock = makeMockClient({});
    const svc = new IngestionService();
    // storeId and scrapingRunId are supplied by the caller (the orchestrator).
    await svc.ingestBatch('jarir', [{ name_ar: 'منتج', current_price: 10 } as any], JARIR_STORE_ID, RUN_ID);

    const rawInsert = currentMock.inserts.find((i) => i.table === 'raw_observations');
    expect(rawInsert).toBeDefined();
    const row = Array.isArray(rawInsert!.rows) ? rawInsert!.rows[0] : rawInsert!.rows;
    expect(row.store_id).toBe(JARIR_STORE_ID);
    expect(row.scraping_run_id).toBe(RUN_ID);
  });

  it('raw_observations uses the store_id passed in, not an independently re-resolved value', async () => {
    currentMock = makeMockClient({});
    const svc = new IngestionService();
    // A deliberately unusual id proves the value flows through unchanged rather
    // than being re-derived from the slug downstream.
    await svc.ingestBatch('jarir', [{ name_ar: 'x', current_price: 1 } as any], 999, RUN_ID);

    const row = currentMock.inserts.find((i) => i.table === 'raw_observations')!.rows[0];
    expect(row.store_id).toBe(999);
  });

  it('scraping_run_id may be null (manual/unlogged run) without breaking ingestion', async () => {
    currentMock = makeMockClient({});
    const svc = new IngestionService();
    const saved = await svc.ingestBatch('jarir', [{ name_ar: 'x', current_price: 1 } as any], JARIR_STORE_ID, null);
    const row = currentMock.inserts.find((i) => i.table === 'raw_observations')!.rows[0];
    expect(row.store_id).toBe(JARIR_STORE_ID);
    expect(row.scraping_run_id).toBeNull();
    expect(saved).toBe(1);
  });

  it('price_history receives store_id at insert', async () => {
    // recordPriceHistory resolves store_id from the product_store, then stores.slug.
    currentMock = makeMockClient({
      product_stores: { store_id: JARIR_STORE_ID },
      stores: { slug: 'jarir' },
    });
    const svc = new ProductService();
    await svc.recordPriceHistory('product-store-uuid', 1299, {
      availability: 'in_stock',
      scrapingRunId: RUN_ID,
    });

    const priceInsert = currentMock.inserts.find((i) => i.table === 'price_history');
    expect(priceInsert).toBeDefined();
    const row = Array.isArray(priceInsert!.rows) ? priceInsert!.rows[0] : priceInsert!.rows;
    expect(row.store_id).toBe(JARIR_STORE_ID);
    expect(row.store_name).toBe('jarir');
  });
});

describe('adapter path (discover-firecrawl) remains unchanged', () => {
  // The adapter path does not use IngestionService or ProductService; it has its
  // own writers. Guard statically that those writers still carry store_id and
  // scraping_run_id, so this remediation did not regress the already-correct path.
  const routeSrc = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'api', 'cron', 'discover-firecrawl', 'route.ts'),
    'utf8'
  );

  it('raw_observations write still includes store_id and scraping_run_id', () => {
    // writeRawObservations row object
    expect(routeSrc).toMatch(/store_id:\s*storeId,\s*store_name:\s*storeName,\s*source_method/);
    expect(routeSrc).toMatch(/scraping_run_id:\s*runId/);
  });

  it('price_history write still includes store_id', () => {
    expect(routeSrc).toMatch(/canonical_product_id:\s*canonicalId,\s*store_id:\s*storeId/);
  });

  it('IngestionService no longer re-resolves identity independently', () => {
    const svcSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'scraping', 'services', 'ingestion-service.ts'),
      'utf8'
    );
    // The authoritative store_id now flows in from the caller; no downstream
    // resolveStoreId re-inference.
    expect(svcSrc).not.toMatch(/resolveStoreId/);
  });
});
