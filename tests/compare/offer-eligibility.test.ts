// tests/compare/offer-eligibility.test.ts — ADR-388.
// The ONE eligibility rule every compare surface shares. Fixture = the live ArtCool shape of
// 2026-09-26: five offer rows, three eligible (3,269 / 3,469 / 3,669), one 12-day-old Amazon
// 2,949 and one 36-day-old Noon 3,369. The multi-product page read «5 متاجر» and a 720 spread;
// /compare/[key] read 3 stores and 400. The right answer is 3 and 400 everywhere.
import {
  exclusionReasonFor,
  partitionEligible,
  summarizeEligiblePrices,
  distinctStoreCount,
} from '@/lib/compare/offer-eligibility';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

type Offer = { store: string; price: number; availability: string; observed_at: string | null };
const read = (o: Offer) => ({ price: o.price, availability: o.availability, observed_at: o.observed_at });

const ARTCOOL: Offer[] = [
  { store: 'amazon', price: 2949, availability: 'in_stock', observed_at: daysAgo(12) },
  { store: 'alnakheel', price: 3269, availability: 'in_stock', observed_at: daysAgo(1) },
  { store: 'noon', price: 3369, availability: 'in_stock', observed_at: daysAgo(36) },
  { store: 'extra', price: 3469, availability: 'in_stock', observed_at: daysAgo(2) },
  { store: 'jarir', price: 3669, availability: 'in_stock', observed_at: daysAgo(0.5) },
];

describe('exclusionReasonFor', () => {
  it('eligible: positive price, in stock, observed within 7 days', () => {
    expect(exclusionReasonFor({ price: 100, availability: 'in_stock', observed_at: daysAgo(6.9) }, NOW)).toBeNull();
  });
  it('stale just past the 7-day window', () => {
    expect(exclusionReasonFor({ price: 100, availability: 'in_stock', observed_at: daysAgo(7.01) }, NOW)).toBe('stale');
  });
  it('out of stock beats stale as the stated reason', () => {
    expect(exclusionReasonFor({ price: 100, availability: 'out_of_stock', observed_at: daysAgo(30) }, NOW)).toBe('out_of_stock');
  });
  it('no price beats everything', () => {
    expect(exclusionReasonFor({ price: 0, availability: 'in_stock', observed_at: daysAgo(1) }, NOW)).toBe('no_price');
    expect(exclusionReasonFor({ price: null, availability: 'in_stock', observed_at: daysAgo(1) }, NOW)).toBe('no_price');
  });
  it('unknown age is excluded by default and eligible only when the caller opts in (legacy rows)', () => {
    expect(exclusionReasonFor({ price: 100, availability: 'in_stock', observed_at: null }, NOW)).toBe('unknown_age');
    expect(exclusionReasonFor({ price: 100, availability: 'in_stock', observed_at: null }, NOW, { unknownAgeIsEligible: true })).toBeNull();
  });
});

describe('partitionEligible + summarizeEligiblePrices — the ArtCool shape', () => {
  it('3 eligible, 2 excluded with reasons; spread 400 not 720', () => {
    const { eligible, excluded } = partitionEligible(ARTCOOL, read, NOW);
    expect(eligible.map((o) => o.store)).toEqual(['alnakheel', 'extra', 'jarir']);
    expect(excluded.map((e) => [e.item.store, e.reason])).toEqual([['amazon', 'stale'], ['noon', 'stale']]);
    const s = summarizeEligiblePrices(eligible.map((o) => o.price));
    expect(s).toEqual({ lowest: 3269, highest: 3669, spread: 400 });
    expect(distinctStoreCount(eligible, (o) => o.store)).toBe(3);
    expect(distinctStoreCount(excluded.map((e) => e.item), (o) => o.store)).toBe(2);
  });

  it('single eligible offer → no spread (null), count 1 — never "one store vs itself"', () => {
    const one = ARTCOOL.filter((o) => o.store === 'alnakheel' || o.store === 'amazon');
    const { eligible } = partitionEligible(one, read, NOW);
    expect(eligible).toHaveLength(1);
    expect(summarizeEligiblePrices(eligible.map((o) => o.price))).toEqual({ lowest: 3269, highest: 3269, spread: null });
  });

  it('no eligible offer → empty summary; a stale offer is never crowned by this module', () => {
    const stale = ARTCOOL.filter((o) => o.store === 'amazon' || o.store === 'noon');
    const { eligible, excluded } = partitionEligible(stale, read, NOW);
    expect(eligible).toHaveLength(0);
    expect(excluded).toHaveLength(2);
    expect(summarizeEligiblePrices([])).toEqual({ lowest: null, highest: null, spread: null });
  });

  it('distinct store count counts retailers, not offer rows', () => {
    const dup = [...ARTCOOL, { store: 'jarir', price: 3699, availability: 'in_stock', observed_at: daysAgo(1) }];
    const { eligible } = partitionEligible(dup, read, NOW);
    expect(eligible).toHaveLength(4);
    expect(distinctStoreCount(eligible, (o) => o.store)).toBe(3);
  });

  it('does not mutate or reorder the input', () => {
    const copy = ARTCOOL.map((o) => ({ ...o }));
    partitionEligible(ARTCOOL, read, NOW);
    expect(ARTCOOL).toEqual(copy);
  });
});
