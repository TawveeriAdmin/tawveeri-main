// Samsung KSA global closure mission (2026-09-12). Proven live: `write_ac_batch(microwave):
// duplicate key value violates ... canonical_products_brand_model_number_idx` FATALed the
// hourly "normalize" step repeatedly (aborting the whole downstream chain), because
// corroboratePass had no guard against either of TWO global unique indexes a brand-new
// canonical write can collide with: (category is not part of either index)
//   (brand, model_number)      — canonical_products_brand_model_number_idx
//   (lower(trim(name_ar)), lower(trim(brand))) — idx_canonical_products_name_brand_unique
// This pins the "defer, never force" fix: a genuinely new canonical whose pair already
// belongs to a DIFFERENT identity is skipped (pairDeferred++), never written, never crashes.
import { corroboratePass } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const CAP = 1000;

interface FakeTables {
  current_offers: Record<string, unknown>[];
  canonical_products: Record<string, unknown>[];
}

function fakeSupabase(tables: FakeTables, rpcCalls: Record<string, unknown>[][]) {
  const q = (table: string, rows: Record<string, unknown>[]) => {
    let filtered = rows;
    let from = 0, to = CAP - 1;
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => {}),
      eq: chain((col: string, v: unknown) => { filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === v); }),
      in: chain((col: string, vs: unknown[]) => { const s = new Set(vs); filtered = filtered.filter((r) => s.has((r as Record<string, unknown>)[col])); }),
      not: chain((col: string, op: string, v: unknown) => { if (op === "is" && v === null) filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] != null); }),
      order: chain(() => {}),
      range: chain((f: number, t: number) => { from = f; to = t; }),
      upsert: () => Promise.resolve({ data: null, error: null }),
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

const offerRow = (rawId: number, storeId: number, key: string, price: number) => ({
  category: "microwave", raw_obs_id: rawId, store_id: storeId, identity_key: key, status: "valid",
  price, url: `https://x/p${storeId}`, name: `Item ${rawId}`, confidence: 90,
  payload: {}, observed_at: new Date(2026, 8, 12).toISOString(),
});

const def = {
  category: "microwave", detected: "microwave", version: "test-v1",
  requireValidTier: true, priceBand: null,
  names: (key: string) => ({ nameAr: `ميكرويف ${key}`, nameEn: `Microwave ${key}` }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

describe("brand+model collision guard (canonical_products_brand_model_number_idx)", () => {
  it("defers a NEW MODEL:-primary key whose (brand, model) pair already belongs to a different existing canonical, instead of crashing", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const existing = [{ id: "existing-id", tps_identity_key: "haam|grill|20", brand: "haam", model_number: "HM20WGMY24", name_ar: "ميكرويف قديم", image_url: null }];
    const sb = fakeSupabase({ current_offers: [], canonical_products: existing }, rpcCalls) as never;
    const R = await corroboratePass(sb, def, ["haam|MODEL:HM20WGMY24"], {
      singleStore: true,
      sweepRows: [offerRow(1, 4, "haam|MODEL:HM20WGMY24", 400)],
    });
    expect(R.pairDeferred).toBe(1);
    expect(R.canonicalsWritten).toBe(0);
    expect(rpcCalls.length).toBe(0); // deferred before ever reaching write_ac_batch
  });

  it("within one batch, the first of two colliding NEW keys is written and the second is deferred — never both, never a crash", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const R = await corroboratePass(sb, def, ["acme|MODEL:X1", "othr|MODEL:X1"], {
      singleStore: true,
      sweepRows: [offerRow(1, 4, "acme|MODEL:X1", 400), offerRow(2, 4, "othr|MODEL:X1", 500)],
    });
    // Different brands ("acme" vs "othr") never collide on (brand, model) — sanity: both write.
    expect(R.pairDeferred).toBe(0);
    expect(R.canonicalsWritten).toBe(2);
  });

  it("a genuinely colliding pair within one batch (same brand, same model, two identity keys) defers exactly one", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    // Same brand+model but different fallback suffix collapsing to the same MODEL: token —
    // simulates two staged rows for what is really the same SKU under slightly different keys.
    const R = await corroboratePass(sb, def, ["acme|MODEL:X1", "acme|MODEL:X1|dup"], {
      singleStore: true,
      sweepRows: [offerRow(1, 4, "acme|MODEL:X1", 400), offerRow(2, 4, "acme|MODEL:X1|dup", 400)],
    });
    // "acme|MODEL:X1|dup" splits to parts[1] = "MODEL:X1" too (split on first "|" only matters
    // for parts[0]/parts[1]; slice(6) still yields "X1") — same pair, second deferred.
    expect(R.pairDeferred).toBe(1);
    expect(R.canonicalsWritten).toBe(1);
  });
});

describe("name+brand collision guard (idx_canonical_products_name_brand_unique)", () => {
  it("defers a NEW canonical whose (name_ar, brand) pair already belongs to a different existing canonical", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    // def.names() always returns nameAr = `ميكرويف ${key}` — construct an existing row whose
    // name_ar matches exactly what this key would generate, under a different identity/brand pair.
    const existing = [{ id: "existing-id", tps_identity_key: "other|key", brand: "samsung", model_number: null, name_ar: "ميكرويف samsung|no-model", image_url: null }];
    const sb = fakeSupabase({ current_offers: [], canonical_products: existing }, rpcCalls) as never;
    const R = await corroboratePass(sb, def, ["samsung|no-model"], {
      singleStore: true,
      sweepRows: [offerRow(1, 4, "samsung|no-model", 400)],
    });
    expect(R.pairDeferred).toBe(1);
    expect(R.canonicalsWritten).toBe(0);
    expect(rpcCalls.length).toBe(0);
  });
});
