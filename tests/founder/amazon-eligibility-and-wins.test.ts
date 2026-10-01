/**
 * ADR-398 — points ب/ج: pure helpers behind the founder "road to the API" section and the
 * growth "Amazon wins now" list. The data readers are exercised live; the ranking and the
 * trailing-30-day rule are pinned here.
 */
import { trailing30FromConversions, CREATORS_API_THRESHOLD } from '../../src/lib/founder/amazon-eligibility';
import { rankAmazonWins } from '../../src/lib/admin/amazon-win-list';
import { METRICS } from '../../src/lib/founder/registry';

const NOW = new Date('2026-10-01T12:00:00Z');
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

describe('trailing-30-day eligibility', () => {
  it('counts shipped, non-returned amazon items ordered in the last 30 days; no report => unknown, never zero', () => {
    const rows = [
      { source: 'amazon_associates', order_date: d(2), ship_date: d(1), quantity: 2, state: 'approved' },
      { source: 'amazon_associates', order_date: d(5), ship_date: null, quantity: 1, state: 'pending' },
      { source: 'amazon_associates', order_date: d(40), ship_date: d(38), quantity: 5, state: 'approved' }, // outside
      { source: 'amazon_associates', order_date: d(3), ship_date: d(2), quantity: 1, state: 'returned' },  // returned
      { source: 'noon_affiliate', order_date: d(3), ship_date: d(2), quantity: 9, state: 'approved' },     // other partner
    ];
    const t = trailing30FromConversions(rows, true, NOW);
    expect(t.orderedItems).toBe(3);
    expect(t.shippedItems).toBe(2);
    expect(t.progress).toBeCloseTo(2 / CREATORS_API_THRESHOLD);
    const unknown = trailing30FromConversions(rows, false, NOW);
    expect(unknown.shippedItems).toBeNull();
    expect(unknown.progress).toBeNull();
  });

  it('registers the four A-metrics with proves/notProves boundaries', () => {
    for (const id of ['A01', 'A02', 'A03', 'A04']) {
      expect(METRICS[id]).toBeDefined();
      expect(METRICS[id].notProvesAr.length).toBeGreaterThan(5);
    }
  });
});

describe('rankAmazonWins', () => {
  const now = NOW.getTime();
  const h = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  it('keeps only fresh (<=48h) amazon offers paired with extra/almanea and cheaper than every valid competitor, ranked by saving %', () => {
    const amazon = [
      { identity_key: 'k1', category: 'tv', price: 1699, observed_at: h(5) },     // wins vs extra 1899 (10.5%)
      { identity_key: 'k2', category: 'tv', price: 2000, observed_at: h(5) },     // loses to almanea 1900
      { identity_key: 'k3', category: 'mobile', price: 900, observed_at: h(100) }, // stale amazon
      { identity_key: 'k4', category: 'mobile', price: 800, observed_at: h(1) },  // paired only with noon => not anchored
      { identity_key: 'k5', category: 'washing_machine', price: 1000, observed_at: h(2) }, // wins vs almanea 1500 (33%)
      { identity_key: 'k6', category: 'tv', price: 4179, observed_at: h(2) },  // 5x gap => identity mismatch, excluded
    ];
    const others = [
      { identity_key: 'k1', store_id: 4, price: 1899, observed_at: h(10) },
      { identity_key: 'k1', store_id: 3, price: 1750, observed_at: h(10) }, // noon cheaper than extra but amazon still cheapest
      { identity_key: 'k2', store_id: 5, price: 1900, observed_at: h(10) },
      { identity_key: 'k3', store_id: 4, price: 1200, observed_at: h(10) },
      { identity_key: 'k4', store_id: 3, price: 950, observed_at: h(10) },
      { identity_key: 'k5', store_id: 5, price: 1500, observed_at: h(10) },
      { identity_key: 'k5', store_id: 4, price: 1600, observed_at: h(400) }, // stale competitor ignored
      { identity_key: 'k6', store_id: 4, price: 20999, observed_at: h(10) },
    ];
    const names = new Map([['k1', { nameAr: 'تلفزيون', compareUrl: '/ar/compare/k1' }]]);
    const counters = { implausible: 0 };
    const wins = rankAmazonWins(amazon, others, names, now, 48, counters);
    expect(wins.map((w) => w.identityKey)).toEqual(['k5', 'k1']);
    expect(counters.implausible).toBe(1);
    expect(wins[1]).toMatchObject({ nameAr: 'تلفزيون', bestOtherStore: 'نون', bestOtherPrice: 1750, savingSar: 51, otherStoresCount: 2 });
    expect(wins[0].savingPct).toBeCloseTo(33.3, 0);
  });
});
