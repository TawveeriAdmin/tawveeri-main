// ADR-251 regression — the 10× ingestion collapse.
// corroboratePass loaded staging (and price history) through single un-paginated PostgREST
// requests; the server's 1,000-row response cap silently truncated them oldest-first, so the
// NEWEST observations never became normalized_product_observations / price_history rows.
// These tests run corroboratePass against a fake PostgREST client that ENFORCES the cap and
// prove: (1) every staged row is loaded despite the cap; (2) writes are flushed in bounded
// slices; (3) last-price loading survives the cap.
import { corroboratePass } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const CAP = 1000;

/** Minimal CategoryDef — only the fields corroboratePass touches. */
const def = {
  category: "tv", detected: "tv", version: "test-v1",
  requireValidTier: true, priceBand: null,
  names: () => ({ nameAr: "منتج", nameEn: "Product" }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

interface FakeTables {
  staging: Record<string, unknown>[];
  price_history: Record<string, unknown>[];
  canonical_products: Record<string, unknown>[];
}

/** Chainable builder that mimics PostgREST semantics INCLUDING the row cap:
 *  a request without .range() — or with a range wider than the cap — returns at most CAP rows. */
function fakeSupabase(tables: FakeTables, rpcCalls: Record<string, unknown>[][]) {
  const q = (rows: Record<string, unknown>[]) => {
    let filtered = rows;
    let from = 0, to = CAP - 1;
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => { /* noop */ }),
      eq: chain((col: string, v: unknown) => { filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === v); }),
      in: chain((col: string, vs: unknown[]) => { const s = new Set(vs); filtered = filtered.filter((r) => s.has((r as Record<string, unknown>)[col])); }),
      order: chain((col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false;
        filtered = [...filtered].sort((a, x) => {
          const av = (a as Record<string, never>)[col], xv = (x as Record<string, never>)[col];
          return (av < xv ? -1 : av > xv ? 1 : 0) * (asc ? 1 : -1);
        });
      }),
      range: chain((f: number, t: number) => { from = f; to = t; }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
        const span = Math.min(to - from + 1, CAP); // the server-side cap
        resolve({ data: filtered.slice(from, from + span), error: null });
      },
    });
    return b;
  };
  return {
    from: (table: string) =>
      q(table === "tps_identity_staging" ? tables.staging : table === "price_history" ? tables.price_history : tables.canonical_products),
    rpc: (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push([args] as unknown as Record<string, unknown>[]);
      return Promise.resolve({ data: { canonical: (args.p_canonical as unknown[]).length }, error: null });
    },
  };
}

function stagingRow(rawId: number, storeId: number, key: string) {
  return {
    category: "tv", raw_obs_id: rawId, store_id: storeId, identity_key: key, status: "valid",
    price: 1000 + (rawId % 7), url: `https://x/p${rawId}`, name: `Item ${rawId}`, confidence: 90,
    payload: {}, observed_at: new Date(2026, 7, 1 + (rawId % 14)).toISOString(),
  };
}

describe("ADR-251 — corroborate staging load survives the PostgREST row cap", () => {
  it("loads ALL staging rows for a key with more rows than the cap (the collapse case)", async () => {
    // ONE key, TWO stores, 1,700 staging rows — pre-fix, only the oldest 1,000 were visible
    // and the newest 700 observations were silently lost.
    const staging = Array.from({ length: 1700 }, (_, i) => stagingRow(i + 1, i % 2 === 0 ? 4 : 5, "brand|MODEL:X1"));
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ staging, price_history: [], canonical_products: [] }, rpcCalls) as never;

    const R = await corroboratePass(sb, def, ["brand|MODEL:X1"]);

    const written = rpcCalls.flatMap((c) => ((c[0] as Record<string, unknown>).p_normalized as unknown[]));
    expect(written.length).toBe(1700);          // every observation, not the first 1,000
    expect(R.normalized).toBe(1700);
    expect(R.corroborated).toBe(1);             // 2 stores → comparable
  });

  it("flushes write_ac_batch in bounded slices (self-heal payloads cannot hit the statement timeout)", async () => {
    const keys = ["k1", "k2", "k3"];
    const staging = keys.flatMap((k, ki) =>
      Array.from({ length: 1200 }, (_, i) => stagingRow(ki * 10000 + i + 1, i % 2 === 0 ? 4 : 5, k)));
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ staging, price_history: [], canonical_products: [] }, rpcCalls) as never;

    await corroboratePass(sb, def, keys);

    expect(rpcCalls.length).toBeGreaterThan(1); // 3,600 normalized rows never travel in one RPC
    for (const c of rpcCalls) {
      const norm = (c[0] as Record<string, unknown>).p_normalized as unknown[];
      // slice threshold (1,500) + at most one key's overshoot
      expect(norm.length).toBeLessThanOrEqual(1500 + 1200);
    }
    const total = rpcCalls.reduce((s, c) => s + (((c[0] as Record<string, unknown>).p_normalized as unknown[]).length), 0);
    expect(total).toBe(3600);
  });

  it("keeps only status='valid' rows when the def requires the valid tier", async () => {
    const staging = [
      ...Array.from({ length: 20 }, (_, i) => stagingRow(i + 1, 4, "k")),
      ...Array.from({ length: 20 }, (_, i) => ({ ...stagingRow(100 + i, 5, "k"), status: "low_confidence_candidate" })),
    ];
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ staging, price_history: [], canonical_products: [] }, rpcCalls) as never;
    const R = await corroboratePass(sb, def, ["k"], { singleStore: true });
    expect(R.normalized).toBe(20);              // low-confidence rows stay excluded, as before
  });

  it("price-history last-price load paginates past the cap (no fabricated 'changed' prices)", async () => {
    // One key, one store, 40 staged rows all at the SAME price. History holds 1,050 rows for
    // this canonical whose LATEST row already records that price — pre-fix the cap could hide
    // it and re-append an unchanged price.
    const staging = Array.from({ length: 40 }, (_, i) => ({ ...stagingRow(i + 1, 4, "kP"), price: 999 }));
    const canonicalId = "will-not-match-existing";
    const history = Array.from({ length: 1050 }, (_, i) => ({
      canonical_product_id: canonicalId, store_name: "اكسترا", price: i === 0 ? 999 : 500 + i,
      observed_at: new Date(2026, 6, 1, 0, 1050 - i).toISOString(), // i=0 is the LATEST
    }));
    const rpcCalls: Record<string, unknown>[][] = [];
    const tables: FakeTables = { staging, price_history: history, canonical_products: [] };
    // Force the canonical id used by the engine to match our history rows: stableUuid is
    // deterministic, so instead we point the history at whatever id the engine mints by
    // running once to observe it, then re-running with aligned history.
    const sbProbe = fakeSupabase({ ...tables, price_history: [] }, rpcCalls) as never;
    await corroboratePass(sbProbe, def, ["kP"], { singleStore: true });
    const mintedId = ((rpcCalls[0][0] as Record<string, unknown>).p_canonical as Record<string, unknown>[])[0].id as string;
    for (const h of history) h.canonical_product_id = mintedId;

    const rpc2: Record<string, unknown>[][] = [];
    const sb = fakeSupabase(tables, rpc2) as never;
    const R = await corroboratePass(sb, def, ["kP"], { singleStore: true });
    // Latest history price equals the observed price → NOT a change → nothing appended.
    expect(R.prices).toBe(0);
    const prices = rpc2.flatMap((c) => ((c[0] as Record<string, unknown>).p_prices as unknown[]));
    expect(prices.length).toBe(0);
  });
});

describe("ADR-251 incident follow-up — self-heal row budget", () => {
  it("defers whole key-chunks beyond CORROBORATE_ROW_BUDGET (never partial per-key loads)", async () => {
    process.env.CORROBORATE_ROW_BUDGET = "1000";
    try {
      // 101 keys → two 100-key chunks. Chunk 1 alone exceeds the budget, so chunk 2
      // (key "extra") must be deferred entirely — its rows never reach the write.
      const keys = [...Array.from({ length: 100 }, (_, i) => `k${i}`), "extra"];
      const staging = [
        ...keys.slice(0, 100).flatMap((k, ki) => Array.from({ length: 30 }, (_, i) => stagingRow(ki * 100 + i + 1, 4, k))),
        ...Array.from({ length: 30 }, (_, i) => stagingRow(90000 + i, 4, "extra")),
      ];
      const rpcCalls: Record<string, unknown>[][] = [];
      const sb = fakeSupabase({ staging, price_history: [], canonical_products: [] }, rpcCalls) as never;
      await corroboratePass(sb, def, keys, { singleStore: true });
      const written = rpcCalls.flatMap((c) => ((c[0] as Record<string, unknown>).p_normalized as Record<string, unknown>[]));
      expect(written.length).toBe(3000);                                   // chunk 1 complete
      expect(written.some((n) => n.identity_key === "extra")).toBe(false); // chunk 2 deferred whole
    } finally {
      delete process.env.CORROBORATE_ROW_BUDGET;
    }
  });
});
