import { parseProductLink, sameProductLink } from '@/lib/check/product-link';
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
  it('cannot confuse a model in the slug with the merchant item code', () => {
    const link = parseProductLink('https://www.extra.com/en-sa/iphone16/p/100376379')!;
    expect(sameProductLink('https://www.extra.com/en-sa/iphone16/p/100376380', link)).toBe(false);
  });
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
