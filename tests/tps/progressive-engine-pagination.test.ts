// ADR-252 — forward-only corroboration (SEV-1 remediation; supersedes the ADR-251 tests).
// The structural invariant under test: PROCESSING A NEW OBSERVATION NEVER RE-READS A
// KEY'S OBSERVATION HISTORY. The pass consumes (a) this sweep's in-memory rows and
// (b) the small `tps_current_offers` current state — `tps_identity_staging` is a COLD
// audit trail the hot path must not touch, and `price_history` is never scanned for
// last-price comparison (the current state carries the previous price).
import { corroboratePass } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const CAP = 1000; // PostgREST-style response cap, still enforced by the fake

const def = {
  category: "tv", detected: "tv", version: "test-v1",
  requireValidTier: true, priceBand: null,
  names: () => ({ nameAr: "منتج", nameEn: "Product" }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

interface FakeTables {
  current_offers: Record<string, unknown>[];
  canonical_products: Record<string, unknown>[];
}

function fakeSupabase(tables: FakeTables, rpcCalls: Record<string, unknown>[][], log: { reads: string[]; upserts: Record<string, unknown>[][] }) {
  const q = (table: string, rows: Record<string, unknown>[]) => {
    let filtered = rows;
    let from = 0, to = CAP - 1;
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => { log.reads.push(table); }),
      eq: chain((col: string, v: unknown) => { filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === v); }),
      in: chain((col: string, vs: unknown[]) => { const s = new Set(vs); filtered = filtered.filter((r) => s.has((r as Record<string, unknown>)[col])); }),
      order: chain(() => { /* deterministic enough for these fixtures */ }),
      range: chain((f: number, t: number) => { from = f; to = t; }),
      upsert: (rows2: Record<string, unknown>[]) => {
        if (table === "tps_current_offers") log.upserts.push(rows2);
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
        const span = Math.min(to - from + 1, CAP);
        resolve({ data: filtered.slice(from, from + span), error: null });
      },
    });
    return b;
  };
  return {
    from: (table: string) =>
      q(table, table === "tps_current_offers" ? tables.current_offers : table === "canonical_products" ? tables.canonical_products : []),
    rpc: (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push([args] as unknown as Record<string, unknown>[]);
      return Promise.resolve({ data: { canonical: (args.p_canonical as unknown[]).length }, error: null });
    },
  };
}

const offerRow = (rawId: number, storeId: number, key: string, price: number, over: Record<string, unknown> = {}) => ({
  category: "tv", raw_obs_id: rawId, store_id: storeId, identity_key: key, status: "valid",
  price, url: `https://x/p${storeId}`, name: `Item ${rawId}`, confidence: 90,
  payload: {}, observed_at: new Date(2026, 7, 10).toISOString(), ...over,
});

const newLog = () => ({ reads: [] as string[], upserts: [] as Record<string, unknown>[][] });

describe("ADR-252 — the hot path never reads history", () => {
  it("reads ONLY tps_current_offers + canonical_products — never staging, never price_history", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls, log) as never;
    await corroboratePass(sb, def, ["k"], { sweepRows: [offerRow(10, 4, "k", 999)], singleStore: true });
    expect(log.reads).not.toContain("tps_identity_staging");
    expect(log.reads).not.toContain("price_history");
    expect(new Set(log.reads)).toEqual(new Set(["tps_current_offers", "canonical_products"]));
  });

  it("cost is bounded by current state, not history depth: one new row writes ONE npo row", async () => {
    // Previous state: 12 stores' current offers for the key (stands in for any history depth).
    const prev = Array.from({ length: 12 }, (_, i) => offerRow(100 + i, 20 + i, "k", 1000 + i));
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, def, ["k"], { sweepRows: [offerRow(500, 4, "k", 777)] });
    expect(R.normalized).toBe(1);                       // ONLY the new observation
    expect(R.corroborated).toBe(1);                     // corroboration from merged state (13 stores)
    const written = rpcCalls.flatMap((c) => ((c[0] as Record<string, unknown>).p_normalized as unknown[]));
    expect(written.length).toBe(1);
  });
});

describe("ADR-252 — price events are change-only against the current state", () => {
  const run = async (prevPrice: number | null, newPrice: number) => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const prev = prevPrice != null ? [offerRow(10, 4, "k", prevPrice)] : [];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, def, ["k"], { sweepRows: [offerRow(20, 4, "k", newPrice, { observed_at: new Date(2026, 7, 15).toISOString() })], singleStore: true });
    const prices = rpcCalls.flatMap((c) => ((c[0] as Record<string, unknown>).p_prices as Record<string, unknown>[]));
    return { R, prices, log };
  };
  it("unchanged price → NO event appended (no fabricated changes)", async () => {
    const { R, prices } = await run(999, 999);
    expect(R.prices).toBe(0);
    expect(prices.length).toBe(0);
  });
  it("changed price → exactly one event with the observation's own timestamp", async () => {
    const { R, prices } = await run(999, 899);
    expect(R.prices).toBe(1);
    expect(prices.length).toBe(1);
    expect(prices[0].price).toBe(899);
  });
  it("first-ever offer for a (key, store) → one initial event", async () => {
    const { R } = await run(null, 1234);
    expect(R.prices).toBe(1);
  });
});

describe("ADR-252 — current-state upsert discipline", () => {
  it("keeps the newest new row per (key, store) and skips unchanged re-observations within the hour", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const t = new Date(2026, 7, 15, 12, 0).toISOString();
    const prev = [offerRow(10, 4, "k", 999, { observed_at: t })];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [] }, rpcCalls, log) as never;
    await corroboratePass(sb, def, ["k"], {
      singleStore: true,
      sweepRows: [
        offerRow(20, 4, "k", 999, { observed_at: new Date(2026, 7, 15, 12, 20).toISOString() }), // unchanged, 20min later → skipped
        offerRow(21, 5, "k", 500, { observed_at: t }),                                            // new store → upserted
        offerRow(19, 5, "k", 400, { observed_at: t }),                                            // older same-sweep row → superseded
      ],
    });
    const upserted = log.upserts.flat();
    expect(upserted.length).toBe(1);
    expect(upserted[0].store_id).toBe(5);
    expect(upserted[0].raw_obs_id).toBe(21); // newest of the two same-store rows
  });

  it("dry mode computes everything and writes nothing", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, def, ["k"], { dry: true, singleStore: true, sweepRows: [offerRow(1, 4, "k", 100)] });
    expect(R.normalized).toBe(1);
    expect(rpcCalls.length).toBe(0);
    expect(log.upserts.length).toBe(0);
  });
});

describe("ADR-252 — write slices stay bounded (unchanged from ADR-251)", () => {
  it("many new rows across keys still flush in bounded write_ac_batch slices", async () => {
    const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const sweepRows = keys.flatMap((k, ki) => [
      offerRow(ki * 10 + 1, 4, k, 100 + ki),
      offerRow(ki * 10 + 2, 5, k, 110 + ki),
    ]);
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, def, keys, { sweepRows });
    expect(R.normalized).toBe(60);
    const total = rpcCalls.reduce((s, c) => s + ((c[0] as Record<string, unknown>).p_normalized as unknown[]).length, 0);
    expect(total).toBe(60);
    for (const c of rpcCalls) {
      expect(((c[0] as Record<string, unknown>).p_normalized as unknown[]).length).toBeLessThanOrEqual(1500 + 60);
    }
  });
});
