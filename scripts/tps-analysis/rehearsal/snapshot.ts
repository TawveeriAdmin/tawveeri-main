// scripts/tps-analysis/rehearsal/snapshot.ts — row counts + content hashes of the LOCAL replica so two states can be diffed.
//
//   npx tsx scripts/tps-analysis/rehearsal/snapshot.ts                      # print table
//   npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --out before.json    # also save
//   npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --diff before.json after.json
//   npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --all-tables         # include every replicated table
//
// Two hashes per table:
//   full_hash     md5 over every column of every row (ordered by the stable key)
//   content_hash  same but with VOLATILE columns removed (surrogate identity ids and write-time stamps that a
//                 re-run legitimately rewrites: price_history.id, product_matches.id/matched_at,
//                 canonical_products.data_updated_at, tps_current_offers.updated_at, ...). Equal content_hash with a
//                 different full_hash = "same facts, only bookkeeping moved".
import * as fs from "node:fs";
import { localClient } from "./lib";

const TABLES: { name: string; order: string; volatile: string[]; core: boolean }[] = [
  { name: "canonical_products", order: "id", volatile: ["data_updated_at"], core: true },
  { name: "tps_current_offers", order: "category, identity_key, store_id", volatile: ["updated_at"], core: true },
  { name: "price_history", order: "canonical_product_id, store_id, observed_at, price, tps_observation_id, id", volatile: ["id"], core: true },
  { name: "normalized_product_observations", order: "id", volatile: [], core: true },
  { name: "product_matches", order: "raw_observation_id, canonical_product_id", volatile: ["id", "matched_at"], core: true },
  { name: "tps_identity_staging", order: "category, raw_obs_id", volatile: [], core: false },
  { name: "tps_progress_cursors", order: "category, store_id", volatile: ["updated_at"], core: false },
  { name: "tps_price_implausibility_signals", order: "canonical_product_id, store_display_name", volatile: ["detected_at"], core: false },
  { name: "tps_product_projection", order: "id", volatile: [], core: false },
  { name: "raw_observations", order: "id", volatile: [], core: false },
  { name: "stores", order: "id", volatile: [], core: false },
];

interface Snap { takenAt: string; tables: Record<string, { rows: number; full_hash: string; content_hash: string }> }

async function take(all: boolean): Promise<Snap> {
  const c = await localClient();
  const snap: Snap = { takenAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    if (!t.core && !all) continue;
    const vol = t.volatile.length ? ` - ARRAY[${t.volatile.map((v) => `'${v}'`).join(",")}]::text[]` : "";
    const r = await c.query(
      `select count(*)::int n,
              coalesce(md5(string_agg(md5(to_jsonb(x)::text), '' order by ${t.order.split(",").map((s) => "x." + s.trim()).join(", ")})), md5('')) full_hash,
              coalesce(md5(string_agg(md5((to_jsonb(x)${vol})::text), '' order by ${t.order.split(",").map((s) => "x." + s.trim()).join(", ")})), md5('')) content_hash
         from public.${t.name} x`);
    snap.tables[t.name] = { rows: r.rows[0].n, full_hash: r.rows[0].full_hash, content_hash: r.rows[0].content_hash };
  }
  await c.end();
  return snap;
}

function print(s: Snap) {
  console.log(`snapshot ${s.takenAt}`);
  console.log("table".padEnd(36), "rows".padStart(9), "full_hash".padEnd(34), "content_hash");
  for (const [k, v] of Object.entries(s.tables)) console.log(k.padEnd(36), String(v.rows).padStart(9), v.full_hash.padEnd(34), v.content_hash);
}

function diff(a: Snap, b: Snap) {
  console.log("table".padEnd(36), "rows A -> B".padEnd(20), "full_hash", "content_hash");
  let changed = 0;
  for (const k of Object.keys({ ...a.tables, ...b.tables })) {
    const x = a.tables[k], y = b.tables[k];
    if (!x || !y) { console.log(k.padEnd(36), "(missing in one snapshot)"); continue; }
    const rows = x.rows === y.rows ? `${x.rows} (=)` : `${x.rows} -> ${y.rows} (${y.rows - x.rows >= 0 ? "+" : ""}${y.rows - x.rows})`;
    const fh = x.full_hash === y.full_hash ? "same" : "CHANGED", ch = x.content_hash === y.content_hash ? "same" : "CHANGED";
    if (fh !== "same" || ch !== "same" || x.rows !== y.rows) changed++;
    console.log(k.padEnd(36), rows.padEnd(20), fh.padEnd(9), ch);
  }
  console.log(changed ? `${changed} table(s) differ` : "ALL TABLES IDENTICAL");
}

async function main() {
  const av = process.argv.slice(2);
  const di = av.indexOf("--diff");
  if (di >= 0) { diff(JSON.parse(fs.readFileSync(av[di + 1], "utf8")), JSON.parse(fs.readFileSync(av[di + 2], "utf8"))); return; }
  const s = await take(av.includes("--all-tables"));
  print(s);
  const oi = av.indexOf("--out");
  if (oi >= 0) fs.writeFileSync(av[oi + 1], JSON.stringify(s, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
