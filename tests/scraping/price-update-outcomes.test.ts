import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import { BrowserlessQuotaError } from '@/lib/scraping/base/base-scraper';

const mockWrite = jest.fn();
const mockIngest = jest.fn();
const mockUpdates: Record<string, unknown>[] = [];
let mockRows: Record<string, unknown>[] = [];
let mockReadError: unknown = null;
jest.mock('@/lib/scraping/services/product-service', () => ({ ProductService: jest.fn(() => ({ updateProductPrice: mockWrite })) }));
jest.mock('@/lib/scraping/services/ingestion-service', () => ({ IngestionService: jest.fn(() => ({ ingestBatch: mockIngest })) }));
jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => {
  const q: any = {
    select: () => q, eq: () => q, or: () => q, order: () => q, limit: () => q,
    update: (v: Record<string, unknown>) => { mockUpdates.push(v); return q; },
    maybeSingle: async () => ({ data: { consecutive_misses: 0 }, error: null }),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: mockRows, error: mockReadError }).then(resolve),
  }; return q;
} }) }));

describe('real price orchestrator business outcomes with isolated providers', () => {
  let scraper: { config: { rate_limit: { min_delay_ms: number; max_delay_ms: number } }; updateProductPricesBatch: jest.Mock; cleanup: jest.Mock };
  const row = (n: number) => ({ id: `offer-${n}`, product_id: `product-${n}`, store_id: '1', product_url: `https://example.test/${n}`, current_price: 1000, availability: 'in_stock', stores: { slug: 'amazon' } });
  const product = (price: number | null = 1000) => ({ name_en: 'Fixture', current_price: price, availability: 'in_stock' });
  let orchestrator: ScrapingOrchestrator;
  beforeEach(() => {
    mockRows = [row(1), row(2)]; mockReadError = null; mockUpdates.length = 0;
    mockWrite.mockReset().mockResolvedValue({ accepted: true });
    mockIngest.mockReset().mockResolvedValue(1);
    scraper = { config: { rate_limit: { min_delay_ms: 0, max_delay_ms: 0 } }, cleanup: jest.fn().mockResolvedValue(undefined), updateProductPricesBatch: jest.fn().mockResolvedValue(new Map([['https://example.test/1', product()], ['https://example.test/2', product()]])) };
    orchestrator = new ScrapingOrchestrator();
    jest.spyOn(orchestrator, 'getScraperForStore').mockReturnValue(scraper as any);
  });
  afterEach(() => jest.restoreAllMocks());
  const run = () => orchestrator.runPriceUpdateJob({ store_slug: 'amazon', max_products: 2, older_than_hours: 12 });

  it('counts unchanged accepted prices, writes the selected offer and records each observation', async () => {
    expect(await run()).toMatchObject({ success: true, outcome: 'success', products_updated: 2, price_changes: 0, stores_updated: 1, stages: { selected: 2, attempted: 2, extracted: 2, accepted: 2, written: 2, observations_ingested: 2 } });
    expect(mockWrite).toHaveBeenNthCalledWith(1, 'product-1', '1', 1000, 'in_stock', undefined, 'offer-1');
    expect(scraper.cleanup).toHaveBeenCalledTimes(1);
  });
  it('never promotes a quarantined price into freshness, ingestion or a successful count', async () => {
    mockWrite.mockResolvedValue({ accepted: false });
    expect(await run()).toMatchObject({ success: false, outcome: 'failed', products_updated: 0, stores_updated: 0, errors: 2, stages: { rejected: 2, observations_ingested: 0 } });
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpdates.every(v => !('last_scraped_at' in v) && !('updated_at' in v))).toBe(true);
  });
  it('all extraction failures fail the whole job', async () => {
    scraper.updateProductPricesBatch.mockResolvedValue(new Map());
    expect(await run()).toMatchObject({ success: false, outcome: 'failed', products_updated: 0, errors: 2 });
  });
  it('one accepted and one failed offer is partial', async () => {
    scraper.updateProductPricesBatch.mockResolvedValue(new Map([['https://example.test/1', product()]]));
    expect(await run()).toMatchObject({ success: true, outcome: 'partial', products_updated: 1, errors: 1 });
  });
  it('observation write failure is partial even after a successful storefront write', async () => {
    mockIngest.mockResolvedValue(0);
    expect(await run()).toMatchObject({ outcome: 'partial', products_updated: 2, errors: 2, stages: { written: 2, observations_ingested: 0 } });
  });
  it('product truth without an offer never refreshes successful price time', async () => {
    scraper.updateProductPricesBatch.mockResolvedValue(new Map([['https://example.test/1', product(null)], ['https://example.test/2', product(null)]]));
    expect(await run()).toMatchObject({ outcome: 'partial', products_updated: 0, errors: 0, stages: { product_only: 2, observations_ingested: 2 } });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockUpdates).toEqual([ { last_checked_at: expect.any(String) }, { last_checked_at: expect.any(String) } ]);
  });
  it('quota before any accepted offer cannot report partial success', async () => {
    scraper.updateProductPricesBatch.mockRejectedValue(new BrowserlessQuotaError('quota'));
    expect(await run()).toMatchObject({ success: false, outcome: 'failed', products_updated: 0, stages: { deferred: 2 } });
    expect(mockUpdates).toHaveLength(0);
    expect(scraper.cleanup).toHaveBeenCalledTimes(1);
  });
  it('a rejected data read prevents provider work', async () => {
    mockReadError = { message: 'exceed_egress_quota' };
    expect(await run()).toMatchObject({ success: false, products_updated: 0 });
    expect(scraper.updateProductPricesBatch).not.toHaveBeenCalled();
  });
  it('does not retry an entire provider after its own retry budget or permanent error', async () => {
    const perUrl = { config: { rate_limit: { min_delay_ms: 0, max_delay_ms: 0 } }, updateProductPrice: jest.fn().mockRejectedValue(new Error('HTTP 403')), cleanup: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(orchestrator, 'getScraperForStore').mockReturnValue(perUrl as any);
    expect(await run()).toMatchObject({ outcome: 'failed', errors: 2 });
    expect(perUrl.updateProductPrice).toHaveBeenCalledTimes(2);
    expect(perUrl.cleanup).toHaveBeenCalledTimes(1);
  });
  it('an empty successful query is a no-work check with zero freshness claims', async () => {
    mockRows = [];
    expect(await run()).toMatchObject({ outcome: 'success', products_updated: 0, stores_updated: 0, stages: { selected: 0, attempted: 0, written: 0 } });
  });
});
