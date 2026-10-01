/**
 * ADR-396 — Amazon as a comparison participant: ASIN identity, detail-page price truth,
 * search tiles as discovery/resurrection signals only, «Currently unavailable» as a state.
 *
 * Measured live (2026-10-01) before this change: tile prices ran +27% over the same row's
 * detail-page price (the tile carried the strike-through list price), 57% of the comparison
 * layer's current amazon observations came from tiles, 4 of 6 "failing" K detail pages were
 * HTTP 200 pages with no buy box whose only prices sat in the similar-items carousel, and
 * 4,993 amazon rows had no external_id so every re-sighting created a duplicate product.
 */
import fs from 'fs';
import path from 'path';
import { AmazonScraper } from '../../src/lib/scraping/stores/amazon-scraper';
import { asinFromUrl, canonicalAmazonUrl, canonicalizeAmazonUrl, isAsin } from '../../src/lib/scraping/utils/amazon-asin';
import { partitionAmazonOffers, verifyAmazonOffers, asinOfOffer, DEAD_MISSES, type KnownAmazonRow } from '../../src/lib/scraping/services/amazon-discovery-gate';
import type { NormalizedOffer } from '../../src/lib/scraping/adapters/types';
import type { ScrapedProduct } from '../../src/lib/scraping/base/types';

const scraper = new AmazonScraper();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priv = scraper as any;
function withPage(html: string) { priv.fetchPage = async () => html; }

const UNAVAILABLE_PAGE = `
<html><body id="a-page"><div id="dp"><div id="dp-container">
  <div id="centerCol"><span id="productTitle"> Samsung Galaxy S26 Cobalt Violet, 256GB Storage </span></div>
  <div id="rightCol"><div id="desktop_buybox"><div id="buybox">
    <div id="outOfStock"><span class="a-color-price a-text-bold">Currently unavailable.</span>
    <span>We don't know when or if this item will be back in stock.</span></div>
  </div></div></div>
  <div id="sims-simsContainer_feature_div_0"><div id="sp_detail"><div id="sp_detail_B0HGLSV7KC">
    <span class="a-price apex-price-to-pay-value"><span class="a-offscreen">SAR 2,599.00</span></span>
  </div></div></div>
  <input name="ASIN" value="B0GNJSXNC8">
</div></div></body></html>`;

const BUYBOX_PAGE = `
<html><body id="a-page"><div id="dp"><div id="dp-container">
  <div id="centerCol"><span id="productTitle"> Samsung 55 Inch Crystal UHD TV, U8000H </span>
    <div id="corePriceDisplay_desktop_feature_div"><div id="apex_desktop">
      <span class="a-price a-text-price"><span class="a-offscreen">SAR1,899.00</span></span>
    </div></div></div>
  <div id="rightCol"><div id="desktop_buybox"><div id="buybox"><div id="qualifiedBuybox">
    <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">SAR1,699.17</span></span></div>
    <div id="availability"><span>In Stock</span></div><input id="add-to-cart-button">
  </div></div></div></div>
  <input name="ASIN" value="B0GS29FHVB">
</div></div></body></html>`;

const TILE_PAGE = `
<html><body>
<div data-component-type="s-search-result" data-asin="B0GS29FHVB">
  <h2><a href="/-/en/Samsung-Crystal-Processor-Dynamic-UA55U8000H/dp/B0GS29FHVB/ref=sr_1_12?dib=abc&qid=1&sr=8-12"><span>Samsung 55 Inch Crystal UHD TV, U8000H, 4K</span></a></h2>
  <span class="a-price"><span class="a-offscreen">SAR 1,699.00</span></span>
  <span class="a-price a-text-price"><span class="a-offscreen">SAR 1,899.00</span></span>
</div>
</body></html>`;

describe('ASIN identity helpers', () => {
  it('reads an ASIN from every amazon URL form and canonicalises to /dp/ASIN without tracking', () => {
    expect(asinFromUrl('https://www.amazon.sa/-/en/Samsung-Crystal/dp/B0GS29FHVB/ref=sr_1_12?dib=x&qid=1')).toBe('B0GS29FHVB');
    expect(asinFromUrl('https://www.amazon.sa/gp/product/b0gs29fhvb?tag=t')).toBe('B0GS29FHVB');
    expect(asinFromUrl('https://www.amazon.sa/-/en/sspa/click?ie=UTF8&spc=abc')).toBeNull();
    expect(canonicalAmazonUrl('b0gs29fhvb')).toBe('https://www.amazon.sa/dp/B0GS29FHVB');
    expect(canonicalizeAmazonUrl('https://www.amazon.sa/x/dp/B0GS29FHVB/ref=sr_1_1')).toBe('https://www.amazon.sa/dp/B0GS29FHVB');
    expect(canonicalizeAmazonUrl('https://www.amazon.sa/s?k=tv')).toBe('https://www.amazon.sa/s?k=tv');
    expect(isAsin('B0GS29FHVB')).toBe(true); expect(isAsin('https://x')).toBe(false); expect(isAsin(null)).toBe(false);
  });
});

describe('detail page: «Currently unavailable» is a state, not an extraction failure', () => {
  it('returns the product with NO offer and availability out_of_stock, never the carousel price', async () => {
    withPage(UNAVAILABLE_PAGE);
    const p = await priv.scrapeProductPage('https://www.amazon.sa/dp/B0GNJSXNC8') as ScrapedProduct | null;
    expect(p).not.toBeNull();
    expect(p!.current_price).toBeNull();
    expect(p!.availability).toBe('out_of_stock');
    expect(p!.sku).toBe('B0GNJSXNC8');
    expect(p!.price_source).toBe('product_page');
  });

  it('a page with a buy box still yields the buy-box price (list price stays original_price)', async () => {
    withPage(BUYBOX_PAGE);
    const p = await priv.scrapeProductPage('https://www.amazon.sa/dp/B0GS29FHVB') as ScrapedProduct | null;
    expect(p!.current_price).toBe(1699.17);
    expect(p!.original_price).toBe(1899);
    expect(p!.availability).toBe('in_stock');
    expect(p!.price_source).toBe('product_page');
  });
});

describe('search tile: canonical URL, tagged as a tile', () => {
  it('persists /dp/ASIN (no title slug, no ref=) and marks price_source search_tile', () => {
    const out = priv.parseListingResults(TILE_PAGE, 'tv') as ScrapedProduct[];
    expect(out).toHaveLength(1);
    expect(out[0].product_url).toBe('https://www.amazon.sa/dp/B0GS29FHVB');
    expect(out[0].sku).toBe('B0GS29FHVB');
    expect(out[0].price_source).toBe('search_tile');
    expect(out[0].current_price).toBe(1699);
  });
});

const offer = (asin: string, price = 100, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  name_ar: 'x', name_en: 'x', brand: 'b', category: 'tv', current_price: price, original_price: null,
  product_url: `https://www.amazon.sa/-/en/t/dp/${asin}/ref=sr_1_1`, image_url: null, availability: 'in_stock',
  barcode: null, external_id: asin, _raw: { sku: asin }, _source: 'amazon-search', ...over,
});
const row = (asin: string, over: Partial<KnownAmazonRow> = {}): KnownAmazonRow => ({ id: 'r-' + asin, product_id: 'p-' + asin, external_id: asin, product_url: `https://www.amazon.sa/dp/${asin}`, availability: 'in_stock', consecutive_misses: 0, ...over });

describe('adapter gate: a known ASIN is never repriced from a tile', () => {
  it('partitions tiles into fresh / resurrect / known-live and canonicalises fresh ones', () => {
    const known = new Map<string, KnownAmazonRow>([
      ['B0000000A1', row('B0000000A1')],
      ['B0000000A2', row('B0000000A2', { availability: 'out_of_stock' })],
      ['B0000000A3', row('B0000000A3', { consecutive_misses: DEAD_MISSES })],
    ]);
    const part = partitionAmazonOffers([
      offer('B0000000A1'), offer('B0000000A2'), offer('B0000000A3'), offer('B0000000A4'), offer('B0000000A4'),
      offer('x', 100, { external_id: 'https://www.amazon.sa/-/en/sspa/click?x', product_url: 'https://www.amazon.sa/-/en/sspa/click?x' }),
    ], known);
    expect(part.knownLive).toBe(1);
    expect(part.resurrect.map((r) => r.row.id).sort()).toEqual(['r-B0000000A2', 'r-B0000000A3']);
    expect(part.fresh).toHaveLength(1); // the duplicate tile of A4 is collapsed
    expect(part.fresh[0].product_url).toBe('https://www.amazon.sa/dp/B0000000A4');
    expect(part.fresh[0].external_id).toBe('B0000000A4');
    expect(part.noAsin).toBe(1);
    expect(asinOfOffer(offer('B0000000A9', 1, { external_id: 'not-an-asin' }))).toBe('B0000000A9');
  });

  it('verifies new ASINs against the detail page: page price wins; no buy box => unverified tile, never fresh', async () => {
    const pages: Record<string, ScrapedProduct | null> = {
      'https://www.amazon.sa/dp/B0000000B1': { name_ar: 'a', name_en: 'a', brand: 'b', model: '', sku: 'B0000000B1', current_price: 1699.17, original_price: 1899, availability: 'in_stock', product_url: 'u', image_urls: [], specifications: {}, category: 'tv', description_ar: null, description_en: null, price_source: 'product_page' },
      'https://www.amazon.sa/dp/B0000000B2': { name_ar: 'a', name_en: 'a', brand: 'b', model: '', sku: 'B0000000B2', current_price: null, original_price: null, availability: 'out_of_stock', product_url: 'u', image_urls: [], specifications: {}, category: 'tv', description_ar: null, description_en: null, price_source: 'product_page' },
      'https://www.amazon.sa/dp/B0000000B3': null,
    };
    const part = partitionAmazonOffers([offer('B0000000B1', 1899), offer('B0000000B2', 500), offer('B0000000B3', 700), offer('B0000000B4', 900)], new Map());
    const out = await verifyAmazonOffers(part.fresh, async (u) => pages[u] ?? null, 3);
    const src = (o: NormalizedOffer) => (o._raw as { _price_source?: string })._price_source;
    expect(out[0].verified).toBe(true); expect(out[0].offer.current_price).toBe(1699.17); expect(src(out[0].offer)).toBe('product_page');
    expect(out[1].verified).toBe(false); expect(out[1].unavailable).toBe(true); expect(out[1].offer.availability).toBe('out_of_stock'); expect(src(out[1].offer)).toBe('search_tile_unverified');
    expect(out[2].verified).toBe(false); expect(out[2].offer.current_price).toBe(700); expect(src(out[2].offer)).toBe('search_tile_unverified');
    expect(out[3].verified).toBe(false); expect(src(out[3].offer)).toBe('search_tile_unverified'); // beyond the per-run budget
  });
});

describe('fence — static wiring', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const route = read('src/app/api/cron/discover-firecrawl/route.ts');
  const orch = read('src/lib/scraping/services/scraping-orchestrator.ts');
  const disc = read('scripts/worker/jobs/discovery.ts');

  it('the adapter route gates amazon before raw observations and never snapshots an unverified tile', () => {
    expect(route).toContain("if (adapter.slug === 'amazon')");
    expect(route).toContain('writeRawObservations(offers.filter((o) => !isUnverifiedTile(o))');
    expect(route).toContain('if (unverified) continue;');
    expect(route).toContain('updated_at: unverified ? null : new Date().toISOString()');
    expect(route).toContain("...(isAmazon && asin ? { external_id: asin } : {})");
  });

  it('the worker never reprices a known amazon ASIN from a tile and treats unavailable as a state', () => {
    expect(orch).toContain("if (storeSlug === 'amazon' && !options.dry_run)");
    expect(orch).toContain('this.dropKnownAmazonAsins(scrapedProducts, storeId)');
    expect(orch).toContain("if (scrapedProduct.availability === 'out_of_stock')");
    expect(orch).toContain("result: 'UNAVAILABLE'");
    expect(orch).toContain("availability: 'out_of_stock', consecutive_misses: misses, scrape_status: 'ok'");
  });

  it("the worker's tile-only amazon discovery is off (adapter route owns amazon discovery)", () => {
    expect(disc).toContain('amazon: [] as ProductCategory[]');
  });
});
