// scripts/tps-core/rollback-identity-v2.ts — ADR-403 write-path rollback (2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────
// Turning TPS_IDENTITY_V2 off stops NEW keys being minted under the v2 rules, but it does not
// un-write what the v2 path already wrote: tps_current_offers rows and canonical_products rows
// under keys only the v2 rules produce (X7c / Redmi 15C / S26+ …), plus their append-only evidence
// (price_history, normalized_product_observations, product_matches — never deleted, by design).
// This script removes the v2-born state from customer surfaces and restores the v1 view:
//
//   1. every tps_current_offers row stamped `_identity_rules: "v2"` (progressive-engine marker) is
//      re-keyed IN MEMORY under the v1 rules from its own raw observation;
//        same key          → NEUTRAL: the v2 rules did not change it; only the marker is stripped;
//        different/invalid → V2-BORN: the row is retired (status 'invalid' + `_superseded_by_identity`
//                            + `_identity_rollback` {from_status, v1_key, at}) — the mechanism
//                            get-comparison / search / projection already honour — and, when its v1 key
//                            has no current row for that store, the v1 row is restored from the same
//                            observation so the listing does not vanish until its next scrape;
//   2. every canonical stamped `identity_rules: "v2"` that is left with NO valid current offer is
//      deactivated (is_active=false, never deleted — price_history references it) and its serving
//      projection row and identity signals are removed;
//   3. everything is one transaction, preceded by a before-state export.
//
// DRY by default. `--go` writes. Idempotent: a second run finds nothing stamped.
//   npx tsx scripts/tps-core/rollback-identity-v2.ts [--categories=mobile,tv] [--go] [--out=<file.json>]
// Run it with TPS_IDENTITY_V2 UNSET (it forces the flag off in-process regardless).
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
process.env.TPS_IDENTITY_V2 = "0"; // the v1 view — forced before any plugin is consulted
import { Client } from "pg";
import { CATEGORY_DEFS } from "./category-registry";
import { toPoolerDbUrl } from "./pooler-url";
import { adaptRow } from "./progressive-engine";

const argv = process.argv.slice(2);
const GO = argv.includes("--go");
const CATS = argv.find((a) => a.startsWith("--categories="))?.split("=")[1]?.split(",").filter(Boolean) ?? null;
const OUT = argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? `docs/evidence/amazon-diagnostic-2026-10-03/phase3b/rollback/rollback-${GO ? "applied" : "dry"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const defs = Object.values(CATEGORY_DEFS) as { category: string; plugin: { detect(a: string, b: string): boolean; buildIdentityKey(brand: string | null, payload: unknown, o: { model_number?: unknown }): { key?: string | null; status?: string | null } }; normalize(a: string, b: string, brand: string | null, p: Record<string, unknown>): { payload: unknown; model_number?: unknown } }[];

const isLocal = (u: string) => /@(localhost|127\.0\.0\.1)(:|\/)/.test(u);
function assertTarget(u: string) {
  const prod = u.includes("vyceqrzttspyycdpojtn") && !u.includes("ffpsjjazsluolysgithg");
  if (!isLocal(u) && !prod) throw new Error("refusing: neither production nor a local rehearsal database");
}

/** The key the v1 rules assign to a raw observation, or null when v1 yields no valid key. */
export function v1KeyFor(rawName: string | null, payload: Record<string, unknown>): { key: string | null; status: string | null } {
  const { nameAr, nameEn, brand } = adaptRow(payload, rawName);
  for (const def of defs) {
    let det = false; try { det = def.plugin.detect(nameAr, nameEn); } catch { continue; }
    if (!det) continue;
    try { const n = def.normalize(nameAr, nameEn, brand, payload); const id = def.plugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number }); return { key: id.key ?? null, status: id.status ?? null }; }
    catch { return { key: null, status: "error" }; }
  }
  return { key: null, status: null };
}

async function main() {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing"); assertTarget(url);
  const t0 = Date.now();
  const pg = new Client({ connectionString: isLocal(url) ? url : toPoolerDbUrl(url), ssl: isLocal(url) ? undefined : { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");
  try {
    const { rows: stamped } = await pg.query<{ category: string; identity_key: string; store_id: number; raw_obs_id: string; status: string; price: string | null; url: string | null; name: string | null; confidence: number | null; observed_at: string | null; payload: Record<string, unknown> }>(
      `select category, identity_key, store_id, raw_obs_id::text as raw_obs_id, status, price::text as price, url, name, confidence, observed_at, payload
         from tps_current_offers where payload->>'_identity_rules' = 'v2' ${CATS ? "and category = any($1::text[])" : ""}`, CATS ? [CATS] : []);

    const rawIds = [...new Set(stamped.map((r) => r.raw_obs_id))];
    const raw = new Map<string, { raw_name: string | null; payload: Record<string, unknown> }>();
    for (let i = 0; i < rawIds.length; i += 1000) {
      const { rows } = await pg.query<{ id: string; raw_name: string | null; payload: Record<string, unknown> }>("select id::text as id, raw_name, payload from raw_observations where id = any($1::bigint[])", [rawIds.slice(i, i + 1000)]);
      rows.forEach((r) => raw.set(r.id, { raw_name: r.raw_name, payload: r.payload ?? {} }));
    }

    const neutral: typeof stamped = [], born: Array<{ row: (typeof stamped)[number]; v1_key: string | null; v1_status: string | null }> = [], unresolved: typeof stamped = [];
    for (const r of stamped) {
      const src = raw.get(r.raw_obs_id);
      if (!src) { unresolved.push(r); continue; }                                  // raw evidence missing → leave untouched, report
      if (typeof r.payload._manufacturer_model === "string") { neutral.push(r); continue; } // manufacturer identity does not depend on the flag
      const v1 = v1KeyFor(src.raw_name, src.payload);
      if (v1.key && v1.status !== "invalid" && v1.key === r.identity_key) neutral.push(r);
      else born.push({ row: r, v1_key: v1.status === "invalid" ? null : v1.key, v1_status: v1.status });
    }

    // Canonicals stamped v2 that would be left with no valid current offer once the born rows retire.
    const bornKeys = new Set(born.map((b) => `${b.row.category}|${b.row.identity_key}`));
    const { rows: canon } = await pg.query<{ id: string; tps_identity_key: string; category: string; is_active: boolean }>(
      `select id::text as id, tps_identity_key, category, is_active from canonical_products where attributes->>'identity_rules' = 'v2' and is_active ${CATS ? "and category = any($1::text[])" : ""}`, CATS ? [CATS] : []);
    const { rows: stillValid } = await pg.query<{ category: string; identity_key: string; n: string }>(
      `select category, identity_key, count(*)::text as n from tps_current_offers where status = 'valid' and coalesce(payload->>'_superseded_by_identity','') = '' group by 1, 2`);
    const validCount = new Map(stillValid.map((r) => [`${r.category}|${r.identity_key}`, Number(r.n)]));
    const retiringPerKey = new Map<string, number>();
    for (const b of born) if (b.row.status === "valid") retiringPerKey.set(`${b.row.category}|${b.row.identity_key}`, (retiringPerKey.get(`${b.row.category}|${b.row.identity_key}`) ?? 0) + 1);
    const deactivate = canon.filter((c) => bornKeys.has(`${c.category}|${c.tps_identity_key}`) && (validCount.get(`${c.category}|${c.tps_identity_key}`) ?? 0) - (retiringPerKey.get(`${c.category}|${c.tps_identity_key}`) ?? 0) <= 0);

    // Restore: a v1 row for the same listing when the v1 key has none for that store.
    const { rows: existingV1 } = born.length ? await pg.query<{ category: string; identity_key: string; store_id: number }>(
      "select category, identity_key, store_id from tps_current_offers where identity_key = any($1::text[])", [[...new Set(born.map((b) => b.v1_key).filter((k): k is string => !!k))]]) : { rows: [] };
    const haveV1 = new Set(existingV1.map((r) => `${r.category}|${r.identity_key}|${r.store_id}`));
    const restores = born.filter((b) => b.v1_key && b.v1_status !== "invalid" && !haveV1.has(`${b.row.category}|${b.v1_key}|${b.row.store_id}`));

    const report = {
      at: new Date().toISOString(), mode: GO ? "applied" : "dry", categories: CATS ?? "all",
      stamped_current_offers: stamped.length, neutral_marker_only: neutral.length, v2_born_retired: born.length, v1_rows_restored: restores.length,
      unresolved_missing_raw: unresolved.length, canonicals_deactivated: deactivate.length,
      by_category: Object.fromEntries([...new Set(stamped.map((r) => r.category))].map((c) => [c, { stamped: stamped.filter((r) => r.category === c).length, born: born.filter((b) => b.row.category === c).length, deactivated: deactivate.filter((d) => d.category === c).length }])),
      examples: born.slice(0, 15).map((b) => ({ category: b.row.category, store_id: b.row.store_id, name: (b.row.name ?? "").slice(0, 70), v2_key: b.row.identity_key, v1_key: b.v1_key })),
      before_state: { born: born.map((b) => b.row), deactivate },
    };
    mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(report, null, 1));

    let projectionPruned = 0, signalsRemoved = 0;
    if (GO) {
      await pg.query("begin");
      try {
        const now = new Date().toISOString();
        for (const b of born) {
          await pg.query(
            `update tps_current_offers set status = 'invalid',
                    payload = (payload - '_identity_rules') || jsonb_build_object('_superseded_by_identity', $4::text, '_identity_rollback', jsonb_build_object('from_status', $5::text, 'v1_key', $6::text, 'at', $7::text)),
                    updated_at = now()
              where category = $1 and identity_key = $2 and store_id = $3`, [b.row.category, b.row.identity_key, b.row.store_id, b.v1_key ?? "v1-rollback", b.row.status, b.v1_key, now]);
        }
        for (const r of restores) {
          await pg.query(
            `insert into tps_current_offers (category, identity_key, store_id, raw_obs_id, status, price, url, name, confidence, payload, observed_at, updated_at)
             values ($1,$2,$3,$4::bigint,$5,$6::numeric,$7,$8,$9,$10::jsonb,$11,now())
             on conflict (category, identity_key, store_id) do nothing`,
            [r.row.category, r.v1_key, r.row.store_id, r.row.raw_obs_id, r.row.status, r.row.price, r.row.url, r.row.name, r.row.confidence, JSON.stringify(Object.fromEntries(Object.entries(r.row.payload).filter(([k]) => k !== "_identity_rules"))), r.row.observed_at]);
        }
        for (const n of neutral) await pg.query("update tps_current_offers set payload = payload - '_identity_rules', updated_at = now() where category = $1 and identity_key = $2 and store_id = $3", [n.category, n.identity_key, n.store_id]);
        if (deactivate.length) {
          const ids = deactivate.map((d) => d.id), keys = deactivate.map((d) => d.tps_identity_key);
          await pg.query("update canonical_products set is_active = false, attributes = attributes || jsonb_build_object('_deactivated_by', 'identity-v2-rollback', '_deactivated_at', $2::text) where id = any($1::uuid[])", [ids, now]);
          projectionPruned = (await pg.query("delete from tps_product_projection where tps_identity_key = any($1::text[])", [keys])).rowCount ?? 0;
          if ((await pg.query("select to_regclass('tps_offer_identity_signals') as t")).rows[0].t) signalsRemoved = (await pg.query("delete from tps_offer_identity_signals where canonical_product_id = any($1::uuid[])", [ids])).rowCount ?? 0;
        }
        await pg.query("commit");
      } catch (e) { await pg.query("rollback"); throw e; }
    }
    console.log(JSON.stringify({ job: "rollback-identity-v2", ...Object.fromEntries(Object.entries(report).filter(([k]) => k !== "before_state" && k !== "examples")), projection_rows_pruned: projectionPruned, signals_removed: signalsRemoved, export: OUT, ms: Date.now() - t0 }));
  } finally { await pg.end(); }
}

const executedDirectly = require.main === module || process.argv[1]?.replace(/\\/g, "/").endsWith("rollback-identity-v2.ts");
if (executedDirectly) main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
