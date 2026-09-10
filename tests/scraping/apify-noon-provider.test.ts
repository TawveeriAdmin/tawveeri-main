// tests/scraping/apify-noon-provider.test.ts — Noon Managed Data Source Proof mission
// (2026-09-10). Regression coverage for the Apify (saswave/noon-product-scraper) response
// mapping this mission built: the "unknown beats incorrect" safety rules (no fabricated
// price for a delisted item, no un-confirmed-Saudi data ever trusted) are the highest-risk
// part of this integration — a bug here would let stale/wrong/wrong-market data reach
// Product Truth. Shapes mirror real live responses captured during the ADR-334 benchmark.
import {
  mapItemToScrapedProduct,
  isConfirmedSaudi,
  selectBestOffer,
  extractOfferCode,
  withOfferCode,
  detectSchemaDrift,
  fetchNoonProductsBatch,
  type ApifyItem,
  type ApifyOffer,
} from '@/lib/scraping/providers/apify-noon-provider';

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

  it('a single non-buyable offer is treated as no active offer (null), not a fabricated out_of_stock listing', () => {
    const raw = item({}, { is_buyable: false, stock: 50 });
    const result = mapItemToScrapedProduct(raw, 'url');
    expect(result).toBeNull();
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

// Noon price-contract review (2026-09-10): a single SKU is a MARKETPLACE listing that can
// carry multiple competing seller offers at different prices — measured live, 9/18 sampled
// SKUs had 2+ offers, one with 8, spreads up to ~10%. Blindly taking offers[0] is array-order
// luck, not a rule; this is the defect the founder's review caught before scale-up.
describe('extractOfferCode / withOfferCode', () => {
  it('extracts the ?o= param from a real Noon URL', () => {
    expect(extractOfferCode('https://www.noon.com/saudi-en/x/N1/p/?o=abc123')).toBe('abc123');
  });
  it('returns null when there is no ?o= param', () => {
    expect(extractOfferCode('https://www.noon.com/saudi-en/x/N1/p/')).toBeNull();
  });
  it('replaces an existing ?o= value without disturbing other params', () => {
    expect(withOfferCode('https://x/p/?o=old&x=1', 'new')).toBe('https://x/p/?o=new&x=1');
  });
  it('appends ?o= when none exists and the URL already has a query string', () => {
    expect(withOfferCode('https://x/p/?x=1', 'new')).toBe('https://x/p/?x=1&o=new');
  });
  it('appends ?o= as the first param when the URL has none', () => {
    expect(withOfferCode('https://x/p/', 'new')).toBe('https://x/p/?o=new');
  });
});

describe('selectBestOffer — marketplace multi-seller correctness', () => {
  function offer(overrides: Partial<ApifyOffer> = {}): ApifyOffer {
    return { price: 100, sale_price: null, is_buyable: true, offer_code: 'x', ...overrides };
  }

  it('MEASURED live case (N70320482V): 6 competing offers, requested offer_code present — matched offer wins even though it is not the array-order-first cheapest coincidence', () => {
    const offers = [
      offer({ offer_code: 'c96042071103218b', sale_price: 579, store_name: 'PlayBox' }),
      offer({ offer_code: 'ffeab6d68e6f1bfe', sale_price: 580, store_name: 'Elite deals' }),
      offer({ offer_code: 'fd219b54e4db00ab', sale_price: 595, store_name: 'Netra' }),
    ];
    const result = selectBestOffer(offers, 'c96042071103218b');
    expect(result?.offer.store_name).toBe('PlayBox');
    expect(result?.matchedRequestedOffer).toBe(true);
  });

  it('when the requested offer_code no longer exists (rotated away), falls back to the cheapest CURRENTLY BUYABLE offer', () => {
    const offers = [
      offer({ offer_code: 'a', sale_price: 250 }),
      offer({ offer_code: 'b', sale_price: 200 }),
      offer({ offer_code: 'c', sale_price: 150 }), // cheapest
      offer({ offer_code: 'd', price: 300, sale_price: null }),
    ];
    const result = selectBestOffer(offers, 'nonexistent-code');
    expect(result?.offer.offer_code).toBe('c');
    expect(result?.matchedRequestedOffer).toBe(false);
  });

  it('never selects a non-buyable offer, even if it is the cheapest', () => {
    const offers = [
      offer({ offer_code: 'cheap-but-unbuyable', sale_price: 1, is_buyable: false }),
      offer({ offer_code: 'real', sale_price: 999, is_buyable: true }),
    ];
    const result = selectBestOffer(offers, null);
    expect(result?.offer.offer_code).toBe('real');
  });

  it('the matched requested offer wins even when it is NOT the cheapest (price continuity over pure cheapness)', () => {
    const offers = [
      offer({ offer_code: 'requested', sale_price: 500 }),
      offer({ offer_code: 'cheaper', sale_price: 100 }),
    ];
    const result = selectBestOffer(offers, 'requested');
    expect(result?.offer.offer_code).toBe('requested');
  });

  it('returns null when no offer is buyable', () => {
    const offers = [offer({ is_buyable: false }), offer({ is_buyable: false })];
    expect(selectBestOffer(offers, null)).toBeNull();
  });

  it('returns null for an empty offers array (genuinely delisted)', () => {
    expect(selectBestOffer([], 'anything')).toBeNull();
  });

  it('uses price when sale_price is absent for cheapest-comparison', () => {
    const offers = [
      offer({ offer_code: 'a', price: 300, sale_price: null }),
      offer({ offer_code: 'b', price: 200, sale_price: null }),
    ];
    const result = selectBestOffer(offers, null);
    expect(result?.offer.offer_code).toBe('b');
  });
});

describe('detectSchemaDrift — fail closed on an upstream shape change, not just a delisted item', () => {
  it('a legitimately-empty (delisted) item is NOT flagged as schema drift', () => {
    const raw: ApifyItem = { sku: 'N1', product_title: 'Real Product', variants: [{ offers: [] }] };
    expect(detectSchemaDrift(raw)).toBeNull();
  });
  it('missing product_title is flagged as schema drift', () => {
    const raw: ApifyItem = { sku: 'N1', variants: [] };
    expect(detectSchemaDrift(raw)).toMatch(/product_title/);
  });
  it('variants not being an array at all is flagged as schema drift', () => {
    const raw = { sku: 'N1', product_title: 'X', variants: 'not-an-array' } as unknown as ApifyItem;
    expect(detectSchemaDrift(raw)).toMatch(/variants/);
  });
  it('mapItemToScrapedProduct fails closed (null) when schema drift is detected, never guessing', () => {
    const raw = { sku: 'N1', variants: [] } as ApifyItem; // missing product_title
    expect(mapItemToScrapedProduct(raw, 'url')).toBeNull();
  });
});

describe('fetchNoonProductsBatch — cost guard (MAX_BATCH_SIZE)', () => {
  it('refuses a batch larger than the hard cap without making any network call', async () => {
    const oversized = Array.from({ length: 251 }, (_, i) => `https://www.noon.com/saudi-en/x/N${i}V/p/`);
    const result = await fetchNoonProductsBatch(oversized);
    expect(result.size).toBe(251);
    for (const v of result.values()) expect(v).toBeNull();
  });

  it('an empty batch returns immediately with an empty map, no token/network needed', async () => {
    const result = await fetchNoonProductsBatch([]);
    expect(result.size).toBe(0);
  });
});

describe('mapItemToScrapedProduct — offer rotation updates product_url for exit-link consistency', () => {
  function multiOfferItem(offers: ApifyOffer[]): ApifyItem {
    return {
      sku: 'N70000000V',
      product_title: 'Test Phone',
      brand: 'TestBrand',
      variants: [{ offers }],
    };
  }
  const saudiOffer = (overrides: Partial<ApifyOffer> = {}): ApifyOffer => ({
    price: 100, sale_price: 80, is_buyable: true,
    return_policy: SAUDI_RETURN_POLICY, ...overrides,
  });

  it('when the requested offer still exists, product_url is unchanged', () => {
    const raw = multiOfferItem([saudiOffer({ offer_code: 'kept', sale_price: 50 })]);
    const url = 'https://www.noon.com/saudi-en/x/N70000000V/p/?o=kept';
    const result = mapItemToScrapedProduct(raw, url);
    expect(result?.product_url).toBe(url);
  });

  it('when the requested offer rotated away, product_url is updated to the NEW winning offer_code — /go must never point at a stale offer', () => {
    const raw = multiOfferItem([
      saudiOffer({ offer_code: 'new-winner', sale_price: 90 }),
      saudiOffer({ offer_code: 'other', sale_price: 200 }),
    ]);
    const url = 'https://www.noon.com/saudi-en/x/N70000000V/p/?o=expired-code';
    const result = mapItemToScrapedProduct(raw, url);
    expect(result?.product_url).toBe('https://www.noon.com/saudi-en/x/N70000000V/p/?o=new-winner');
    expect(result?.current_price).toBe(90);
  });
});
