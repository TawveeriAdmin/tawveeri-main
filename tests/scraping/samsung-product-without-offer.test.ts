// tests/scraping/samsung-product-without-offer.test.ts
// Samsung KSA Phase 0 hardening (2026-09-13, ADR-356): PRODUCT TRUTH must not require OFFER
// TRUTH. A real, currently-valid Samsung Saudi product with a genuine Product JSON-LD node and
// a verified SKU/MPN, but no `offers.price` anywhere, must still return a real ScrapedProduct
// (current_price: null) instead of being discarded — the exact live shape confirmed on
// `ar5000hm-energy-saving-ar18trhqhwk-mg` (2026-09-13): Product JSON-LD present, `offers`
// absent, `digitalData.product.model_price` an explicit empty string.
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

const NO_PRICE_URL = 'https://www.samsung.com/sa_en/air-conditioners/wall-mount/ar5000hm-energy-saving-ar18trhqhwk-mg/';

function jsonLdOnlyHtml(nameHasOffers: boolean): string {
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Wall Mounted AC Cooling Only 18K',
    sku: 'AR18TRHQHWK/MG',
    brand: { '@type': 'Brand', name: 'Samsung' },
    image: 'https://images.samsung.com/example.jpg',
    ...(nameHasOffers ? { offers: { '@type': 'Offer', price: '2499', priceCurrency: 'SAR', availability: 'https://schema.org/InStock' } } : {}),
  };
  return `
    <html><head>
    <script type="application/ld+json">${JSON.stringify(productLd)}</script>
    </head><body>
    <script type="text/javascript">
      digitalData.product.model_code = "AR18TRHQHWK\\/MG";
      digitalData.product.displayName = "Wall Mounted AC Cooling Only 18K";
      digitalData.product.model_price = "";
    </script>
    </body></html>
  `;
}

describe('SamsungKsaScraper.updateProductPrice — Product Truth without Offer Truth', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a real Product JSON-LD node with NO offers.price and NO digitalData price returns a product with current_price: null, not null itself', async () => {
    const scraper = new SamsungKsaScraper();
    jest.spyOn(scraper, 'fetchPage').mockResolvedValue(jsonLdOnlyHtml(false));

    const product = await scraper.updateProductPrice(NO_PRICE_URL);

    expect(product).not.toBeNull();
    expect(product!.current_price).toBeNull();
    expect(product!.availability).toBe('out_of_stock');
    expect(product!.sku).toBe('AR18TRHQHWK/MG');
    expect(product!.name_en).toContain('Wall Mounted AC Cooling Only 18K');
    expect(product!.category).toBeTruthy();
    // Never fabricate a price/discount for a no-offer product.
    expect(product!.original_price).toBeNull();
  });

  it('the SAME page WITH a real offers.price still returns the normal priced product (unchanged path)', async () => {
    const scraper = new SamsungKsaScraper();
    jest.spyOn(scraper, 'fetchPage').mockResolvedValue(jsonLdOnlyHtml(true));

    const product = await scraper.updateProductPrice(NO_PRICE_URL);

    expect(product).not.toBeNull();
    expect(product!.current_price).toBe(2499);
    expect(product!.availability).toBe('in_stock');
  });

  it('no usable identity at all (no Product JSON-LD, no digitalData) still returns null — the identity bar is not relaxed', async () => {
    const scraper = new SamsungKsaScraper();
    jest.spyOn(scraper, 'fetchPage').mockResolvedValue('<html><body>nothing here</body></html>');

    const product = await scraper.updateProductPrice(NO_PRICE_URL);
    expect(product).toBeNull();
  });
});
