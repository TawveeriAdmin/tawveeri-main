import { parseProductLink, sameProductLink, extractUrlFromText, isKnownShortLink, extractRefreshTarget } from '@/lib/check/product-link';
import { assessCheckHistory, summarizeOffers, type CheckOffer } from '@/lib/check/assessment';

describe('Check link identity boundary', () => {
  it.each([
    ['https://www.amazon.sa/dp/B0D1234567?tag=example-21', 'amazon', 'B0D1234567'],
    ['https://www.noon.com/saudi-en/phone/N12345678A/p/', 'noon', 'N12345678A'],
    ['https://www.jarir.com/sa-en/apple-iphone-renewed-648455.html', 'jarir', '648455'],
    ['https://www.extra.com/en-sa/phone/p/100376379?utm_source=test', 'extra', '100376379'],
  ])('recognizes the merchant product code, not the title: %s', (url, store, productCode) => {
    expect(parseProductLink(url)).toMatchObject({ store, productCode });
  });
  it.each([
    'https://amazon.sa.evil.test/dp/B0D1234567', 'http://127.0.0.1/p/100376379',
    'https://user:password@www.extra.com/en-sa/p/100376379', 'https://amzn.eu/example',
    'https://www.noon.com/uae-en/phone/N12345678A/p/', 'https://www.extra.com/en-sa/p/100376379?variant=other',
    'https://www.jarir.com/search?q=phone', 'javascript:alert(1)', 'https://www.extra.com:444/en-sa/p/100376379',
  ])('does not fetch or guess for an unsafe/unsupported reference: %s', url => expect(parseProductLink(url)).toBeNull());
  it('accepts the real Button/Amazon tracking params observed on a resolved short link (ADR-369)', () => {
    expect(parseProductLink('https://www.amazon.sa/dp/B0GQC47HKT/ref=x?linkCode=ml1&tag=tawveeri0f-21&linkId=d256e9424eedbd2827e1a2bc60f37dc3&ascsubtag=srctok-1&btn_type=ss&btn_ref=srctok-1')).toMatchObject({ store: 'amazon', productCode: 'B0GQC47HKT' });
  });
  it('accepts a real stored Amazon search-results-page URL, not just a clean product link (ADR-370)', () => {
    // The actual stored offer URL for a real, valid, 878 SAR Midea 6kg washer offer,
    // unmatchable before this fix because our scraper captured it from a search-results
    // page rather than a clean product page.
    const stored = 'https://www.amazon.sa/-/en/Midea-Washer-Top-Load-MA200W60WKSA/dp/B0F1TMN532/ref=sr_1_36?dib=eyJ2IjoiMSJ9.xyz&dib_tag=se&keywords=%D8%BA%D8%B3%D8%A7%D9%84%D8%A9&qid=1789474083&sr=8-36';
    expect(parseProductLink(stored)).toMatchObject({ store: 'amazon', productCode: 'B0F1TMN532' });
  });
  it('still fails closed for a genuinely unrecognized param, even on amazon.sa (ADR-370 does not open the allowlist wide)', () => {
    expect(parseProductLink('https://www.amazon.sa/dp/B0D1234567?sbo=1')).toBeNull();
  });
  it('cannot confuse a model in the slug with the merchant item code', () => {
    const link = parseProductLink('https://www.extra.com/en-sa/iphone16/p/100376379')!;
    expect(sameProductLink('https://www.extra.com/en-sa/iphone16/p/100376380', link)).toBe(false);
  });
  it('sameProductLink now recognizes a stored search-results offer as the same product a clean link resolves to (ADR-370)', () => {
    const resolved = parseProductLink('https://www.amazon.sa/dp/B0F1TMN532')!;
    const storedSearchResultUrl = 'https://www.amazon.sa/-/en/Midea-Washer-Top-Load-MA200W60WKSA/dp/B0F1TMN532/ref=sr_1_36?dib=x&dib_tag=se&keywords=washer&qid=1&sr=8-36';
    expect(sameProductLink(storedSearchResultUrl, resolved)).toBe(true);
  });
});

describe('Check accepts a link embedded in real share-sheet text', () => {
  it.each([
    ['Share product link https://www.extra.com/en-sa/phone/p/100376379', 'extra', '100376379'],
    ['شارك رابط المنتج https://www.jarir.com/sa-en/apple-iphone-renewed-648455.html', 'jarir', '648455'],
    ['Check this out: https://www.amazon.sa/dp/B0D1234567?tag=example-21 amazing deal', 'amazon', 'B0D1234567'],
  ])('extracts the merchant link from surrounding text: %s', (input, store, productCode) => {
    expect(parseProductLink(input)).toMatchObject({ store, productCode });
  });
  it('strips share-sentence trailing punctuation without touching the URL path', () => {
    expect(extractUrlFromText('رابط المنتج: https://www.jarir.com/sa-en/apple-iphone-renewed-648455.html.')).toBe('https://www.jarir.com/sa-en/apple-iphone-renewed-648455.html');
  });
  it('still rejects plain text with no embedded URL, unchanged', () => {
    expect(parseProductLink('Share product link')).toBeNull();
    expect(extractUrlFromText('Share product link')).toBe('Share product link');
  });
});

describe('Check rewrites the Refresh-header app-deep-link to a plain https destination (ADR-369)', () => {
  it('extracts the real Amazon URL from the live-observed app-scheme deep link', () => {
    expect(extractRefreshTarget('0; url=com.amazon.mobile.shopping.web://www.amazon.sa/dp/B0GQC47HKT/ref=x?tag=t')).toBe('https://www.amazon.sa/dp/B0GQC47HKT/ref=x?tag=t');
  });
  it('leaves an already-https target unchanged', () => {
    expect(extractRefreshTarget('0; url=https://www.amazon.sa/dp/B0GQC47HKT')).toBe('https://www.amazon.sa/dp/B0GQC47HKT');
  });
  it('is tolerant of case and spacing in the header', () => {
    expect(extractRefreshTarget('0;URL = https://www.amazon.sa/dp/B0GQC47HKT')).toBe('https://www.amazon.sa/dp/B0GQC47HKT');
  });
  it('returns null for a header with no url= at all', () => {
    expect(extractRefreshTarget('0')).toBeNull();
  });
});

describe('Check recognizes only a verified short-link host', () => {
  it.each([
    'https://link.amazon/B0jhDmiKd', 'Share: https://link.amazon/B0jhDmiKd via Amazon',
  ])('recognizes the verified Amazon share short link: %s', input => expect(isKnownShortLink(input)).toBe(true));
  it.each([
    'https://amzn.eu/example', 'https://www.amazon.sa/dp/B0D1234567', 'https://noon.com/x', 'not a url at all',
  ])('does not treat an unverified or full link as a short link: %s', input => expect(isKnownShortLink(input)).toBe(false));
});

const offer = (patch: Partial<CheckOffer> = {}): CheckOffer => ({ store: 'extra', storeName: 'eXtra', title: 'New phone 256GB Black', price: 3000, observedAt: new Date().toISOString(), condition: 'NEW', href: '/go/test', source: true, availability: 'in_stock', stale: false, ...patch });

describe('Check commercial honesty', () => {
  it('sorts by price and stable store key, without commission preferences', () => {
    const rows = [offer({ store: 'noon', price: 3000 }), offer({ store: 'extra', price: 2000 }), offer({ store: 'amazon', price: 3000 })];
    expect(summarizeOffers(rows).offers.map(o => o.store)).toEqual(['extra', 'amazon', 'noon']);
    expect(rows[0].store).toBe('noon');
  });
  it.each([
    { condition: 'RENEWED' as const, title: 'Renewed Grade B phone 256GB' },
    { condition: 'UNKNOWN' as const }, { title: 'New phone 128GB Black' },
    { title: 'New phone 256GB Blue' }, { observedAt: '2020-01-01T00:00:00Z' },
    { availability: 'out_of_stock' },
  ])('a cheaper number does not prove the same buy: %s', patch => {
    expect(summarizeOffers([offer(), offer({ store: 'jarir', source: false, price: 2500, ...patch })]).cheaperCount).toBe(0);
  });
  it('can count a fresh in-stock same-description same-condition alternative', () => {
    expect(summarizeOffers([offer(), offer({ store: 'jarir', source: false, price: 2500 })]).cheaperCount).toBe(1);
  });
  it('reports a known condition difference separately from a cheaper equivalent', () => {
    expect(summarizeOffers([offer(), offer({ store: 'jarir', source: false, price: 2500, condition: 'RENEWED' })])).toMatchObject({ cheaperCount: 0, conditionDifference: true });
  });
});

describe('Check history claims', () => {
  const now = Date.parse('2026-09-15T10:00:00Z');
  const points = [3200, 3150, 3100, 3050, 3000].map((price, i) => ({ price, at: new Date(now - (4 - i) * 86400000).toISOString() }));
  it('does not convert one observed day into a verdict', () => expect(assessCheckHistory(points.slice(-1), 3000, points[4].at, now).label).toBe('insufficient'));
  it('does not present stale or mismatched history as today', () => {
    expect(assessCheckHistory(points, 3000, '2020-01-01', now).label).toBe('insufficient');
    expect(assessCheckHistory(points, 2500, points[4].at, now).label).toBe('insufficient');
  });
  it('uses the established sufficient-history verdict without a buy-now claim', () => expect(assessCheckHistory(points, 3000, points[4].at, now).label).toBe('lowest'));
});
