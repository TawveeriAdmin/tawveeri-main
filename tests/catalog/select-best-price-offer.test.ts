// tests/catalog/select-best-price-offer.test.ts — Noon Commerce Data Truth & Recovery
// mission (2026-09-10). Regression coverage for the storefront /products/[slug] best-price
// gap this mission found: the page picked "best price" by raw current_price with NO
// freshness gate, unlike the compare page and search (both already gate via
// isFreshObservation, P0 2026-08-07). selectBestPriceOffer is the storefront-layer
// counterpart of deriveComparisonSummary's fresh-first rule.
import { selectBestPriceOffer, type PriceOffer } from '@/lib/catalog/select-best-price-offer';

const NOW = new Date('2026-09-10T12:00:00Z').getTime();
const HOUR = 3_600_000;

function offer(overrides: Partial<PriceOffer> = {}): PriceOffer {
  return {
    id: 'a',
    current_price: 100,
    availability: 'in_stock',
    updated_at: new Date(NOW - 1 * HOUR).toISOString(), // fresh by default
    ...overrides,
  };
}

describe('selectBestPriceOffer — a stale price must never win merely because it is numerically lower', () => {
  it('a fresh, higher price beats a stale, lower price', () => {
    const offers = [
      offer({ id: 'noon-stale', current_price: 50, updated_at: new Date(NOW - 200 * HOUR).toISOString() }), // >168h stale
      offer({ id: 'jarir-fresh', current_price: 80, updated_at: new Date(NOW - 2 * HOUR).toISOString() }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('jarir-fresh');
  });

  it('among two fresh offers, the genuinely cheaper one still wins (no change to normal behavior)', () => {
    const offers = [
      offer({ id: 'a', current_price: 120, updated_at: new Date(NOW - 2 * HOUR).toISOString() }),
      offer({ id: 'b', current_price: 90, updated_at: new Date(NOW - 3 * HOUR).toISOString() }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('b');
  });

  it('falls back to the full (stale) set when NONE are fresh — a single-store stale product still shows a price', () => {
    const offers = [
      offer({ id: 'only-store', current_price: 60, updated_at: new Date(NOW - 400 * HOUR).toISOString() }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('only-store');
  });

  it('MEASURED regression case: Noon stale (587h old, since ~Aug 16) vs an out-of-stock cheaper competitor — Noon still wins (only available option, unaffected by the fix)', () => {
    const offers = [
      offer({ id: 'jarir-oos', current_price: 91.5, availability: 'out_of_stock', updated_at: new Date(NOW - 10 * HOUR).toISOString() }),
      offer({ id: 'noon-stale', current_price: 1099, availability: 'in_stock', updated_at: new Date(NOW - 587 * HOUR).toISOString() }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('noon-stale');
  });

  it('a tie between two equally-stale offers falls back to price order (no behavior change from before the fix)', () => {
    const offers = [
      offer({ id: 'noon', current_price: 5249, updated_at: new Date(NOW - 300 * HOUR).toISOString() }),
      offer({ id: 'jarir', current_price: 5249, updated_at: new Date(NOW - 500 * HOUR).toISOString() }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.current_price).toBe(5249);
  });

  it('out-of-stock offers are excluded from winning even when cheapest and fresh', () => {
    const offers = [
      offer({ id: 'cheap-oos', current_price: 10, availability: 'out_of_stock' }),
      offer({ id: 'available', current_price: 50, availability: 'in_stock' }),
    ];
    const { best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('available');
  });

  it('highestPrice is derived from the same ranked (fresh-preferred) set as best, not the raw full set', () => {
    const offers = [
      offer({ id: 'fresh-cheap', current_price: 50, updated_at: new Date(NOW - 1 * HOUR).toISOString() }),
      offer({ id: 'fresh-expensive', current_price: 200, updated_at: new Date(NOW - 1 * HOUR).toISOString() }),
      offer({ id: 'stale-extreme', current_price: 9999, updated_at: new Date(NOW - 999 * HOUR).toISOString() }),
    ];
    const { highestPrice, best } = selectBestPriceOffer(offers, NOW);
    expect(best?.id).toBe('fresh-cheap');
    expect(highestPrice).toBe(200); // the stale outlier must not distort the displayed range
  });

  it('empty input returns no best offer and a zero highest price', () => {
    const { best, highestPrice, sorted } = selectBestPriceOffer([], NOW);
    expect(best).toBeNull();
    expect(highestPrice).toBe(0);
    expect(sorted).toHaveLength(0);
  });
});
