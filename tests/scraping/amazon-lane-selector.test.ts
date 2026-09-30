/**
 * F-004 phase 3 — Amazon price_update selection in ASIN space with lanes.
 *
 * Pins the founder-approved fence: one attempt per ASIN (healthiest sibling, never a fan-out),
 * fixed quotas under the existing ceiling, dead-letter on BOTH conditions (never the counter
 * alone — discovery zeroes it), the income-lane 3-strike rule, paginated TPS/click reads
 * (ADR-172/285), and that nothing outside amazon's branch changed.
 */
import fs from 'fs';
import path from 'path';
import {
  AMAZON_LANE_QUOTAS,
  asinOf,
  isDeadRow,
  loadAmazonLaneInputs,
  planAmazonLanes,
  type AmazonLaneInputs,
  type AmazonStoreRow,
} from '@/lib/scraping/services/amazon-lane-selector';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const CUTOFF = NOW - 12 * 3600_000;
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const asinN = (n: number) => `B0${String(n).padStart(8, '0')}`; // B0 + 8 digits = 10 chars

let seq = 0;
function row(asin: string | null, over: Partial<AmazonStoreRow> = {}): AmazonStoreRow {
  const id = over.id ?? `r${String(++seq).padStart(6, '0')}`;
  return {
    id,
    product_id: over.product_id ?? `p-${id}`,
    store_id: 2,
    product_url: asin ? `https://www.amazon.sa/dp/${asin}?tag=tawveeri-21` : 'https://www.amazon.sa/some/other/page',
    current_price: 100,
    availability: 'in_stock',
    last_checked_at: null,
    updated_at: daysAgo(3),
    consecutive_misses: 0,
    scrape_status: 'ok',
    ...over,
  };
}
const offer = (asin: string, key: string, obsDaysAgo = 2) => ({ identity_key: key, url: `https://www.amazon.sa/dp/${asin}`, observed_at: daysAgo(obsDaysAgo) });
const inputs = (over: Partial<AmazonLaneInputs> = {}): AmazonLaneInputs => ({ rows: [], tpsAmazon: [], otherStoreIdentityKeys: new Set(), l1Asins: new Set(), ...over });
const plan = (i: AmazonLaneInputs, maxProducts = 300) => planAmazonLanes(i, { nowMs: NOW, cutoffMs: CUTOFF, maxProducts });
const laneOf = (p: ReturnType<typeof plan>, r: AmazonStoreRow) => p.laneByRowId.get(r.id)?.lane;

describe('asinOf', () => {
  it('reads dp, gp/product and search-result-tracked urls; uppercases; rejects non-ASIN pages', () => {
    expect(asinOf('https://www.amazon.sa/dp/B0GNJSXNC8')).toBe('B0GNJSXNC8');
    expect(asinOf('https://www.amazon.sa/dp/b0gnjsxnc8?tag=x')).toBe('B0GNJSXNC8');
    expect(asinOf('https://www.amazon.sa/Some-Title/dp/B0F9KVBQLY/ref=sr_1_41?dib=abc&qid=1&sr=1-41')).toBe('B0F9KVBQLY');
    expect(asinOf('https://www.amazon.sa/gp/product/B07MJZ6HB9/')).toBe('B07MJZ6HB9');
    expect(asinOf('https://www.amazon.sa/some/other/page')).toBeNull();
    expect(asinOf(null)).toBeNull();
  });
});

describe('one attempt per ASIN — never a fan-out across siblings', () => {
  it('collapses siblings (even under different product_ids) to the single healthiest row', () => {
    const a = asinN(1);
    const bad = row(a, { id: 'a-bad', product_id: 'P1', consecutive_misses: 4, scrape_status: 'failed' });
    const good = row(a, { id: 'a-good', product_id: 'P2', consecutive_misses: 0, scrape_status: 'ok' });
    const mid = row(a, { id: 'a-mid', product_id: 'P3', consecutive_misses: 2, scrape_status: 'failed' });
    const p = plan(inputs({ rows: [bad, good, mid] }));
    expect(p.rows.map((r) => r.id)).toEqual(['a-good']);
    expect([...p.laneByRowId.keys()]).toEqual(['a-good']); // the caller can only ever write this ONE row
  });

  it('a row without a parsable ASIN stands alone (still one attempt)', () => {
    const p = plan(inputs({ rows: [row(null, { id: 'x1' }), row(null, { id: 'x2' })] }));
    expect(p.rows.map((r) => r.id).sort()).toEqual(['x1', 'x2']);
  });

  it('every returned ASIN is distinct', () => {
    const rows: AmazonStoreRow[] = [];
    for (let i = 0; i < 60; i++) for (let s = 0; s < 3; s++) rows.push(row(asinN(i)));
    const p = plan(inputs({ rows }));
    const asins = p.rows.map((r) => asinOf(r.product_url));
    expect(new Set(asins).size).toBe(asins.length);
    expect(asins.length).toBe(60);
  });
});

describe('dead-letter — both conditions, never the counter alone', () => {
  it('isDeadRow needs misses>=7 AND no credible write in 30 days', () => {
    expect(isDeadRow(row('B0AAAAAAA1', { consecutive_misses: 7, updated_at: daysAgo(45) }), NOW)).toBe(true);
    expect(isDeadRow(row('B0AAAAAAA2', { consecutive_misses: 7, updated_at: null }), NOW)).toBe(true);
    expect(isDeadRow(row('B0AAAAAAA3', { consecutive_misses: 7, updated_at: daysAgo(5) }), NOW)).toBe(false); // recent write
    expect(isDeadRow(row('B0AAAAAAA4', { consecutive_misses: 6, updated_at: daysAgo(90) }), NOW)).toBe(false); // counter below
    expect(isDeadRow(row('B0AAAAAAA5', { consecutive_misses: 0, updated_at: daysAgo(90) }), NOW)).toBe(false); // discovery zeroed it
  });

  it('a dead row is excluded when a live sibling exists; an all-dead ASIN is graveyard-only (max 1 probe)', () => {
    const live = row(asinN(1), { id: 'live', consecutive_misses: 0 });
    const dead = row(asinN(1), { id: 'dead', consecutive_misses: 9, updated_at: daysAgo(60) });
    const allDeadA = row(asinN(2), { id: 'dA', consecutive_misses: 8, updated_at: daysAgo(60) });
    const allDeadB = row(asinN(3), { id: 'dB', consecutive_misses: 8, updated_at: daysAgo(60) });
    const p = plan(inputs({ rows: [live, dead, allDeadA, allDeadB] }));
    expect(p.rows.map((r) => r.id)).toContain('live');
    expect(p.rows.map((r) => r.id)).not.toContain('dead');
    const probes = p.rows.filter((r) => laneOf(p, r) === 'probe');
    expect(probes).toHaveLength(AMAZON_LANE_QUOTAS.probe);
    expect(AMAZON_LANE_QUOTAS.probe).toBeLessThanOrEqual(1);
  });

  it('the probe runs FIRST so a cycle that ends at 77-79 attempts still reaches it', () => {
    const rows = [row(asinN(1)), row(asinN(2)), row(asinN(3), { id: 'dead', consecutive_misses: 9, updated_at: daysAgo(90) })];
    const p = plan(inputs({ rows }));
    expect(p.rows[0].id).toBe('dead');
    expect(laneOf(p, p.rows[0])).toBe('probe');
  });
});

describe('lane assignment', () => {
  it('income > comparison-visible > other TPS-valid > tail', () => {
    const [aL1, aL2, aL3, aTail] = [asinN(10), asinN(11), asinN(12), asinN(13)];
    const rL1 = row(aL1), rL2 = row(aL2), rL3 = row(aL3), rTail = row(aTail);
    const p = plan(inputs({
      rows: [rL1, rL2, rL3, rTail],
      // aL1 is ALSO comparison-visible: the income lane must win
      tpsAmazon: [offer(aL1, 'k1'), offer(aL2, 'k2'), offer(aL3, 'k3')],
      otherStoreIdentityKeys: new Set(['k1', 'k2']),
      l1Asins: new Set([aL1]),
    }));
    expect(laneOf(p, rL1)).toBe('l1');
    expect(laneOf(p, rL2)).toBe('l2');
    expect(laneOf(p, rL3)).toBe('l3');
    expect(laneOf(p, rTail)).toBe('tail');
  });
});

describe('quotas under the existing ceiling', () => {
  it('the first 80 follow 6/40/20/13/1 exactly, with one row per ASIN and the 300 cap honoured', () => {
    const rows: AmazonStoreRow[] = [];
    const tps: ReturnType<typeof offer>[] = [];
    const others = new Set<string>();
    const l1 = new Set<string>();
    let n = 100;
    for (let i = 0; i < 10; i++) { const a = asinN(n++); rows.push(row(a)); tps.push(offer(a, `k${a}`)); l1.add(a); }
    for (let i = 0; i < 100; i++) { const a = asinN(n++); rows.push(row(a)); tps.push(offer(a, `k${a}`)); others.add(`k${a}`); }
    for (let i = 0; i < 50; i++) { const a = asinN(n++); rows.push(row(a)); tps.push(offer(a, `k${a}`)); }
    for (let i = 0; i < 200; i++) rows.push(row(asinN(n++)));
    for (let i = 0; i < 20; i++) rows.push(row(asinN(n++), { consecutive_misses: 9, updated_at: daysAgo(80) }));
    const p = plan(inputs({ rows, tpsAmazon: tps, otherStoreIdentityKeys: others, l1Asins: l1 }));

    const counts = { l1: 0, l2: 0, l3: 0, tail: 0, probe: 0 } as Record<string, number>;
    p.rows.slice(0, 80).forEach((r) => { counts[laneOf(p, r)!]++; });
    expect(counts).toEqual({ l1: 6, l2: 40, l3: 20, tail: 13, probe: 1 });
    expect(p.rows.length).toBeLessThanOrEqual(300);
    expect(new Set(p.rows.map((r) => asinOf(r.product_url))).size).toBe(p.rows.length);
  });

  it('interleaves — the income lane is not parked at the end of the block', () => {
    const rows: AmazonStoreRow[] = [];
    const tps: ReturnType<typeof offer>[] = [];
    const l1 = new Set<string>();
    for (let i = 0; i < 6; i++) { const a = asinN(500 + i); rows.push(row(a)); l1.add(a); tps.push(offer(a, `k${a}`)); }
    for (let i = 0; i < 80; i++) rows.push(row(asinN(600 + i)));
    const p = plan(inputs({ rows, tpsAmazon: tps, l1Asins: l1 }));
    const firstHalf = p.rows.slice(0, 40).filter((r) => laneOf(p, r) === 'l1').length;
    expect(firstHalf).toBeGreaterThanOrEqual(2);
  });

  it('unused quota flows down the lanes instead of being wasted', () => {
    const rows: AmazonStoreRow[] = [];
    for (let i = 0; i < 100; i++) rows.push(row(asinN(700 + i)));
    const p = plan(inputs({ rows }));
    expect(p.rows.slice(0, 80).every((r) => laneOf(p, r) === 'tail')).toBe(true); // all 80 slots used
    expect((p.summary.quota_block_taken as Record<string, number>).tail).toBe(80);
  });

  it('respects maxProducts', () => {
    const rows: AmazonStoreRow[] = [];
    for (let i = 0; i < 150; i++) rows.push(row(asinN(800 + i)));
    expect(plan(inputs({ rows }), 50).rows).toHaveLength(50);
  });
});

describe('income lane — B0GNJSXNC8 first, bounded by three strikes', () => {
  const PRIORITY = 'B0GNJSXNC8';

  it('is first in the income lane even when other income ASINs are staler', () => {
    const other = asinN(900);
    const rPri = row(PRIORITY, { updated_at: daysAgo(1) });
    const rOther = row(other, { updated_at: daysAgo(40) }); // much staler
    const p = plan(inputs({ rows: [rOther, rPri], tpsAmazon: [offer(other, 'kx', 40)], l1Asins: new Set([PRIORITY, other]) }));
    const l1Order = p.rows.filter((r) => laneOf(p, r) === 'l1').map((r) => asinOf(r.product_url));
    expect(l1Order[0]).toBe(PRIORITY);
  });

  it('still gets attempts at 1-2 misses, and is retired to the graveyard at 3 with no credible write', () => {
    const at = (m: number) => plan(inputs({ rows: [row(PRIORITY, { id: `pri${m}`, consecutive_misses: m, updated_at: null, scrape_status: 'failed' })], l1Asins: new Set([PRIORITY]) }));
    expect(laneOf(at(1), at(1).rows[0])).toBe('l1');
    expect(laneOf(at(2), at(2).rows[0])).toBe('l1');
    const three = at(3);
    expect(laneOf(three, three.rows[0])).toBe('probe'); // graveyard: probe-only, never a lane slot
    expect(three.summary.l1_retired).toBe(1);
  });

  it('an income ASIN with a recent credible write on ANY sibling is not retired', () => {
    const a = asinN(910);
    const failing = row(a, { id: 'f', consecutive_misses: 5, updated_at: daysAgo(80), scrape_status: 'failed' });
    const wrote = row(a, { id: 'w', consecutive_misses: 0, updated_at: daysAgo(2) });
    const p = plan(inputs({ rows: [failing, wrote], l1Asins: new Set([a]) }));
    expect(laneOf(p, p.rows[0])).toBe('l1');
    expect(p.rows[0].id).toBe('w');
  });
});

describe('rotation cursor and cooldown', () => {
  it('skips an ASIN attempted after the cutoff (any sibling), keeps one attempted before it', () => {
    const a = asinN(950), b = asinN(951);
    const recent = row(a, { id: 'recent', last_checked_at: new Date(NOW - 3600_000).toISOString() });
    const recentSibling = row(a, { id: 'recent-sib', last_checked_at: null });
    const old = row(b, { id: 'old', last_checked_at: new Date(NOW - 20 * 3600_000).toISOString() });
    const p = plan(inputs({ rows: [recent, recentSibling, old] }));
    expect(p.rows.map((r) => r.id)).toEqual(['old']);
  });
});

describe('loader — paginated, deterministic reads (ADR-172/285)', () => {
  // Emulates PostgREST with db-max-rows=1000: a response never carries more than 1000 rows,
  // whatever range was requested. Filters are recorded only to pick the fixture (eq/neq store_id).
  function mockClient(tables: Record<string, unknown[]>) {
    const calls: Array<{ key: string; from: number; to: number; orders: string[] }> = [];
    const client: any = {
      from(table: string) {
        const orders: string[] = [];
        let mode = '';
        const b: any = {
          select: () => b, or: () => b, not: () => b, gte: () => b,
          eq: (col: string) => { if (col === 'store_id') mode = ':eq'; return b; },
          neq: (col: string) => { if (col === 'store_id') mode = ':neq'; return b; },
          order: (col: string) => { orders.push(col); return b; },
          range: (from: number, to: number) => {
            const key = table === 'tps_current_offers' ? table + mode : table;
            calls.push({ key, from, to, orders: [...orders] });
            const data = (tables[key] ?? []).slice(from, Math.min(to + 1, from + 1000));
            return Promise.resolve({ data, error: null });
          },
        };
        return b;
      },
    };
    return { client, calls };
  }

  it('returns ALL rows past the 1000-row PostgREST cap, ordered deterministically on every paged read', async () => {
    const rows = Array.from({ length: 2300 }, (_, i) => row(asinN(2000 + i), { id: `row-${String(i).padStart(5, '0')}` }));
    const tpsAmazon = Array.from({ length: 1249 }, (_, i) => ({ category: 'tv', identity_key: `k${i}`, store_id: 2, url: `https://www.amazon.sa/dp/${asinN(2000 + i)}`, observed_at: daysAgo(1) }));
    const others = Array.from({ length: 1500 }, (_, i) => ({ category: 'tv', identity_key: `k${i}`, store_id: 3 }));
    const { client, calls } = mockClient({
      product_stores: rows,
      'tps_current_offers:eq': tpsAmazon,
      'tps_current_offers:neq': others,
      first_party_interactions: [{ interaction_id: 'i1' }],
      outbound_clicks: [
        { id: 'c1', interaction_id: 'i1', destination_url: 'https://www.amazon.sa/dp/B0GNJSXNC8?tag=t', store_name: '2' },
        { id: 'c2', interaction_id: 'unqualified', destination_url: 'https://www.amazon.sa/dp/B0ZZZZZZZZ', store_name: '2' },
        { id: 'c3', interaction_id: 'i1', destination_url: 'https://www.noon.com/x/N123/p/', store_name: '3' },
      ],
    });

    const out = await loadAmazonLaneInputs(client, 2, NOW);
    expect(out.rows).toHaveLength(2300);
    expect(out.tpsAmazon).toHaveLength(1249);
    expect(out.otherStoreIdentityKeys.size).toBe(1500);
    expect([...out.l1Asins]).toEqual(['B0GNJSXNC8']); // qualified + amazon only
    for (const key of ['product_stores', 'tps_current_offers:eq', 'tps_current_offers:neq', 'first_party_interactions', 'outbound_clicks']) {
      const paged = calls.filter((c) => c.key === key);
      expect(paged.length).toBeGreaterThan(0);
      expect(paged.every((c) => c.orders.length > 0)).toBe(true); // an unordered range() is as unstable as a bare limit()
    }
    expect(calls.filter((c) => c.key === 'product_stores').length).toBeGreaterThanOrEqual(3);
  });
});

describe('fence — static wiring', () => {
  const orch = fs.readFileSync(path.join(process.cwd(), 'src/lib/scraping/services/scraping-orchestrator.ts'), 'utf8');
  const sel = fs.readFileSync(path.join(process.cwd(), 'src/lib/scraping/services/amazon-lane-selector.ts'), 'utf8');

  it('lane selection is gated to amazon and switchable, and falls back to the previous selection', () => {
    expect(orch).toContain("isAmazonDedupe && process.env.WORKER_AMAZON_LANES_ENABLED !== '0'");
    expect(orch).toContain('falling back to the previous stalest-first selection');
    // the legacy query is still there, byte-for-byte for every other store
    expect(orch).toContain('.limit(isAmazonDedupe ? Math.min(requestedMax * 3, 900) : requestedMax);');
    expect(orch).toContain('rows = dedupeStalestPerProductId(rows, requestedMax);');
  });

  it('never fans a write out: the loop writes/stamps only the selected row id', () => {
    expect(orch).toMatch(/updateProductPrice\(\s*productId,\s*storeId,[\s\S]*?productStoreId,\s*\)/);
    expect(sel).not.toMatch(/\.update\(|\.upsert\(|\.insert\(/);
  });

  it('every unbounded read in the selector is paginated, none uses a bare .limit()', () => {
    expect(sel).toContain('fetchAllPaginated');
    expect(sel).not.toMatch(/\.limit\(/);
  });

  it('does not touch last_checked_at semantics, the batch, the ceiling or the request delay', () => {
    expect(sel).not.toMatch(/stampChecked|min_delay_ms|max_delay_ms|perStoreTimeoutMs|SOFT_DEADLINE/);
  });
});
