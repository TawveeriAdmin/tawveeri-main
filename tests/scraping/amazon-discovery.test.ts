import { amazonAdapter, AMAZON_DISCOVERY_QUERIES } from '@/lib/scraping/adapters/amazon';
import { AmazonSearchScraper } from '@/lib/scraping/search/amazon-search-scraper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const product = (sku: string): SearchProduct => ({
  sku, name_ar: 'Nikai 36 Liter Electric Oven NT655RX2', name_en: 'Nikai 36 Liter Electric Oven NT655RX2',
  current_price: 295, original_price: null, brand: 'Nikai', model: 'NT655RX2',
  product_url: `https://www.amazon.sa/dp/${sku}`, image_urls: [], specifications: {},
  category: 'kitchen', availability: 'in_stock', description_ar: null, description_en: null,
  store: 'amazon', store_name: 'Amazon SA',
});
const result = (products: SearchProduct[]) => ({ products, count: products.length, store: 'amazon', storeName: 'Amazon SA' });

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('a full batch resumes at the next item on the same page, without dropping the tail', async () => {
  const items = [product('B07MW53MQG'), product('B0DFM1D1LY'), product('B07QP3TDM8')];
  const search = jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue(result(items));
  const first = await amazonAdapter.fetchBatch(0, 2);
  expect(first.offers.map(p => p.external_id)).toEqual(['B07MW53MQG', 'B0DFM1D1LY']);
  expect(first.done).toBe(false);
  const second = await amazonAdapter.fetchBatch(first.nextState, 1);
  expect(second.offers.map(p => p.external_id)).toEqual(['B07QP3TDM8']);
  expect(search).toHaveBeenLastCalledWith({ query: 'مكيف', pages: 1, startPage: 1 });
});

test('legacy query-index cursors keep their meaning', async () => {
  const search = jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue(result([product('B07MW53MQG')]));
  await amazonAdapter.fetchBatch(8, 1);
  expect(search).toHaveBeenCalledWith({ query: 'مايكروويف', pages: 1, startPage: 1 });
});

test('merchant failure retains the cursor and reports partial discovery', async () => {
  jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue({ ...result([]), error: 'HTTP 503' });
  expect(await amazonAdapter.fetchBatch(11, 20)).toEqual({ offers: [], nextState: 1_110_000, done: false, lastError: 'HTTP 503' });
});

test('required source queries are reachable after the legacy sequence', () => {
  expect(AMAZON_DISCOVERY_QUERIES.slice(11)).toEqual(expect.arrayContaining([
    'electric oven', 'gas cooker', 'built in oven', 'ipad', 'gaming laptop',
    'macbook', 'chromebook', 'laptop charger', 'laptop docking station',
  ]));
});

test('invalid cursor and batch limit fail before fetching', async () => {
  const search = jest.spyOn(AmazonSearchScraper.prototype, 'search');
  await expect(amazonAdapter.fetchBatch(-1, 20)).rejects.toThrow('cursor');
  await expect(amazonAdapter.fetchBatch(0, 0)).rejects.toThrow('batch');
  expect(search).not.toHaveBeenCalled();
});

test('page-two cursor does not restart page one', async () => {
  const search = jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue(result([product('B07MW53MQG')]));
  await amazonAdapter.fetchBatch(1_001_000, 1);
  expect(search).toHaveBeenCalledWith({ query: 'مكيف', pages: 1, startPage: 2 });
});

test('duplicate and unpriced rows cannot cause an unbounded batch', async () => {
  jest.useFakeTimers();
  const search = jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue(result([
    product('B07MW53MQG'), product('B07MW53MQG'), { ...product('B0DFM1D1LY'), current_price: null },
  ]));
  const pending = amazonAdapter.fetchBatch(0, 300);
  await jest.runAllTimersAsync();
  const batch = await pending;
  expect(search).toHaveBeenCalledTimes(8);
  expect(batch.offers).toHaveLength(1);
  expect(batch.done).toBe(false);
  expect(batch.nextState).toBe(1_040_000);
});

test('the end of the final query resets the cycle', async () => {
  jest.spyOn(AmazonSearchScraper.prototype, 'search').mockResolvedValue(result([]));
  expect(await amazonAdapter.fetchBatch(AMAZON_DISCOVERY_QUERIES.length - 1, 20))
    .toEqual({ offers: [], nextState: 0, done: true });
});

test('HTTP failure is not silently converted to a successful empty search', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('HTTP 503'));
  const response = await new AmazonSearchScraper().search({ query: 'electric oven', pages: 1 });
  expect(response.error).toContain('HTTP 503');
  expect(response.products).toEqual([]);
});

test('challenge HTML is not treated as the end of the catalog', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>Enter the characters you see below</html>'));
  const response = await new AmazonSearchScraper().search({ query: 'electric oven', pages: 1 });
  expect(response.error).toContain('could not be verified');
});

test('a real no-results page completes without an error', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>No results for this query</html>'));
  const response = await new AmazonSearchScraper().search({ query: 'electric oven', pages: 1, startPage: 2 });
  expect(response.error).toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&page=2&'), expect.anything());
});
