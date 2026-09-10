// tests/scraping/apify-noon-provider.test.ts — Noon Managed Data Source Proof mission
// (2026-09-10). Regression coverage for the Apify (saswave/noon-product-scraper) response
// mapping this mission built: the "unknown beats incorrect" safety rules (no fabricated
// price for a delisted item, no un-confirmed-Saudi data ever trusted) are the highest-risk
// part of this integration — a bug here would let stale/wrong/wrong-market data reach
// Product Truth. Shapes mirror real live responses captured during the ADR-334 benchmark.
import { mapItemToScrapedProduct, isConfirmedSaudi, type ApifyItem, type ApifyOffer } from '@/lib/scraping/providers/apify-noon-provider';

const SAUDI_RETURN_POLICY = { url: 'https://www.noon.com/en-sa/return-policy' };
const UAE_RETURN_POLICY = { url: 'https://www.noon.com/en-ae/return-policy' };

function offer(overrides: Partial<ApifyOffer> = {}): ApifyOffer {
  return {
    price: 100,
    sale_price: 80,
    stock: 10,
    is_buyable: true,
    return_policy: SAUDI_RETURN_POLICY,
    ...overrides,
  };
}

function item(overrides: Partial<ApifyItem> = {}, offerOverrides: Partial<ApifyOffer> | null = {}): ApifyItem {
  return {
    sku: 'N70000000V',
    product_title: 'Test Phone 128GB Black',
    brand: 'TestBrand',
    long_description: '<p>Great phone</p>',
    specifications: [{ code: 'ram_size', name: 'RAM Size', value: '8 GB' }],
    image_urls: ['https://f.nooncdn.com/p/x.jpg'],
    variants: offerOverrides === null ? [{ offers: [] }] : [{ offers: [offer(offerOverrides)] }],
    product_rating: { value: 4.5, count: 100 },
    ...overrides,
  };
}

describe('isConfirmedSaudi', () => {
  it('confirms a genuine /en-sa/ return-policy URL', () => {
    expect(isConfirmedSaudi(offer({ return_policy: SAUDI_RETURN_POLICY }))).toBe(true);
  });
  it('rejects a UAE return-policy URL', () => {
    expect(isConfirmedSaudi(offer({ return_policy: UAE_RETURN_POLICY }))).toBe(false);
  });
  it('rejects a missing return_policy entirely — unknown, not assumed Saudi', () => {
    expect(isConfirmedSaudi(offer({ return_policy: undefined }))).toBe(false);
  });
  it('rejects an undefined offer', () => {
    expect(isConfirmedSaudi(undefined)).toBe(false);
  });
});

describe('mapItemToScrapedProduct — unknown beats incorrect', () => {
  it('MEASURED live case: a real Saudi offer with sale_price maps correctly (Z7D64B79AE527F833DCA0Z benchmark case)', () => {
    const raw = item(
      { sku: 'Z7D64B79AE527F833DCA0Z', product_title: '3.5mm Audio Cable', brand: 'INSIJAM' },
      { price: 69, sale_price: 14.38, stock: 3, is_buyable: true },
    );
    const result = mapItemToScrapedProduct(raw, 'https://www.noon.com/saudi-en/x/Z7D64B79AE527F833DCA0Z/p/');
    expect(result).not.toBeNull();
    expect(result!.sku).toBe('Z7D64B79AE527F833DCA0Z');
    expect(result!.current_price).toBe(14.38);
    expect(result!.original_price).toBe(69);
    expect(result!.availability).toBe('limited_stock'); // stock=3, <=3 threshold
  });

  it('a delisted/out-of-stock item (empty offers array) returns null, never a fabricated price', () => {
    const raw = item({ sku: 'N70178726V' }, null);
    const result = mapItemToScrapedProduct(raw, 'https://www.noon.com/saudi-en/x/N70178726V/p/');
    expect(result).toBeNull();
  });

  it('a UAE-confirmed offer is REJECTED even though the fetch itself succeeded (HTTP 200 is not proof)', () => {
    const raw = item({}, { return_policy: UAE_RETURN_POLICY });
    const result = mapItemToScrapedProduct(raw, 'https://www.noon.com/saudi-en/x/N70000000V/p/');
    expect(result).toBeNull();
  });

  it('is_buyable=false maps to out_of_stock regardless of stock count', () => {
    const raw = item({}, { is_buyable: false, stock: 50 });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.availability).toBe('out_of_stock');
  });

  it('healthy stock (>3) maps to in_stock, not limited_stock', () => {
    const raw = item({}, { stock: 25, is_buyable: true });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.availability).toBe('in_stock');
  });

  it('no sale_price (not on sale) uses price as current_price with no original_price', () => {
    const raw = item({}, { price: 549, sale_price: null });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.current_price).toBe(549);
    expect(result!.original_price).toBeNull();
  });

  it('sale_price equal to price (no real discount) reports no original_price', () => {
    const raw = item({}, { price: 100, sale_price: 100 });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.current_price).toBe(100);
    expect(result!.original_price).toBeNull();
  });

  it('missing/non-finite price returns null rather than a garbage number', () => {
    const raw = item({}, { price: null, sale_price: null });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result).toBeNull();
  });

  it('falls back to extracting SKU from the URL when the item has none', () => {
    const raw = item({ sku: undefined });
    const result = mapItemToScrapedProduct(raw, 'https://www.noon.com/saudi-en/x/N70999999V/p/');
    expect(result!.sku).toBe('N70999999V');
  });

  it('specifications array maps to a code-keyed record', () => {
    const raw = item({ specifications: [{ code: 'ram_size', value: '8 GB' }, { name: 'no_code_field', value: 'x' }] });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.specifications).toEqual({ ram_size: '8 GB', no_code_field: 'x' });
  });

  it('strips HTML tags from long_description', () => {
    const raw = item({ long_description: '<p>Hello <b>World</b></p>' });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.description_en).toBe('Hello World');
  });

  it('brand is preserved verbatim, never silently replaced with "Unknown" when present', () => {
    const raw = item({ brand: 'HUAWEI' });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.brand).toBe('HUAWEI');
  });

  it('missing brand defaults to "Unknown", never fabricated', () => {
    const raw = item({ brand: undefined });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result!.brand).toBe('Unknown');
  });
});
