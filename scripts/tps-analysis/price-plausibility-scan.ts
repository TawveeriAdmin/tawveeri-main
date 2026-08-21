// scripts/tps-analysis/price-plausibility-scan.ts
// ─────────────────────────────────────────────────────────────────────────────
// P7 (2026-08-21) — a price-PLAUSIBILITY check, distinct from
// price-truth-gate.ts's price-TRANSITION check (which needs a prior price for
// the SAME listing to compare against). A price can be wrong from its very
// first observation, with nothing to diff against — measured: 8+ Extra vacuum
// listings (Fisher/Princess/Sencor/ClassPro/Panasonic), all single-store, all
// from the same scrape batch, each far cheaper than any real product of its own
// brand/wattage.
//
// METHOD, data-derived, never a hardcoded SAR figure (Constitution: never
// fabricate):
//   - For canonicals with a NUMERIC capacity (the appliance-factory 3rd key
//     segment, e.g. wattage), compute price-per-capacity category-wide and flag
//     any (canonical, store) whose price/capacity sits below 25% of the
//     category's own median price/capacity — a >=4x deviation.
//   - For capacity-less canonicals (`brand|type|NA`), pooling every TYPE
//     together is wrong (a robot vacuum's real price floor is nothing like a
//     handheld's) — so the reference cohort is the SAME type only, median
//     computed within it, flagged below 33% of that type's own median (>=3x).
//     A cohort under 3 members is too small to trust a median from and is
//     skipped, never flagged.
//
// Writes to tps_price_implausibility_signals (029_price_implausibility_signals.sql),
// read by the projection builder as an exclusion — mirrors tps_offer_delist_signals
// exactly. Self-healing: a (canonical, store) pair no longer implausible on a
// later run has its signal deleted automatically.
//
// Usage: npx tsx scripts/tps-analysis/price-plausibility-scan.ts --category=vacuum [--apply]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { assertFingerprint } from "../tps-core/tps-batch";

const APPLY = process.argv.includes("--apply");
const catArg = process.argv.find((a) => a.startsWith("--category="));
if (!catArg) { console.error("missing --category=<cat>"); process.exit(1); }
const CATEGORY = catArg.split("=")[1];

const CAPACITY_RATIO = 4;   // flag below 1/4 of the category-wide price/capacity median
const TYPE_RATIO = 3;       // flag below 1/3 of the same-type price median
const MIN_TYPE_COHORT = 3;  // a smaller same-type cohort's median is not trustworthy

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // One row per (canonical, store) with its LATEST price — the same granularity
  // tps_offer_delist_signals and the projection builder both operate at.
  const { rows } = await pg.query(`
    select c.id::text canonical_id, c.tps_identity_key,
           latest.store_name, latest.price
    from canonical_products c
    join lateral (
      select distinct on (ph.store_name) ph.store_name, ph.price
      from price_history ph
      where ph.canonical_product_id = c.id and ph.price > 0
      order by ph.store_name, ph.observed_at desc
    ) latest on true
    where c.category = $1 and c.is_active
  `, [CATEGORY]);

  console.log(`${rows.length} (canonical, store) price rows in category=${CATEGORY}`);

  const withCap: { canonicalId: string; key: string; store: string; price: number; ppw: number }[] = [];
  const byType = new Map<string, { canonicalId: string; key: string; store: string; price: number }[]>();

  for (const r of rows) {
    const parts = r.tps_identity_key.split("|");
    const cap = parts[2];
    const price = Number(r.price);
    if (cap && cap !== "NA" && /^\d+(\.\d+)?$/.test(cap) && Number(cap) > 0) {
      withCap.push({ canonicalId: r.canonical_id, key: r.tps_identity_key, store: r.store_name, price, ppw: price / Number(cap) });
    } else {
      const type = parts[1] ?? "NA";
      const list = byType.get(type) ?? [];
      list.push({ canonicalId: r.canonical_id, key: r.tps_identity_key, store: r.store_name, price });
      byType.set(type, list);
    }
  }

  const flagged: { canonicalId: string; key: string; store: string; price: number; floor: number; reason: string }[] = [];

  if (withCap.length >= MIN_TYPE_COHORT) {
    const med = median(withCap.map((x) => x.ppw));
    const floor = med / CAPACITY_RATIO;
    console.log(`capacity-bearing cohort: n=${withCap.length}, price/capacity median=${med.toFixed(4)}, floor=${floor.toFixed(4)}`);
    for (const x of withCap) {
      if (x.ppw < floor) flagged.push({ canonicalId: x.canonicalId, key: x.key, store: x.store, price: x.price, floor: parseFloat((floor * Number(x.key.split("|")[2])).toFixed(2)), reason: `price/capacity ${x.ppw.toFixed(4)} < 25% of category median ${med.toFixed(4)}` });
    }
  }

  for (const [type, list] of byType) {
    if (list.length < MIN_TYPE_COHORT) { console.log(`type=${type}: n=${list.length} — too small a cohort, skipped`); continue; }
    const med = median(list.map((x) => x.price));
    const floor = med / TYPE_RATIO;
    console.log(`type=${type} cohort: n=${list.length}, price median=${med.toFixed(2)}, floor=${floor.toFixed(2)}`);
    for (const x of list) {
      if (x.price < floor) flagged.push({ canonicalId: x.canonicalId, key: x.key, store: x.store, price: x.price, floor: parseFloat(floor.toFixed(2)), reason: `price ${x.price} < 33% of same-type (${type}) median ${med.toFixed(2)}` });
    }
  }

  console.log(`\n${flagged.length} (canonical, store) pairs flagged as price-implausible:`);
  flagged.forEach((f) => console.log(`  ${f.key.padEnd(30)} store=${f.store.padEnd(10)} price=${f.price}  floor=${f.floor}  ${f.reason}`));

  if (!APPLY) { console.log("\n--dry (default): not writing. Pass --apply to write signals."); await pg.end(); return; }

  let written = 0;
  for (const f of flagged) {
    await pg.query(
      `insert into tps_price_implausibility_signals (canonical_product_id, store_display_name, observed_price, plausible_floor, reason)
       values ($1, $2, $3, $4, $5)
       on conflict (canonical_product_id, store_display_name) do update set
         observed_price = excluded.observed_price, plausible_floor = excluded.plausible_floor,
         reason = excluded.reason, detected_at = now()`,
      [f.canonicalId, f.store, f.price, f.floor, f.reason]
    );
    written++;
  }
  console.log(`wrote/updated ${written} signals`);

  // Heal: a previously-flagged pair in THIS category that is no longer in the
  // current flagged set is no longer implausible (or its offer is gone/re-priced) —
  // remove the signal so the projection builder stops excluding it.
  const flaggedKeys = new Set(flagged.map((f) => `${f.canonicalId}|${f.store}`));
  const { rows: existing } = await pg.query(
    `select s.canonical_product_id::text cid, s.store_display_name sdn
     from tps_price_implausibility_signals s
     join canonical_products c on c.id = s.canonical_product_id
     where c.category = $1`,
    [CATEGORY]
  );
  let healed = 0;
  for (const e of existing) {
    if (!flaggedKeys.has(`${e.cid}|${e.sdn}`)) {
      await pg.query(`delete from tps_price_implausibility_signals where canonical_product_id = $1 and store_display_name = $2`, [e.cid, e.sdn]);
      healed++;
    }
  }
  console.log(`healed (removed) ${healed} stale signals`);

  await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
