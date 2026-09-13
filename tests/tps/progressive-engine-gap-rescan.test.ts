// ADR-351 (2026-09-13, Samsung KSA durable-staging closure mission). Measured, live: ~95
// Samsung raw_observations rows were never staged in any category despite the store's
// `tps_progress_cursors` watermark already sitting at the exact max id for that store — proof
// that `raw_observations.id` (a real Postgres `GENERATED ALWAYS AS IDENTITY` sequence) can
// have transactions commit out of id order under concurrent writers, and the old
// "cursor = MAX(id) seen this batch, never look back" logic permanently strands any row whose
// commit becomes visible only after a higher-id row's commit already advanced the cursor past it.
//
// Fix under test: `normalizeSweep` now ALSO re-scans a small trailing window immediately
// BEHIND the cursor on every real (non-dry) sweep, for any raw_observations row with no
// staging row in ANY category at all, and stages it — self-healing the gap without needing to
// guess a "safe" time delay, and without ever moving the cursor backward or skipping it forward
// past where the forward fetch itself established is safe.
import { normalizeSweep } from "../../scripts/tps-core/progressive-engine";
import type { CategoryDef } from "../../scripts/tps-core/category-registry";

const def = {
  category: "monitor", detected: "monitor", version: "test-v1",
  requireValidTier: true, priceBand: null,
  plugin: {
    detect: (_ar: string, en: string) => /monitor/i.test(en),
    buildIdentityKey: (brand: string | null, p: Record<string, unknown>) => ({
      key: `${brand}|${p.title}`, status: "valid" as const, reason: "test",
    }),
    scoreConfidence: () => ({ confidence: 90 }),
  },
  normalize: (_ar: string, en: string, brand: string | null) => ({
    model_number: null, color: null, payload: { title: en }, ignored_terms: [], ambiguity_flags: [],
  }),
  names: () => ({ nameAr: "منتج", nameEn: "Product" }),
  attrs: () => ({}),
  canonSeed: (key: string) => `canon:${key}`,
  normSeed: (obsId: number) => `norm:${obsId}`,
} as unknown as CategoryDef;

const SAMSUNG_STORE = 6; // present in TPS_STORES

interface RawRow { id: number; store_id: number; raw_name: string | null; payload: Record<string, unknown>; scraped_at: string | null; }

function fakeSupabase(opts: {
  cursor: number;
  rawRows: RawRow[]; // ALL raw_observations rows for the Samsung store (superset — includes ones "behind" the cursor)
  stagedRawObsIds: Set<number>; // ids that already have a tps_identity_staging row
}) {
  const cursorUpserts: Record<string, unknown>[] = [];
  const stagingUpserts: Record<string, unknown>[] = [];
  let cursorVal = opts.cursor;

  const rawObservationsQuery = () => {
    let filtered = opts.rawRows;
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    let limitN = Infinity;
    Object.assign(b, {
      select: chain(() => {}),
      eq: chain((col: string, v: unknown) => { filtered = filtered.filter((r) => (r as unknown as Record<string, unknown>)[col] === v); }),
      gt: chain((col: string, v: number) => { filtered = filtered.filter((r) => (r as unknown as Record<string, number>)[col] > v); }),
      lte: chain((col: string, v: number) => { filtered = filtered.filter((r) => (r as unknown as Record<string, number>)[col] <= v); }),
      order: chain(() => { filtered = [...filtered].sort((a, b2) => a.id - b2.id); }),
      limit: chain((n: number) => { limitN = n; }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: filtered.slice(0, limitN), error: null }),
    });
    return b;
  };

  const stagingQuery = () => {
    let ids: number[] = [];
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => {}),
      in: chain((_col: string, vs: number[]) => { ids = vs; }),
      upsert: (rows: Record<string, unknown>[]) => {
        stagingUpserts.push(...rows);
        for (const r of rows) opts.stagedRawObsIds.add((r as { raw_obs_id: number }).raw_obs_id);
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: ids.filter((i) => opts.stagedRawObsIds.has(i)).map((raw_obs_id) => ({ raw_obs_id })), error: null }),
    });
    return b;
  };

  const cursorsQuery = () => {
    const b: Record<string, unknown> = {};
    const chain = (fn: (...a: never[]) => void) => (...a: never[]) => { fn(...a); return b; };
    Object.assign(b, {
      select: chain(() => {}),
      eq: chain(() => {}),
      upsert: (row: Record<string, unknown>) => { cursorUpserts.push(row); cursorVal = row.last_raw_id as number; return Promise.resolve({ data: null, error: null }); },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [{ store_id: SAMSUNG_STORE, last_raw_id: cursorVal }], error: null }),
    });
    return b;
  };

  const sb = {
    from: (table: string) => {
      if (table === "raw_observations") return rawObservationsQuery();
      if (table === "tps_identity_staging") return stagingQuery();
      if (table === "tps_progress_cursors") return cursorsQuery();
      throw new Error(`unexpected table in test fake: ${table}`);
    },
  };
  return { sb: sb as never, cursorUpserts, stagingUpserts };
}

describe("normalizeSweep — trailing gap re-scan (ADR-351)", () => {
  it("recovers a row already BEHIND the cursor that was never staged in any category", async () => {
    // Cursor already sits at 105 (believes it is fully caught up). Row 100 exists, is a real
    // monitor, but has NO staging row at all — the exact stranded-row shape found in production.
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Smart Monitor M5", payload: { name_en: "Samsung Smart Monitor M5" }, scraped_at: "2026-09-01T00:00:00Z" },
      { id: 101, store_id: SAMSUNG_STORE, raw_name: "Samsung Galaxy Tab", payload: { name_en: "Samsung Galaxy Tab" }, scraped_at: "2026-09-01T00:00:01Z" },
    ];
    const { sb, stagingUpserts, cursorUpserts } = fakeSupabase({
      cursor: 105, rawRows, stagedRawObsIds: new Set([101]), // 100 is the stranded gap; 101 was correctly (not) staged already (tablet, no monitor match anyway)
    });
    const m = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m.gapRecovered).toBe(1);
    const staged = stagingUpserts.find((r) => r.raw_obs_id === 100);
    expect(staged).toBeDefined();
    expect(staged?.category).toBe("monitor");
    // The gap row must never move the cursor FORWARD — it's already behind it. A same-value
    // idempotent cursor re-write is fine (harmless, keeps updated_at fresh); what matters is
    // the value never regresses and never jumps past what the forward fetch itself established.
    expect(cursorUpserts.length).toBe(1);
    expect(cursorUpserts[0].last_raw_id).toBe(105);
  });

  it("does not re-stage a row already correctly staged (no duplicate work reported as recovered)", async () => {
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Smart Monitor M5", payload: { name_en: "Samsung Smart Monitor M5" }, scraped_at: "2026-09-01T00:00:00Z" },
    ];
    const { sb } = fakeSupabase({ cursor: 105, rawRows, stagedRawObsIds: new Set([100]) });
    const m = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m.gapRecovered).toBe(0);
  });

  it("a genuinely undetected row (no plugin matches) is reprocessed harmlessly but NOT counted as recovered — it never had a real gap, and would otherwise falsely alarm on every future sweep forever", async () => {
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Fridge", payload: { name_en: "Samsung Fridge" }, scraped_at: "2026-09-01T00:00:00Z" },
    ];
    const { sb, stagingUpserts } = fakeSupabase({ cursor: 105, rawRows, stagedRawObsIds: new Set() });
    const m = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m.gapRecovered).toBe(0); // re-examined, but produced no staging row — not a fix, just correct re-confirmation
    expect(stagingUpserts.find((r) => r.raw_obs_id === 100)).toBeUndefined();
  });

  it("dry mode never performs the gap re-scan (writes nothing, per the existing dry-run invariant)", async () => {
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Smart Monitor M5", payload: { name_en: "Samsung Smart Monitor M5" }, scraped_at: "2026-09-01T00:00:00Z" },
    ];
    const { sb, stagingUpserts, cursorUpserts } = fakeSupabase({ cursor: 105, rawRows, stagedRawObsIds: new Set() });
    const m = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE], true /* dry */);
    expect(m.gapRecovered ?? 0).toBe(0);
    expect(stagingUpserts.length).toBe(0);
    expect(cursorUpserts.length).toBe(0);
  });

  it("converges: a second sweep after the fix reports zero recovered — proves this isn't a perpetual false-alarm loop", async () => {
    // This is the exact shape of the production bug found while validating this fix: the
    // first live run correctly reported real recoveries, but a naive "count every gap row
    // examined" metric kept reporting the SAME nonzero count on every subsequent run forever,
    // because legitimately-undetected rows are (correctly) re-examined every sweep. Fixed by
    // only counting a row once it actually produces a staging row.
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Smart Monitor M5", payload: { name_en: "Samsung Smart Monitor M5" }, scraped_at: "2026-09-01T00:00:00Z" }, // real gap
      { id: 101, store_id: SAMSUNG_STORE, raw_name: "Samsung Fridge", payload: { name_en: "Samsung Fridge" }, scraped_at: "2026-09-01T00:00:01Z" }, // legitimately never detected
    ];
    const { sb } = fakeSupabase({ cursor: 105, rawRows, stagedRawObsIds: new Set() });
    const m1 = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m1.gapRecovered).toBe(1); // only the real monitor gap, not the fridge
    const m2 = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m2.gapRecovered).toBe(0); // converged — the monitor is now staged, the fridge is correctly never counted
  });

  it("forward sweep + gap recovery both work in the same pass without interfering", async () => {
    const rawRows: RawRow[] = [
      { id: 100, store_id: SAMSUNG_STORE, raw_name: "Samsung Smart Monitor M5", payload: { name_en: "Samsung Smart Monitor M5" }, scraped_at: "2026-09-01T00:00:00Z" }, // stranded gap
      { id: 200, store_id: SAMSUNG_STORE, raw_name: "Samsung Odyssey Monitor", payload: { name_en: "Samsung Odyssey Monitor" }, scraped_at: "2026-09-12T00:00:00Z" }, // new, ahead of cursor
    ];
    const { sb, stagingUpserts, cursorUpserts } = fakeSupabase({ cursor: 105, rawRows, stagedRawObsIds: new Set() });
    const m = await normalizeSweep(sb, [def], 500, [SAMSUNG_STORE]);
    expect(m.gapRecovered).toBe(1);
    expect(stagingUpserts.map((r) => r.raw_obs_id).sort()).toEqual([100, 200]);
    expect(cursorUpserts[0].last_raw_id).toBe(200); // cursor advances to the forward fetch's max, unaffected by the gap row
  });
});
