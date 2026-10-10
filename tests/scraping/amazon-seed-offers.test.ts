// tests/scraping/amazon-seed-offers.test.ts — external review 2026-10-06, item 7: Amazon.sa listings with strong offers (Midea MDRT765FGU46DO 2,899, LG 75QNED9M 4,649,
// ECOVACS T50 PRO OMNI 1,931) were in stock on amazon.sa and absent from our catalogue because discovery only walks 26 broad queries × 2 pages. A targeted seed is read on the
// detail page and persisted only with a buy-box price in stock, only when its ASIN has no storefront row, and never from a guess.
import { verifiedSeedOffers } from '@/lib/scraping/services/amazon-discovery-gate';
import type { KnownAmazonRow } from '@/lib/scraping/services/amazon-discovery-gate';
import { allAmazonSeeds, AMAZON_SEED_ASINS } from '@/lib/scraping/config/amazon-seed-asins';
import type { ScrapedProduct } from '@/lib/scraping/base/types';

const page = (over: Partial<ScrapedProduct> = {}): ScrapedProduct => ({
  name_ar: 'Midea Refrigerator Double Door MDRT765FGU46DO', name_en: 'Midea Refrigerator Double Door MDRT765FGU46DO', brand: 'Unknown', model: '', sku: null,
  current_price: 2899, original_price: 6000, availability: 'in_stock', product_url: 'https://www.amazon.sa/dp/B0FB3TL22Z', image_urls: ['https://m.media-amazon.com/x.jpg'],
  specifications: {}, category: '' as never, description_ar: null, description_en: null, ...over,
});
const row = (asin: string): KnownAmazonRow => ({ id: 'ps1', product_id: 'p1', external_id: asin, product_url: `https://www.amazon.sa/dp/${asin}`, availability: 'in_stock', consecutive_misses: 0 });

describe('verifiedSeedOffers', () => {
  it('turns a seed with no storefront row into a verified, canonical-URL offer carrying the page price, the page title and the seed brand', async () => {
    const r = await verifiedSeedOffers([{ asin: 'B0FB3TL22Z', brand: 'Midea' }], new Map(), async () => page(), 6);
    expect(r.offers).toHaveLength(1);
    expect(r.offers[0]).toMatchObject({ external_id: 'B0FB3TL22Z', product_url: 'https://www.amazon.sa/dp/B0FB3TL22Z', brand: 'Midea', current_price: 2899, original_price: 6000, availability: 'in_stock', _source: 'amazon-search' });
    expect((r.offers[0]._raw as { _price_source: string })._price_source).toBe('product_page');
    // the normalizer reads the RAW payload: the seed brand must be there, not the page's 'Unknown'
    expect((r.offers[0]._raw as { brand: string }).brand).toBe('Midea');
  });

  it('skips a seed whose ASIN already has a storefront row (idempotent; never reprices a known row)', async () => {
    let reads = 0;
    const r = await verifiedSeedOffers([{ asin: 'B0FB3TL22Z' }], new Map([['B0FB3TL22Z', row('B0FB3TL22Z')]]), async () => { reads++; return page(); }, 6);
    expect(r.offers).toHaveLength(0); expect(r.alreadyKnown).toBe(1); expect(reads).toBe(0);
  });

  it('persists nothing without a buy-box price, when unavailable, when the read fails or throws, or when the page has no title', async () => {
    const seeds = [{ asin: 'AAAAAAAAA1' }, { asin: 'AAAAAAAAA2' }, { asin: 'AAAAAAAAA3' }, { asin: 'AAAAAAAAA4' }, { asin: 'AAAAAAAAA5' }];
    const pages = [page({ current_price: null }), page({ availability: 'out_of_stock' }), null, 'throw', page({ name_ar: '', name_en: '' })] as const;
    let i = 0;
    const r = await verifiedSeedOffers(seeds, new Map(), async () => { const p = pages[i++]; if (p === 'throw') throw new Error('boom'); return p as ScrapedProduct | null; }, 10);
    expect(r.offers).toHaveLength(0);
    expect(r.unavailable).toBe(1); expect(r.failed).toBe(4);
  });

  it('reads at most `max` unknown seeds per run; a limited-stock listing is still an in-stock offer; an Unknown page brand never overrides the seed brand', async () => {
    const seeds = [{ asin: 'AAAAAAAAA1', brand: 'LG' }, { asin: 'AAAAAAAAA2' }, { asin: 'AAAAAAAAA3' }];
    const r = await verifiedSeedOffers(seeds, new Map(), async () => page({ availability: 'limited_stock' }), 2);
    expect(r.requested).toBe(2); expect(r.offers).toHaveLength(2);
    expect(r.offers[0].availability).toBe('in_stock'); expect(r.offers[0].brand).toBe('LG'); expect(r.offers[1].brand).toBe('');
  });

  it('ignores a malformed ASIN', async () => {
    const r = await verifiedSeedOffers([{ asin: 'not-an-asin' }], new Map(), async () => page(), 6);
    expect(r.requested).toBe(0); expect(r.offers).toHaveLength(0);
  });
});

describe('allAmazonSeeds', () => {
  it('returns the code seeds, each with an evidence line, and every ASIN is well formed and unique', () => {
    const all = allAmazonSeeds('');
    expect(all.map((s) => s.asin)).toEqual(AMAZON_SEED_ASINS.map((s) => s.asin));
    expect(new Set(all.map((s) => s.asin)).size).toBe(all.length);
    for (const s of all) { expect(s.asin).toMatch(/^[A-Z0-9]{10}$/); expect(s.evidence.length).toBeGreaterThan(10); }
  });
  it('adds env ASINs (trimmed, upper-cased, de-duplicated, malformed dropped) without duplicating a code seed', () => {
    const all = allAmazonSeeds(` b0abcdefg1 , ${AMAZON_SEED_ASINS[0].asin}, bad, B0ABCDEFG1 `);
    expect(all.filter((s) => s.asin === 'B0ABCDEFG1')).toHaveLength(1);
    expect(all.filter((s) => s.asin === AMAZON_SEED_ASINS[0].asin)).toHaveLength(1);
    expect(all.some((s) => s.asin === 'BAD')).toBe(false);
  });
});
