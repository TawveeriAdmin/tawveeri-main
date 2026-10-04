// scripts/tps-analysis/rehearsal/setup.ts — build the schema from the production catalog and load a bounded sample.
// PRODUCTION IS READ-ONLY (see lib.ts prodClient). Everything is written to the LOCAL replica only.
//
//   npx tsx scripts/tps-analysis/rehearsal/setup.ts               # schema + data + cursors + parity report
//   npx tsx scripts/tps-analysis/rehearsal/setup.ts --plan-only   # print what would be copied (cheap prod reads), write nothing
//   npx tsx scripts/tps-analysis/rehearsal/setup.ts --schema-only
//   env REH_CATEGORIES=mobile,tv   REH_RAW_DAYS=3   REH_RAW_CAP=60000 (max raw rows per store)
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import { DATA, DIR, prodClient, localClient, fmtMs, type ProdClient } from "./lib";
import { start } from "./start";
import { writeSchemaFiles, TABLES, type SchemaMeta, type TableMeta } from "./gen-schema";
import { writeParity } from "./parity";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TPS_STORES } = require("../../tps-core/category-registry");

const args = new Set(process.argv.slice(2));
const CATEGORIES = (process.env.REH_CATEGORIES || "mobile,tv").split(",").map((s) => s.trim()).filter(Boolean);
const RAW_DAYS = Number(process.env.REH_RAW_DAYS || 3);
const RAW_CAP = Number(process.env.REH_RAW_CAP || 60000);
const PAGE = 2000;
const CANON_CHUNK = 60;

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const t0 = Date.now();
const log = (m: string) => console.log(`[${fmtMs(Date.now() - t0).padStart(7)}] ${m}`);

export interface LoadReport { loadedAt: string; categories: string[]; rawDays: number; rawCap: number; rows: Record<string, number>; notes: string[]; rawPerStore: Record<string, { copied: number; minId: number | null; maxId: number | null; capped: boolean }>; cursorBaseline: Record<string, number>; productionCursorsBefore: Record<string, number> }

async function insertJson(local: Client, meta: TableMeta, json: string, extraWhere = ""): Promise<number> {
  const hasIdentity = meta.cols.some((c) => c.identity);
  const sql = `INSERT INTO public.${q(meta.name)} ${hasIdentity ? "OVERRIDING SYSTEM VALUE " : ""}SELECT r.* FROM jsonb_populate_recordset(NULL::public.${q(meta.name)}, $1::jsonb) r ${extraWhere}`;
  const res = await local.query(sql, [json]);
  return res.rowCount ?? 0;
}

/** Keyset-paginated full-table copy (ORDER BY the primary key; row-value comparison for composite keys). */
async function copyAllKeyset(prod: ProdClient, local: Client, meta: TableMeta, rep: LoadReport, where = "", wparams: unknown[] = []): Promise<number> {
  const pk = meta.pk; if (!pk.length) throw new Error(`${meta.name}: no primary key — cannot keyset`);
  const order = pk.map(q).join(", ");
  let last: any = null; let total = 0;
  for (;;) {
    const cond: string[] = []; const params: unknown[] = [...wparams];
    if (where) cond.push(where);
    if (last) {
      const ph = pk.map((c, i) => `$${params.length + i + 1}::${meta.pkTypes[i]}`);
      params.push(...pk.map((c) => last[c]));
      cond.push(`(${order}) > (${ph.join(", ")})`);
    }
    const rows = await prod.query(
      `select j::text rows, j->-1 last, jsonb_array_length(j) n from (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) j from (select * from public.${q(meta.name)} ${cond.length ? "where " + cond.join(" and ") : ""} order by ${order} limit ${PAGE}) x) y`, params);
    const { rows: json, last: l, n } = rows[0];
    if (!n) break;
    total += await insertJson(local, meta, json);
    last = l;
    if (n < PAGE) break;
  }
  return total;
}

/** Copy rows keyed to a set of canonical ids, in canonical-id chunks (index-driven, no table scans on prod). */
async function copyByCanonical(prod: ProdClient, local: Client, meta: TableMeta, canonIds: string[], extraWhere = ""): Promise<{ copied: number; dropped: number }> {
  const order = meta.pk.map(q).join(", ");
  let copied = 0, dropped = 0;
  for (let i = 0; i < canonIds.length; i += CANON_CHUNK) {
    const chunk = canonIds.slice(i, i + CANON_CHUNK);
    const r = await prod.query(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)::text rows, count(*)::int n from (select * from public.${q(meta.name)} where canonical_product_id = any($1::uuid[]) order by ${order}) x`, [chunk]);
    if (!r[0].n) continue;
    const ins = await insertJson(local, meta, r[0].rows, extraWhere);
    copied += ins; dropped += r[0].n - ins;
    if ((i / CANON_CHUNK) % 10 === 0) log(`  ${meta.name}: ${copied} rows (${Math.min(i + CANON_CHUNK, canonIds.length)}/${canonIds.length} canonicals)`);
  }
  return { copied, dropped };
}

async function rawFloor(prod: ProdClient, storeId: number): Promise<{ floor: number; maxId: number; count: number; capped: boolean } | null> {
  const top = await prod.query("select id, scraped_at from public.raw_observations where store_id = $1 order by id desc limit 1", [storeId]);
  if (!top.length) return null;
  const maxId = Number(top[0].id);
  const horizon = new Date(top[0].scraped_at).getTime() - RAW_DAYS * 86400_000;
  const minRow = await prod.query("select id from public.raw_observations where store_id = $1 order by id asc limit 1", [storeId]);
  let lo = Number(minRow[0].id), hi = maxId;
  // smallest id whose scraped_at >= horizon (ids are time-monotone enough for "~N days")
  for (let i = 0; i < 60 && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const r = await prod.query("select id, scraped_at from public.raw_observations where store_id = $1 and id >= $2 order by id limit 1", [storeId, mid]);
    if (!r.length) { hi = mid; continue; }
    if (new Date(r[0].scraped_at).getTime() >= horizon) hi = mid; else lo = mid;
  }
  let floor = lo; // rows with id > floor
  let capped = false;
  const capRow = await prod.query("select id from public.raw_observations where store_id = $1 order by id desc offset $2 limit 1", [storeId, RAW_CAP]);
  if (capRow.length && Number(capRow[0].id) > floor) { floor = Number(capRow[0].id); capped = true; }
  const c = await prod.query("select count(*)::int n from public.raw_observations where store_id = $1 and id > $2", [storeId, floor]);
  return { floor, maxId, count: c[0].n, capped };
}

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  const prod = await prodClient(120_000);
  try {
    const planOnly = args.has("--plan-only");
    // ── plan ───────────────────────────────────────────────────────────────────────────
    const canon = await prod.query("select id from public.canonical_products where category = any($1::text[]) order by id", [CATEGORIES]);
    const canonIds: string[] = canon.map((r: any) => r.id);
    log(`plan: ${canonIds.length} canonicals in categories [${CATEGORIES.join(",")}]`);
    const rawPlan: Record<number, Awaited<ReturnType<typeof rawFloor>>> = {};
    {
      // read-only index probes, ~0.4s RTT each: run 6 stores in parallel on their own read-only sessions
      const queue = [...TPS_STORES]; const pool = await Promise.all(Array.from({ length: 6 }, () => prodClient(120_000)));
      await Promise.all(pool.map(async (pc) => { for (let s = queue.shift(); s; s = queue.shift()) { rawPlan[s.id] = await rawFloor(pc, s.id); } }));
      await Promise.all(pool.map((pc) => pc.end()));
      for (const s of TPS_STORES) { const p = rawPlan[s.id]; log(`  raw store ${s.id}: ${p ? `${p.count} rows (id>${p.floor}..${p.maxId})${p.capped ? " CAPPED" : ""}` : "none"}`); }
    }
    if (planOnly) { await prod.end(); return; }

    // ── infra + schema ─────────────────────────────────────────────────────────────────
    await start();
    log("generating schema from production catalog (read-only) ...");
    const meta: SchemaMeta = await writeSchemaFiles(prod);
    const sqlAll = fs.readFileSync(path.join(DIR, "schema.generated.sql"), "utf8");
    const split = sqlAll.indexOf("-- ===== POST-DATA");
    const pre = sqlAll.slice(0, split), post = sqlAll.slice(split);
    const local = await localClient();
    log("rebuilding local public schema ...");
    await local.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await local.query("GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role");
    await local.query(pre);
    log(`pre-data DDL applied (${meta.tables.length} tables)`);
    if (args.has("--schema-only")) { await local.query(post); await local.query("NOTIFY pgrst, 'reload schema'"); await local.end(); await prod.end(); return; }

    // ── data ───────────────────────────────────────────────────────────────────────────
    const rep: LoadReport = { loadedAt: new Date().toISOString(), categories: CATEGORIES, rawDays: RAW_DAYS, rawCap: RAW_CAP, rows: {}, notes: [], rawPerStore: {}, cursorBaseline: {}, productionCursorsBefore: {} };
    const M = (n: string) => meta.tables.find((t) => t.name === n)!;
    for (const t of ["stores", "canonical_products", "tps_current_offers", "tps_progress_cursors", "tps_product_projection", "tps_price_implausibility_signals", "tps_offer_delist_signals", "samsung_official_url_baseline"]) {
      const n = await copyAllKeyset(prod, local, M(t), rep); rep.rows[t] = n; log(`${t}: ${n} rows (full table)`);
    }
    // normalized observations / matches / price history for the sampled categories
    const npo = await copyByCanonical(prod, local, M("normalized_product_observations"), canonIds); rep.rows.normalized_product_observations = npo.copied; log(`normalized_product_observations: ${npo.copied} rows`);
    const pm = await copyByCanonical(prod, local, M("product_matches"), canonIds, "WHERE EXISTS (SELECT 1 FROM public.normalized_product_observations n WHERE n.id = r.raw_observation_id)");
    rep.rows.product_matches = pm.copied; log(`product_matches: ${pm.copied} rows (${pm.dropped} dropped: referenced normalized row not in sample)`);
    if (pm.dropped) rep.notes.push(`product_matches: ${pm.dropped} rows for sampled canonicals dropped because their normalized_product_observations row is outside the sample (keeps the kept FK satisfiable).`);
    const ph = await copyByCanonical(prod, local, M("price_history"), canonIds); rep.rows.price_history = ph.copied; log(`price_history: ${ph.copied} rows`);
    rep.rows.tps_identity_staging = 0; log("tps_identity_staging: left EMPTY (hot path never reads it)");

    // raw observations: last N days per store (keyset on id, one index range per store)
    let rawTotal = 0;
    for (const s of TPS_STORES) {
      const plan = rawPlan[s.id];
      if (!plan) { rep.rawPerStore[s.id] = { copied: 0, minId: null, maxId: null, capped: false }; continue; }
      const n = await copyAllKeysetRaw(prod, local, M("raw_observations"), s.id, plan.floor);
      rep.rawPerStore[s.id] = { copied: n.copied, minId: n.minId, maxId: n.maxId, capped: plan.capped };
      rawTotal += n.copied; log(`raw_observations store ${s.id}: ${n.copied} rows${plan.capped ? " (capped)" : ""}`);
    }
    rep.rows.raw_observations = rawTotal;

    // ── post-data ──────────────────────────────────────────────────────────────────────
    log("post-data DDL (indexes, FKs, RLS, grants) ...");
    await local.query(post);
    for (const t of meta.tables) {
      if (t.cols.some((c) => c.identity)) {
        const idc = t.cols.find((c) => c.identity)!.name;
        await local.query(`select setval(pg_get_serial_sequence('public.${q(t.name)}', '${idc}'), coalesce((select max(${q(idc)}) from public.${q(t.name)}), 0) + 1, false)`);
      }
    }
    await local.query(`select setval('public.stores_id_seq', coalesce((select max(id) from public.stores), 0) + 1, false)`);

    // ── cursors ────────────────────────────────────────────────────────────────────────
    const prodCur = await local.query("select store_id, last_raw_id from public.tps_progress_cursors where category = '_all_'");
    for (const r of prodCur.rows) rep.productionCursorsBefore[r.store_id] = Number(r.last_raw_id);
    for (const s of TPS_STORES) {
      const st = rep.rawPerStore[s.id];
      if (!st || st.minId == null) { if (rep.productionCursorsBefore[s.id] != null) rep.cursorBaseline[s.id] = rep.productionCursorsBefore[s.id]; continue; }
      const cur = st.minId - 1;
      await local.query(`insert into public.tps_progress_cursors (category, store_id, last_raw_id, updated_at) values ('_all_', $1, $2, now())
                         on conflict (category, store_id) do update set last_raw_id = excluded.last_raw_id, updated_at = now()`, [s.id, cur]);
      rep.cursorBaseline[s.id] = cur;
    }
    fs.writeFileSync(path.join(DATA, "cursor-baseline.json"), JSON.stringify(rep.cursorBaseline, null, 2));
    log(`cursors set for ${Object.keys(rep.cursorBaseline).length} stores (baseline saved to .data/cursor-baseline.json)`);

    await local.query("NOTIFY pgrst, 'reload schema'");
    log("ANALYZE ...");
    await local.query("ANALYZE");
    const size = (await local.query("select pg_database_size(current_database()) b")).rows[0].b;
    rep.notes.push(`local database size after load: ${(Number(size) / 1048576).toFixed(0)} MiB`);
    fs.writeFileSync(path.join(DATA, "load-report.json"), JSON.stringify(rep, null, 2));
    await local.end();
    log(`LOAD COMPLETE — db size ${(Number(size) / 1048576).toFixed(0)} MiB`);

    await writeParity(prod, rep);
    log("parity.md written");
  } finally {
    await prod.end().catch(() => undefined);
  }
}

async function copyAllKeysetRaw(prod: ProdClient, local: Client, meta: TableMeta, storeId: number, floor: number) {
  let lastId = floor; let copied = 0; let minId: number | null = null; let maxId: number | null = null;
  for (;;) {
    const r = await prod.query(
      `select j::text rows, jsonb_array_length(j) n, (j->0->>'id')::bigint first_id, (j->-1->>'id')::bigint last_id from (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) j from (select * from public.raw_observations where store_id = $1 and id > $2 order by id limit 1500) x) y`,
      [storeId, lastId]);
    if (!r[0].n) break;
    copied += await insertJson(local, meta, r[0].rows);
    if (minId == null) minId = Number(r[0].first_id);
    maxId = Number(r[0].last_id); lastId = maxId;
    if (r[0].n < 1500) break;
  }
  return { copied, minId, maxId };
}

main().catch((e) => { console.error("setup failed:", e); process.exit(1); });
