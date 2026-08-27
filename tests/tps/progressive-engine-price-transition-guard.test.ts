// Quality program P0-B (2026-08-27), §8.12 follow-up — TPS-layer price-transition guard.
//
// Gap: `assessPriceTransition` (ADR-200/211, src/lib/intelligence/price-truth-gate.ts) is
// proven and wired into the STOREFRONT layer's price-refresh path, but progressive-engine.ts
// (the TPS layer's price-write path) had NO equivalent — the AirPods Pro 2 canonical
// (SAR 1,049 -> SAR 79, ratio 0.075) was written with zero sanity check.
//
// Audited first (read-only, production price_history, 104,831 real consecutive
// (canonical,store) transitions across ALL categories) before writing any code: extreme
// transitions (ratio<0.25 or >4, the SAME bound already proven in the storefront layer) are
// 0.019% of all transitions (20 total) — confirms the same threshold is safe to reuse
// unmodified for TPS. This suite proves the write path now rejects exactly that class,
// while never touching the 99.98% of transitions that are normal price movement or
// legitimate large discounts/increases.
import { corroboratePass } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const CAP = 1000;

const audioDef = {
  category: "audio", detected: "audio", version: "test-v1",
  requireValidTier: true, priceBand: null,
  names: (_key: string, rep: Record<string, unknown>) => ({ nameAr: (rep.name as string) || "منتج", nameEn: (rep.name as string) || "Product" }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

interface FakeTables {
  current_offers: Record<string, unknown>[];
  canonical_products: Record<string, unknown>[];
}

function fakeSupabase(tables: FakeTables, rpcCalls: Record<string, unknown>[][], log: { offerUpserts: Record<string, unknown>[][]; signalUpserts: Record<string, unknown>[][] }) {
  const q = (table: string, rows: Record<string, unknown>[]) => {
    let filtered = rows;
    let from = 0, to = CAP - 1;
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => {}),
      eq: chain((col: string, v: unknown) => { filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === v); }),
      in: chain((col: string, vs: unknown[]) => { const s = new Set(vs); filtered = filtered.filter((r) => s.has((r as Record<string, unknown>)[col])); }),
      order: chain(() => {}),
      range: chain((f: number, t: number) => { from = f; to = t; }),
      upsert: (rows2: Record<string, unknown>[]) => {
        if (table === "tps_current_offers") log.offerUpserts.push(rows2);
        if (table === "tps_price_implausibility_signals") log.signalUpserts.push(rows2);
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
    from: (table: string) => q(table, table === "tps_current_offers" ? tables.current_offers : table === "canonical_products" ? tables.canonical_products : []),
    rpc: (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push([args] as unknown as Record<string, unknown>[]);
      return Promise.resolve({ data: { canonical: (args.p_canonical as unknown[]).length }, error: null });
    },
  };
}

const offerRow = (rawId: number, storeId: number, key: string, price: number, name: string, over: Record<string, unknown> = {}) => ({
  category: "audio", raw_obs_id: rawId, store_id: storeId, identity_key: key, status: "valid",
  price, url: `https://x/p${storeId}`, name, confidence: 90,
  payload: {}, observed_at: new Date(2026, 7, 27).toISOString(), ...over,
});

const newLog = () => ({ offerUpserts: [] as Record<string, unknown>[][], signalUpserts: [] as Record<string, unknown>[][] });

const KEY = "apple|airpods pro 2";

describe("progressive-engine price-transition guard (2026-08-27, P0-B §8.12 follow-up)", () => {
  it("THE EXACT AirPods Pro 2 incident: SAR 1,049 -> SAR 79 (ratio 0.075) is rejected, old price retained, signal written", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    // Prior trusted state: SAR 1,049 already in tps_current_offers for this (key, store).
    const prev = [offerRow(1, 5, KEY, 1049, "Apple Airpods Pro 2")];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-airpods", tps_identity_key: KEY, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [KEY], {
      singleStore: true,
      sweepRows: [offerRow(2, 5, KEY, 79, "Apple Airpods Pro 2", { observed_at: new Date(2026, 7, 30).toISOString() })],
    });
    expect(R.priceTransitionsRejected).toBe(1);
    // tps_current_offers must NOT be overwritten with 79 — the old 1,049 state is retained
    // (no upsert at all for this (key, store) this sweep, since the only candidate was rejected).
    const upsertedOffers = log.offerUpserts.flat();
    expect(upsertedOffers.find((o) => o.store_id === 5)).toBeUndefined();
    // No price_history event for the rejected value.
    const prices = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_prices as Record<string, unknown>[]);
    expect(prices.find((p) => p.price === 79)).toBeUndefined();
    // A reviewable signal was written to the EXISTING tps_price_implausibility_signals table.
    const signals = log.signalUpserts.flat();
    expect(signals.length).toBe(1);
    expect(signals[0].canonical_product_id).toBe("canon-airpods");
    expect(signals[0].observed_price).toBe(79);
    expect(signals[0].plausible_floor).toBe(1049);
    expect(signals[0].source).toBe("price-transition-guard");
  });

  it("does not silently auto-confirm on a second identical low observation (disclosed design: manual review required)", async () => {
    // Two SEPARATE sweeps both offering SAR 79 against a SAR 1,049 prior. Since this guard
    // does not persist a pending value (no schema migration, per the documented design
    // choice), the second sweep sees the exact same prevPrice=1049 and rejects again.
    const log1 = newLog();
    const rpc1: Record<string, unknown>[][] = [];
    const prev = [offerRow(1, 5, KEY, 1049, "Apple Airpods Pro 2")];
    const sb1 = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-airpods", tps_identity_key: KEY, image_url: null }] }, rpc1, log1) as never;
    const R1 = await corroboratePass(sb1, audioDef, [KEY], { singleStore: true, sweepRows: [offerRow(2, 5, KEY, 79, "Apple Airpods Pro 2")] });
    expect(R1.priceTransitionsRejected).toBe(1);

    const log2 = newLog();
    const rpc2: Record<string, unknown>[][] = [];
    // Simulates the NEXT sweep: tps_current_offers still holds the OLD trusted 1,049 (never
    // overwritten by the rejected sweep above).
    const sb2 = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-airpods", tps_identity_key: KEY, image_url: null }] }, rpc2, log2) as never;
    const R2 = await corroboratePass(sb2, audioDef, [KEY], { singleStore: true, sweepRows: [offerRow(3, 5, KEY, 79, "Apple Airpods Pro 2")] });
    expect(R2.priceTransitionsRejected).toBe(1); // rejected again, not auto-confirmed
  });

  it("a legitimate real-world large discount (nutricook air fryer shape, ratio 0.224) is still rejected without corroboration (conservative by design) but does not crash or misbehave", async () => {
    // Production example this audit found: SAR 1,110 -> SAR 249 (ratio 0.224), later
    // corroborated by a SECOND store. This guard intentionally does not auto-confirm
    // (documented design choice) — a human reviews `tps_price_implausibility_signals`.
    // This test pins that the REJECTION path itself behaves correctly for a real
    // legitimate-looking case, not just the malicious-looking AirPods one.
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "nutricook|NA|5.2";
    const prev = [offerRow(1, 3, key, 1110, "Nutricook Air Fryer 5.2L", { category: "air_fryer" })];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-fryer", tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, { ...audioDef, category: "air_fryer" } as unknown as CategoryDef, [key], {
      singleStore: true,
      sweepRows: [offerRow(2, 3, key, 249, "Nutricook Air Fryer 5.2L", { category: "air_fryer" })],
    });
    expect(R.priceTransitionsRejected).toBe(1);
  });

  it("normal price movement (moderate drop, ratio 0.5 = 50% off) is accepted, NOT flagged — genuine promotions must never be blocked", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "sample|widget|1";
    const prev = [offerRow(1, 5, key, 1000, "Widget")];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-w", tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [key], { singleStore: true, sweepRows: [offerRow(2, 5, key, 500, "Widget")] });
    expect(R.priceTransitionsRejected).toBe(0);
    const prices = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_prices as Record<string, unknown>[]);
    expect(prices.length).toBe(1);
    expect(prices[0].price).toBe(500);
  });

  it("normal price increase (ratio 2 = doubled) is accepted, NOT flagged", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "sample|widget|2";
    const prev = [offerRow(1, 5, key, 500, "Widget")];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-w2", tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [key], { singleStore: true, sweepRows: [offerRow(2, 5, key, 1000, "Widget")] });
    expect(R.priceTransitionsRejected).toBe(0);
  });

  it("boundary ratios (exactly 4x and exactly 0.25x) are accepted, not flagged (inclusive bound, matches assessPriceTransition's own contract)", async () => {
    for (const [prior, next] of [[100, 400], [400, 100]]) {
      const log = newLog();
      const rpcCalls: Record<string, unknown>[][] = [];
      const key = `sample|boundary|${prior}-${next}`;
      const prev = [offerRow(1, 5, key, prior, "Boundary Widget")];
      const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: `canon-${prior}`, tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
      const R = await corroboratePass(sb, audioDef, [key], { singleStore: true, sweepRows: [offerRow(2, 5, key, next, "Boundary Widget")] });
      expect(R.priceTransitionsRejected).toBe(0);
    }
  });

  it("extreme upward transition (ratio 10x) is rejected the same as extreme downward", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "sample|spike|1";
    const prev = [offerRow(1, 5, key, 29, "Cheap Accessory")];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-spike", tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [key], { singleStore: true, sweepRows: [offerRow(2, 5, key, 749, "Cheap Accessory")] });
    expect(R.priceTransitionsRejected).toBe(1);
  });

  it("a first-ever observation for a (key, store) with no prior price is always accepted (nothing to compare against)", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "sample|new|1";
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [key], { singleStore: true, sweepRows: [offerRow(1, 5, key, 5, "Brand New Listing")] });
    expect(R.priceTransitionsRejected).toBe(0);
  });

  it("one store's implausible price does not block the OTHER store's credible price in a multi-store canonical", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const key = "multi|store|item";
    const prev = [
      offerRow(1, 5, key, 900, "Multi Store Item"),
      offerRow(2, 13, key, 950, "Multi Store Item"),
    ];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-multi", tps_identity_key: key, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [key], {
      sweepRows: [
        offerRow(3, 5, key, 60, "Multi Store Item", { observed_at: new Date(2026, 7, 28).toISOString() }),   // implausible, store 5
        offerRow(4, 13, key, 899, "Multi Store Item", { observed_at: new Date(2026, 7, 28).toISOString() }), // credible, store 13
      ],
    });
    expect(R.priceTransitionsRejected).toBe(1);
    expect(R.corroborated).toBe(1); // still 2-store comparable — store 5's OLD trusted 900 + store 13's new 899
    const canonicals = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_canonical as Record<string, unknown>[]);
    expect(canonicals.length).toBe(1);
  });

  it("dry mode computes rejections without writing anything", async () => {
    const log = newLog();
    const rpcCalls: Record<string, unknown>[][] = [];
    const prev = [offerRow(1, 5, KEY, 1049, "Apple Airpods Pro 2")];
    const sb = fakeSupabase({ current_offers: prev, canonical_products: [{ id: "canon-airpods", tps_identity_key: KEY, image_url: null }] }, rpcCalls, log) as never;
    const R = await corroboratePass(sb, audioDef, [KEY], { singleStore: true, dry: true, sweepRows: [offerRow(2, 5, KEY, 79, "Apple Airpods Pro 2")] });
    expect(R.priceTransitionsRejected).toBe(1);
    expect(rpcCalls.length).toBe(0);
    expect(log.offerUpserts.length).toBe(0);
    expect(log.signalUpserts.length).toBe(0);
  });
});
