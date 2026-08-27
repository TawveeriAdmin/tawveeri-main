// Quality program P0-B (2026-08-27) — the AirPods Pro 2 SAR-79 incident.
//
// Root cause: a Baykron "Airpods Pro 2nd Gen Silicone Case" (an accessory, real price
// ~SAR 79) was staged under the SAME identity_key as the real Apple AirPods Pro 2
// (~SAR 899), because the audio brand/model extractor trusted the title's mention of
// "Apple AirPods Pro 2" without checking whether the listing itself IS an accessory. The
// accessory's much-lower price then corrupted the canonical's price and store_count.
//
// This suite proves `corroboratePass` now excludes accessory-only offers from an audio
// identity_key's evidence BEFORE they can contribute to store_count, price, or the
// representative name/image — reusing `isAccessoryOnlyAudioTitle`
// (`src/lib/scraping/utils/category-utils.ts`), the same guard validated against the
// real production audio catalog (898 storefront rows, 326 live tps_current_offers rows,
// zero false positives on genuine earbuds/headphones/microphones that legitimately
// mention a bundled case).
import { corroboratePass } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const CAP = 1000;

const audioDef = {
  category: "audio", detected: "audio", version: "test-v1",
  requireValidTier: true, priceBand: 1.5,
  names: (_key: string, rep: Record<string, unknown>) => ({
    nameAr: (rep.name as string) || "منتج", nameEn: (rep.name as string) || "Product",
  }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

const tvDef = { ...audioDef, category: "tv", detected: "tv", priceBand: null } as unknown as CategoryDef;

interface FakeTables {
  current_offers: Record<string, unknown>[];
  canonical_products: Record<string, unknown>[];
}

function fakeSupabase(tables: FakeTables, rpcCalls: Record<string, unknown>[][]) {
  const q = (rows: Record<string, unknown>[]) => {
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
      upsert: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
        const span = Math.min(to - from + 1, CAP);
        resolve({ data: filtered.slice(from, from + span), error: null });
      },
    });
    return b;
  };
  return {
    from: (table: string) => q(table === "tps_current_offers" ? tables.current_offers : table === "canonical_products" ? tables.canonical_products : []),
    rpc: (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push([args] as unknown as Record<string, unknown>[]);
      return Promise.resolve({ data: { canonical: (args.p_canonical as unknown[]).length }, error: null });
    },
  };
}

const offerRow = (rawId: number, storeId: number, key: string, price: number, name: string, over: Record<string, unknown> = {}) => ({
  category: (over.category as string | undefined) ?? "audio", raw_obs_id: rawId, store_id: storeId, identity_key: key, status: "valid",
  price, url: `https://x/p${storeId}`, name, confidence: 90,
  payload: { name }, observed_at: new Date(2026, 7, 27).toISOString(), ...over,
});

const KEY = "apple|airpods pro 2";
const BAYKRON_EN = "Baykron Airpods Pro 2nd Gen Silicone Case - Black";
const BAYKRON_AR = "بايكرون,  كفرايربودز برو الجيل الثاني  , أحمر";
const GENUINE_EN = "Apple AirPods Pro 2 Wireless Earbuds, Active Noise Cancellation, MagSafe Charging Case";

describe("progressive-engine accessory-contamination guard (2026-08-27, P0-B)", () => {
  it("excludes a pure-accessory offer from store_count: 1 real store + 1 accessory store does NOT corroborate as 2-store comparable", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const sweepRows = [
      offerRow(1, 5, KEY, 79, BAYKRON_EN),     // المنيع — the accessory (THE BUG)
      offerRow(2, 13, KEY, 899, GENUINE_EN),   // محزم — the real product
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows });
    // Only ONE genuine store remains after the accessory is filtered out — this must NOT
    // be treated as a 2-store comparable canonical.
    expect(R.corroborated).toBe(0);
    expect(R.singleStore).toBe(1);
    expect(rpcCalls.length).toBe(0); // multi-store pass writes nothing for a single-store key
  });

  it("a genuine single real offer still writes correctly via the singleStore pass, price/name never contaminated by the accessory", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const sweepRows = [
      offerRow(1, 5, KEY, 79, BAYKRON_EN),
      offerRow(2, 13, KEY, 899, GENUINE_EN),
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows, singleStore: true });
    expect(R.singleStore).toBe(1);
    const canonicals = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_canonical as Record<string, unknown>[]);
    expect(canonicals.length).toBe(1);
    expect(canonicals[0].name_en).toBe(GENUINE_EN); // representative offer is the genuine one, never Baykron's
    const prices = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_prices as Record<string, unknown>[]);
    expect(prices.length).toBe(1);
    expect(prices[0].price).toBe(899); // never the accessory's SAR 79
  });

  it("Arabic accessory title (fused كفر compound) is also excluded", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const sweepRows = [
      offerRow(1, 5, KEY, 79, BAYKRON_AR),
      offerRow(2, 13, KEY, 899, GENUINE_EN),
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows });
    expect(R.corroborated).toBe(0);
    expect(R.singleStore).toBe(1);
  });

  it("two GENUINE stores, both legitimately mentioning a bundled case, still corroborate normally (no over-correction)", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const genuine2 = "Apple AirPods Pro 2 Earbuds, MagSafe Charging Case, USB-C, White";
    const sweepRows = [
      offerRow(1, 5, KEY, 899, GENUINE_EN),
      offerRow(2, 13, KEY, 875, genuine2),
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows });
    expect(R.corroborated).toBe(1);
    expect(R.singleStore).toBe(0);
    const canonicals = rpcCalls.flatMap((c) => (c[0] as Record<string, unknown>).p_canonical as Record<string, unknown>[]);
    expect(canonicals.length).toBe(1);
  });

  it("a genuine ambiguous Arabic listing (product name before the accessory word) is NOT excluded", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const ambiguousGenuine = "سماعات AirPods Pro الجيل الثاني مع حافظة MagSafe من النوع C باللون الأبيض";
    const sweepRows = [
      offerRow(1, 5, KEY, 899, ambiguousGenuine),
      offerRow(2, 13, KEY, 875, GENUINE_EN),
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows });
    expect(R.corroborated).toBe(1); // both stores count — neither was wrongly excluded
  });

  it("does NOT apply the accessory guard to a non-audio category (scope discipline)", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const key = "samsung|55|tv";
    // A TV listing whose title happens to say "case" for some unrelated reason (e.g. a
    // carrying case bundled with a portable TV) must NOT be excluded by an audio-only guard.
    const sweepRows = [
      offerRow(1, 5, key, 1200, "Samsung 55 inch TV with Travel Case", { category: "tv" }),
      offerRow(2, 13, key, 1250, "Samsung 55 inch Smart TV 4K", { category: "tv" }),
    ];
    const R = await corroboratePass(sb, tvDef, [key], { sweepRows });
    expect(R.corroborated).toBe(1); // both stores count — the audio-only guard never ran
  });

  it("dry mode still computes the guard's effect without writing", async () => {
    const rpcCalls: Record<string, unknown>[][] = [];
    const sb = fakeSupabase({ current_offers: [], canonical_products: [] }, rpcCalls) as never;
    const sweepRows = [
      offerRow(1, 5, KEY, 79, BAYKRON_EN),
      offerRow(2, 13, KEY, 899, GENUINE_EN),
    ];
    const R = await corroboratePass(sb, audioDef, [KEY], { sweepRows, singleStore: true, dry: true });
    expect(R.singleStore).toBe(1);
    expect(rpcCalls.length).toBe(0);
  });
});
