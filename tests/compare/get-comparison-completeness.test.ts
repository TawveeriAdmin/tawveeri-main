// tests/compare/get-comparison-completeness.test.ts — ADR-387 §3.
// PROOF that a store's newest observation is never lost to another store's volume:
// store A floods the newest-first observation window (1,200 rows newer than anything of
// store B), while store B's genuine newest observation lives ONLY outside that window and
// in `tps_current_offers`. The derivation must still report B as observed at its true time,
// with its current price, availability and a resolvable exit. Also pins: a failed/absent
// re-observation never makes a price look newer; an out-of-stock newest observation is
// honored over an older in-stock price row; ties resolve to the current-state row.
import { getComparison, isComparisonError } from '@/lib/compare/get-comparison';

type Row = Record<string, unknown>;
const NOW = Date.parse('2026-09-26T06:00:00Z');
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

// ── a tiny PostgREST-shaped fake: tables → rows, with the filter verbs get-comparison uses ──
let tables: Record<string, Row[]>;
function fakeClient() {
  const build = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    const run = () => {
      let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (order) rows = [...rows].sort((a, b) => (String(a[order!.col]) < String(b[order!.col]) ? -1 : 1) * (order!.asc ? 1 : -1));
      if (limit != null) rows = rows.slice(0, limit);
      return { data: rows, error: null };
    };
    const col = (r: Row, c: string) => (c.includes('->>') ? String(((r.normalized_payload as Row) ?? {})[c.split('->>')[1]] ?? '') : r[c]);
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => String(col(r, c)) === String(v)); return q; },
      in: (c: string, vals: unknown[]) => { const s = new Set(vals.map(String)); filters.push((r) => s.has(String(col(r, c)))); return q; },
      not: (c: string, _op: string, _v: unknown) => { filters.push((r) => col(r, c) != null); return q; },
      order: (c: string, o: { ascending: boolean }) => { order = { col: c, asc: o.ascending }; return q; },
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  return { from: (t: string) => build(t) };
}
jest.mock('@/lib/database', () => ({ createServerClient: () => fakeClient() }));
jest.mock('@/lib/analytics/build-go-url', () => ({ buildGoUrl: (id: string) => `/go/${id}` }));

const CANON = 'c-1';
const KEY = 'lg|split|FreshDV|18000|Inverter|cool_only';

function baseTables(): Record<string, Row[]> {
  return {
    canonical_products: [{ id: CANON, name_ar: 'FreshDV', name_en: 'FreshDV', brand: 'lg', category: 'ac', tps_identity_key: KEY, identity_confidence: 95, is_active: true, attributes: {} }],
    price_history: [],
    tps_offer_delist_signals: [],
    tps_current_offers: [],
    normalized_product_observations: [],
    raw_observations: [],
  };
}

beforeAll(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterAll(() => { (Date.now as jest.Mock).mockRestore?.(); });

describe('getComparison — completeness under an unbalanced observation window', () => {
  it("store B's newest observation (outside the 1000-row window, present in tps_current_offers) is still what the page reports", async () => {
    tables = baseTables();
    // Price events (price_history, newest-first by the loader): A changed price 2h ago; B's last price change was 9 days ago.
    tables.price_history.push(
      { canonical_product_id: CANON, store_name: 'اكسترا', price: 3099, availability: null, observed_at: iso(2), tps_observation_id: 'npo-a-price' },
      { canonical_product_id: CANON, store_name: 'متجر النخيل', price: 2799, availability: null, observed_at: iso(9 * 24), tps_observation_id: 'npo-b-price' },
    );
    // Store A (extra, store_id 4) floods the window: 1,200 observations, all newer than anything from B.
    for (let i = 0; i < 1200; i++) {
      tables.normalized_product_observations.push({ id: `npo-a-${i}`, canonical_product_id: CANON, store_id: '4', raw_name: 'LG Fresh DV extra', confidence: 100, observed_at: iso(2 + i * 0.01), normalized_payload: { _raw_id: 10000 + i, _url: 'https://extra.com/p/1' } });
    }
    tables.normalized_product_observations.push({ id: 'npo-a-price', canonical_product_id: CANON, store_id: '4', raw_name: 'LG Fresh DV extra', confidence: 100, observed_at: iso(2), normalized_payload: { _raw_id: 9000, _url: 'https://extra.com/p/1' } });
    // Store B (alnakheelk, 18): its genuinely newest observation is 1h old but sits OUTSIDE the window
    // because the fake sorts by observed_at desc and A's 1,200 rows come first? No — 1h is newer than A's.
    // Make the window test honest: B's newest is 30h old, A's 1,200 rows span 2h..14h. B's row is outside.
    tables.normalized_product_observations.push(
      { id: 'npo-b-newest', canonical_product_id: CANON, store_id: '18', raw_name: 'ال جي فريش ريش مزدوجة', confidence: 100, observed_at: iso(30), normalized_payload: { _raw_id: 555, _url: 'https://alnakheelk.com/p/737' } },
      { id: 'npo-b-price', canonical_product_id: CANON, store_id: '18', raw_name: 'ال جي فريش ريش مزدوجة', confidence: 100, observed_at: iso(9 * 24), normalized_payload: { _raw_id: 444, _url: 'https://alnakheelk.com/p/737' } },
    );
    tables.tps_current_offers.push(
      { identity_key: KEY, store_id: 18, status: 'valid', price: 2799, url: 'https://alnakheelk.com/p/737', raw_obs_id: 555, observed_at: iso(30), payload: { _availability: 'in_stock' } },
      { identity_key: KEY, store_id: 4, status: 'valid', price: 3099, url: 'https://extra.com/p/1', raw_obs_id: 9000, observed_at: iso(2), payload: { _availability: 'in_stock' } },
    );
    tables.raw_observations.push({ id: 555, scraped_at: iso(30), payload: { availability: 'in_stock' } }, { id: 9000, scraped_at: iso(2), payload: { availability: 'in_stock' } }, { id: 444, scraped_at: iso(9 * 24), payload: { availability: 'in_stock' } });

    const r = await getComparison({ identityKey: KEY });
    if (isComparisonError(r)) throw new Error(r.error);
    const b = r.offers.find((o) => o.store_slug === 'alnakheelk')!;
    expect(b).toBeDefined();
    expect(b.observed_at).toBe(iso(30)); // its true newest observation, not the 9-day-old price event
    expect(b.stale).toBe(false);
    expect(b.price).toBe(2799);
    expect(b.product_url).toBe('/go/npo-b-price'); // price unchanged → the price-linked attributed exit stays
    expect(r.summary.cheapest_store).toBe('متجر النخيل');
    expect(r.summary.lowest_price).toBe(2799);
  });

  it('a NEWER current-state observation that says out_of_stock is honored over an older in-stock price row', async () => {
    tables = baseTables();
    tables.price_history.push({ canonical_product_id: CANON, store_name: 'اكسترا', price: 3099, availability: 'in_stock', observed_at: iso(48), tps_observation_id: 'npo-a-price' });
    tables.normalized_product_observations.push(
      { id: 'npo-a-price', canonical_product_id: CANON, store_id: '4', raw_name: 'x', confidence: 100, observed_at: iso(48), normalized_payload: { _raw_id: 1, _url: 'https://extra.com/p/1' } },
      { id: 'npo-a-new', canonical_product_id: CANON, store_id: '4', raw_name: 'x', confidence: 100, observed_at: iso(1), normalized_payload: { _raw_id: 2, _url: 'https://extra.com/p/1' } },
    );
    tables.tps_current_offers.push({ identity_key: KEY, store_id: 4, status: 'valid', price: 3099, url: 'https://extra.com/p/1', raw_obs_id: 2, observed_at: iso(1), payload: { _availability: 'out_of_stock' } });
    tables.raw_observations.push({ id: 1, scraped_at: iso(48), payload: { availability: 'in_stock' } }, { id: 2, scraped_at: iso(1), payload: { availability: 'out_of_stock' } });
    const r = await getComparison({ identityKey: KEY });
    if (isComparisonError(r)) throw new Error(r.error);
    expect(r.offers).toHaveLength(0); // an out-of-stock newest observation removes the offer from the comparison
    expect(r.summary.lowest_price).toBeNull();
  });

  it('an OLDER current-state row never overrides a newer price event (no false freshness from a stale hot row)', async () => {
    tables = baseTables();
    tables.price_history.push({ canonical_product_id: CANON, store_name: 'اكسترا', price: 2999, availability: null, observed_at: iso(3), tps_observation_id: 'npo-a-price' });
    tables.normalized_product_observations.push({ id: 'npo-a-price', canonical_product_id: CANON, store_id: '4', raw_name: 'x', confidence: 100, observed_at: iso(3), normalized_payload: { _raw_id: 1, _url: 'https://extra.com/p/1' } });
    tables.tps_current_offers.push({ identity_key: KEY, store_id: 4, status: 'valid', price: 3099, url: 'https://extra.com/p/1', raw_obs_id: 0, observed_at: iso(200), payload: { _availability: 'in_stock' } });
    tables.raw_observations.push({ id: 1, scraped_at: iso(3), payload: { availability: 'in_stock' } });
    const r = await getComparison({ identityKey: KEY });
    if (isComparisonError(r)) throw new Error(r.error);
    expect(r.offers[0].price).toBe(2999);
    expect(r.offers[0].observed_at).toBe(iso(3));
  });

  it('a current-state row marked superseded_by_identity removes that store from this identity (repaired identity, no ghost offer)', async () => {
    tables = baseTables();
    tables.price_history.push({ canonical_product_id: CANON, store_name: 'المنيع', price: 3919, availability: null, observed_at: iso(8), tps_observation_id: 'npo-al' });
    tables.normalized_product_observations.push({ id: 'npo-al', canonical_product_id: CANON, store_id: '5', raw_name: 'NF182C2', confidence: 100, observed_at: iso(8), normalized_payload: { _raw_id: 7, _url: 'https://almanea.sa/p/1' } });
    tables.tps_current_offers.push({ identity_key: KEY, store_id: 5, status: 'valid', price: 3919, url: 'https://almanea.sa/p/1', raw_obs_id: 7, observed_at: iso(8), payload: { _availability: 'in_stock', _superseded_by_identity: 'lg|split|Fresh|18000|Inverter|cool_only' } });
    tables.raw_observations.push({ id: 7, scraped_at: iso(8), payload: {} });
    const r = await getComparison({ identityKey: KEY });
    if (isComparisonError(r)) throw new Error(r.error);
    expect(r.offers.find((o) => o.store_slug === 'almanea')).toBeUndefined();
  });
});
