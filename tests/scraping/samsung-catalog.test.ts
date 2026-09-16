import { fetchSamsungCatalog, samsungSaudiUrl, samsungCatalogProduct, type SamsungCatalogObservation } from '../../src/lib/scraping/stores/samsung-catalog';

const family = (id: string, model = 'SM-X400NZSAMEA') => ({ familyId: id, modelCount: '1',
  categorySubTypeEngName: 'Galaxy Tab', modelList: [{ modelCode: model, displayName: 'Galaxy Tab',
    pdpUrl: '/sa_en/tablets/galaxy-tab/', originPdpUrl: `/sa_en/tablets/galaxy-tab/${model.toLowerCase()}/` }] });
const response = (start: number, end: number, total: number, families: unknown[]) => ({ ok: true,
  json: async () => ({ response: { resultData: { common: { fromRecord: String(start), toRecord: String(end), totalRecord: String(total) }, productList: families } } }) });

describe('Samsung public catalog enumeration', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });
  it('advances by actual page bounds and preserves exact commercial variants', async () => {
    const mock = jest.fn().mockResolvedValueOnce(response(1, 1, 2, [family('1')]))
      .mockResolvedValueOnce(response(2, 2, 2, [family('2', 'SM-X400NZAAMEA')]));
    global.fetch = mock;
    const rows = await fetchSamsungCatalog(['01020000'], ['sa_en']);
    expect(rows.map(row => row.model.modelCode)).toEqual(['SM-X400NZSAMEA', 'SM-X400NZAAMEA']);
    expect(mock.mock.calls[1][0]).toContain('start=2');
  });
  it('fails closed on an incomplete model list instead of reporting a successful denominator', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(1, 1, 1, [{ ...family('1'), modelCount: '2' }]));
    await expect(fetchSamsungCatalog(['01020000'], ['sa_en'])).rejects.toThrow('incomplete variants');
  });
  it('fails closed on a repeated page and a source error', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(1, 1, 2, [family('1')]));
    await expect(fetchSamsungCatalog(['01020000'], ['sa_en'])).rejects.toThrow('repeated a family');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchSamsungCatalog(['01020000'], ['sa_en'])).rejects.toThrow('503');
  });
  it('accepts a genuinely empty category without inventing products', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(0, 0, 0, []));
    expect(await fetchSamsungCatalog(['04050000'], ['sa_en'])).toEqual([]);
  });
  it('keeps Saudi consumer paths and rejects lookalike hosts and foreign locales', () => {
    expect(samsungSaudiUrl('/sa/tablets/example/')).toBe('https://www.samsung.com/sa/tablets/example/');
    expect(samsungSaudiUrl('https://evil-samsung.com/sa/example/')).toBeNull();
    expect(samsungSaudiUrl('https://www.samsung.com/us/example/')).toBeNull();
  });
  it('uses the public sale price, exact variant link, and independently affirmative stock evidence', () => {
    const item: SamsungCatalogObservation = { site: 'sa_en', type: '01020000', subcategory: 'Galaxy Tab', familyId: '1',
      observedAt: '2026-09-16T08:00:00Z', sourceUrl: 'https://searchapi.samsung.com/v6/front/b2c/product/finder/global',
      model: { ...family('1').modelList[0], price: '1749', promotionPrice: '1399', priceCurrency: 'SAR',
        stockStatusText: 'inStock', ctaEngText: 'Buy', ctaType: 'whereToBuy' } };
    expect(samsungCatalogProduct(item)).toMatchObject({ current_price: 1399, original_price: 1749,
      availability: 'in_stock', product_url: 'https://www.samsung.com/sa_en/tablets/galaxy-tab/sm-x400nzsamea/' });
    expect(samsungCatalogProduct({ ...item, model: { ...item.model, ctaEngText: 'Coming soon' } }).availability).toBe('out_of_stock');
    expect(samsungCatalogProduct({ ...item, model: { ...item.model, ctaEngText: null } }).availability).toBe('in_stock');
    expect(samsungCatalogProduct({ ...item, model: { ...item.model, priceCurrency: 'USD' } }).current_price).toBeNull();
    expect(samsungCatalogProduct({ ...item, model: { ...item.model, price: '24', promotionPrice: '0' } }))
      .toMatchObject({ current_price: 0, original_price: 24 });
  });
});
