// scripts/tps-matcher/bulk-backfill.ts
// One-time BULK saturation of the identity accumulator. Normalization is a
// read+stage operation (NO canonical writes), so it can safely run in bulk via
// the direct pg connection (fast, no REST per-row overhead). The ≤500/run
// canonical-write bound is unchanged and still governs the ongoing scheduled
// sweep (run-progressive.ts); this is a controlled initial populate.
//
// Flow: page through ALL raw_observations by id → classify each row via every
// category detector → bulk-upsert valid identities into tps_identity_staging →
// advance the durable global cursor. Corroboration is then run separately
// (corroborateAll) through the verified write_ac_batch path. Idempotent; resumable.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { pickBestUrl } from "../tps-core/url-util";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { corroboratePass } from "../tps-core/progressive-engine";
import { assertFingerprint } from "../tps-core/tps-batch";

const DB_URL = process.env.SUPABASE_DB_URL || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

(async () => {
  if (!DB_URL || !SUPABASE_KEY) throw new Error("no db/supabase env");
  assertFingerprint(SUPABASE_URL, "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  const defs = Object.values(CATEGORY_DEFS);
  const PAGE = 5000;
  let lastId = 0, scanned = 0, staged = 0;
  const perCatKeys: Record<string, Set<string>> = {};
  for (const d of defs) perCatKeys[d.category] = new Set();

  for (;;) {
    const { rows } = await pg.query("select id, store_id, raw_name, payload from raw_observations where id > $1 order by id asc limit $2", [lastId, PAGE]);
    if (!rows.length) break;
    const batch: unknown[][] = [];
    for (const row of rows) {
      lastId = Number(row.id); scanned++;
      const p = (row.payload ?? {}) as Record<string, unknown>;
      const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(row.raw_name) ?? "";
      const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
      const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
      const url = pickBestUrl(p);
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const identity = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (identity.status === "invalid" || !identity.key) continue;
        const conf = def.plugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
        perCatKeys[def.category].add(identity.key);
        batch.push([def.category, Number(row.id), row.store_id, identity.key, identity.status, extractPrice(p), url, (nameEn || nameAr).slice(0, 300), conf.confidence, JSON.stringify(norm.payload)]);
      }
    }
    // bulk upsert staging (chunked multi-row insert)
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500);
      const vals: string[] = []; const params: unknown[] = [];
      chunk.forEach((r, j) => { const b = j * 10; vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},now())`); params.push(...r); });
      await pg.query(
        `insert into tps_identity_staging (category,raw_obs_id,store_id,identity_key,status,price,url,name,confidence,payload,observed_at) values ${vals.join(",")}
         on conflict (category,raw_obs_id) do update set identity_key=excluded.identity_key,status=excluded.status,price=excluded.price,url=excluded.url,name=excluded.name,confidence=excluded.confidence,payload=excluded.payload,observed_at=excluded.observed_at`,
        params
      );
      staged += chunk.length;
    }
    if (scanned % 25000 === 0 || rows.length < PAGE) console.log(`  scanned=${scanned} lastId=${lastId} staged=${staged}`);
  }
  // advance durable global cursor to the max id per store (so scheduled sweep continues cleanly)
  await pg.query(`insert into tps_progress_cursors (category,store_id,last_raw_id,updated_at)
    select '_all_', store_id, max(id), now() from raw_observations where store_id is not null group by store_id
    on conflict (category,store_id) do update set last_raw_id=greatest(tps_progress_cursors.last_raw_id, excluded.last_raw_id), updated_at=now()`);
  console.log(`\nNORMALIZE done: scanned=${scanned} staged=${staged}`);
  for (const d of defs) console.log(`  ${d.category}: ${perCatKeys[d.category].size} distinct keys`);
  await pg.end();

  // Corroborate each category over ALL accumulated staging (verified write path).
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  console.log("\n=== CORROBORATE ===");
  const summary: Record<string, unknown> = {};
  const KEY_CHUNK = 150; // bound each write_ac_batch
  for (const def of defs) {
    const keys = [...perCatKeys[def.category]];
    let corroborated = 0, written = 0, single = 0;
    for (let i = 0; i < keys.length; i += KEY_CHUNK) {
      const r = await corroboratePass(sb, def, keys.slice(i, i + KEY_CHUNK));
      corroborated += r.corroborated; written += r.canonicalsWritten; single += r.singleStore;
    }
    summary[def.category] = { keys: keys.length, corroborated, singleStore: single, written };
    console.log(`  ${def.category}: keys=${keys.length} corroborated=${corroborated} written=${written}`);
  }
  console.table(summary);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
