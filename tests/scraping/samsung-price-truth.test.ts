import { extractDigitalDataFallback, extractSamsungListPrice, SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

// Field shape and values observed on Saudi PDPs 2026-09-16.
const html = `<script>
digitalData.product.model_code = "WD12TP34DSX\\/YL";
digitalData.product.displayName = "Washer Dryer";
digitalData.product.model_price = "4099";
digitalData.product.list_price = "7149";
</script><input data-model-code="WD12TP34DSX/YL" data-saleable="true">`;
const url = 'https://www.samsung.com/sa_en/washers-and-dryers/washer-dryer-combo/wd12tp34dsx-yl/';

describe('Samsung current and reference price truth', () => {
  const originalFetch = global.fetch;
  afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });
  it('refreshes the selected buying-tool variant and refuses another family or unknown model', async () => {
    const model = 'SM-F976BZVIMEA';
    const buy = 'https://www.samsung.com/sa_en/smartphones/galaxy-z-fold8-ultra/buy/';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { resultData: {
      common: { totalRecord: 1, toRecord: 1 }, productList: [{ familyId: 'fold', modelCount: 1,
        modelList: [{ modelCode: model, displayName: 'Galaxy Fold', pdpUrl: '/sa_en/smartphones/galaxy-z-fold8-ultra/',
          originPdpUrl: `/sa_en/smartphones/galaxy-z-fold8-ultra/${model.toLowerCase()}/`, configuratorUrl: buy,
          price: '7999', promotionPrice: '6999', priceCurrency: 'SAR', stockStatusText: 'lowStock', ctaType: 'whereToBuy' }] }] } } }) });
    const scraper = new SamsungKsaScraper();
    expect(await scraper.updateProductPrice(`${buy}?modelCode=${model}`)).toMatchObject({ sku: model,
      current_price: 6999, original_price: 7999, availability: 'limited_stock', product_url: `${buy}?modelCode=${model}` });
    expect(await scraper.updateProductPrice(`${buy}?modelCode=UNKNOWN`)).toBeNull();
    expect(await scraper.updateProductPrice(`${buy.replace('fold8-ultra', 'other')}?modelCode=${model}`)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('retains the payable price and separately captures the exact-model list price', () => {
    expect(extractDigitalDataFallback(html, url)).toMatchObject({ current_price: 4099, original_price: 7149, availability: 'in_stock' });
  });
  it('rejects a different variant or reference no higher than current price', () => {
    expect(extractSamsungListPrice(html, 4099, 'WD12TP34DSX/SA')).toBeNull();
    expect(extractSamsungListPrice(html, 7149, 'WD12TP34DSX/YL')).toBeNull();
  });
  it('does not borrow purchase availability from a recommendation for another model', () => {
    expect(extractDigitalDataFallback(html.replace('data-model-code="WD12TP34DSX/YL"', 'data-model-code="OTHER"'), url)?.availability).toBe('out_of_stock');
  });
  it('applies exact-model non-saleable evidence even when JSON-LD says InStock', async () => {
    const scraper = new SamsungKsaScraper();
    const ld = { '@type': 'Product', name: 'Washer Dryer', sku: 'WD12TP34DSX/YL', offers: { price: 4099, availability: 'https://schema.org/InStock' } };
    jest.spyOn(scraper, 'fetchPage').mockResolvedValue(`${html.replace('data-saleable="true"', 'data-saleable="false"')}<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
    expect(await scraper.updateProductPrice(url)).toMatchObject({ current_price: 4099, original_price: 7149, availability: 'out_of_stock' });
  });
});
