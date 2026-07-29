// ADR-134 — a superseded duplicate listing may never publish a saving.
import { isMoreAuthoritative, keepCurrentListings, productListingKey } from '@/lib/intelligence/listing-currency';

const dropStale = { verdict: 'verified_drop', last_seen: '2026-07-24T00:00:00Z' };
const inflatedFresh = { verdict: 'inflated_reference', last_seen: '2026-07-29T00:00:00Z' };

describe('listing currency (ADR-134)', () => {
  it('prefers the listing observed most recently, even when it is the weaker claim', () => {
    expect(isMoreAuthoritative(inflatedFresh, dropStale)).toBe(true);
    expect(isMoreAuthoritative(dropStale, inflatedFresh)).toBe(false);
  });

  it('breaks a freshness tie CONSERVATIVELY — never toward the larger saving', () => {
    const drop = { verdict: 'verified_drop', last_seen: '2026-07-29T00:00:00Z' };
    const inflated = { verdict: 'inflated_reference', last_seen: '2026-07-29T00:00:00Z' };
    expect(isMoreAuthoritative(inflated, drop)).toBe(true);
    expect(isMoreAuthoritative(drop, inflated)).toBe(false);
  });

  it('drops the superseded duplicate for the real production case', () => {
    // Same LG 18k AC at Almanea under two URL shapes; the dev-host row claimed a 32%
    // verified drop while the current listing says the saving is 0%.
    const rows = [
      { store_name: '5', name: 'LG Split AC 18000', ...dropStale },
      { store_name: '5', name: 'LG Split AC 18000', ...inflatedFresh },
    ];
    const kept = keepCurrentListings(rows, productListingKey);
    expect(kept).toHaveLength(1);
    expect(kept[0].verdict).toBe('inflated_reference');
  });

  it('never lets insufficient_history out-vote a listing that carries a verdict', () => {
    // Abstention is "we have not tracked this long enough", not a contradiction — a thin
    // duplicate must not silence a well-evidenced drop, even when it is fresher.
    const thinFresh = { verdict: 'insufficient_history', last_seen: '2026-07-29T00:00:00Z' };
    expect(isMoreAuthoritative(thinFresh, dropStale)).toBe(false);
    expect(isMoreAuthoritative(dropStale, thinFresh)).toBe(true);
    const kept = keepCurrentListings(
      [{ store_name: '5', name: 'X', ...thinFresh }, { store_name: '5', name: 'X', ...dropStale }],
      productListingKey,
    );
    expect(kept[0].verdict).toBe('verified_drop');
  });

  it('leaves a product with a single listing untouched', () => {
    const rows = [{ store_name: '4', name: 'Sony WH-1000XM5', ...dropStale }];
    expect(keepCurrentListings(rows, productListingKey)).toHaveLength(1);
    expect(keepCurrentListings(rows, productListingKey)[0].verdict).toBe('verified_drop');
  });

  it('treats the same product in different stores as different listings', () => {
    const rows = [
      { store_name: '4', name: 'LG Split AC 18000', ...dropStale },
      { store_name: '5', name: 'LG Split AC 18000', ...inflatedFresh },
    ];
    expect(keepCurrentListings(rows, productListingKey)).toHaveLength(2);
  });
});
