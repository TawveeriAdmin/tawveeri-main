// scripts/tps-matcher/write-resolved-single.ts
// E14 Layer 2: write the RESOLVED-SINGLE products (known canonical identity, one
// store, comparison_available=false) from the accumulated staging. Additive — the
// ≥2-store comparable canonicals (Layer 1) are untouched. has_comparison is
// derived downstream by build-tps-projection from price_history store_count (=1).
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CATEGORY_DEFS } from "../tps-core/category-registry";
import { corroboratePass } from "../tps-core/progressive-engine";
import { assertFingerprint } from "../tps-core/tps-batch";

// CLAUDE.md / ADR-078: Supabase's direct host is IPv6-only; Railway is IPv4. Route
// through the pooler so this chain step can actually run where the scheduler runs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("../tps-core/pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const KEY_CHUNK = 150;
  const summary: Record<string, unknown> = {};
  // A single-store key can already exist as a canonical (a prior run, or detector
  // overlap producing the SAME tps_identity_key under another category — the unique
  // index `canonical_products_tps_identity_key_uidx` is GLOBAL). write_ac_batch's
  // canonical insert is not idempotent on that index, so re-writing such a key
  // FATALs and aborts the entire refresh chain (measured: shaker ingestion surfaced
  // a `tablet` collision that broke projection). Skip keys that already exist, and
  // track keys written THIS run so a later category can't re-emit the same global
  // key. Mirrors onboard-store-corroborate's fresh-filter.
  const { rows: existRows } = await pg.query(`select tps_identity_key from canonical_products where tps_identity_key is not null`);
  const seen = new Set<string>(existRows.map((r) => r.tps_identity_key as string));
  // (brand, model_number) is ALSO globally unique (`canonical_products_brand_model_number_idx`
  // — the ADR-050 duplicate-card guard). A NEW single-store MODEL:-primary key whose
  // brand+model pair already exists under a DIFFERENT identity key violates it and
  // FATALs the whole step — which is exactly what broke the hourly chain in production
  // (2026-08-12, `write_ac_batch(laptop): duplicate key … brand_model_number_idx`): junk
  // title-derived "models" like DDR5/512GB repeat across different laptops of one brand.
  // Defer, never force: skip any candidate whose (brand, model) pair is already taken —
  // in the graph or earlier in this same run — and report the count. The listing stays
  // safely unwritten rather than crashing every step downstream of this one.
  const { rows: pairRows } = await pg.query(
    `select lower(brand) b, model_number m from canonical_products where model_number is not null`);
  const takenPair = new Set<string>(pairRows.map((r) => `${r.b}|${r.m}`));
  const pairOf = (key: string): string | null => {
    const parts = key.split("|");
    return parts[1]?.startsWith("MODEL:") ? `${parts[0].toLowerCase()}|${parts[1].slice(6)}` : null;
  };
  for (const def of Object.values(CATEGORY_DEFS)) {
    // distinct single-store keys for this category (exactly 1 store)
    const { rows } = await pg.query(
      `select identity_key from tps_identity_staging where category=$1 and identity_key is not null
       group by identity_key having count(distinct store_id)=1`, [def.category]);
    const candidates = rows.map((r) => r.identity_key as string).filter((k) => !seen.has(k));
    const keys: string[] = [];
    let pairDeferred = 0;
    for (const k of candidates) {
      const pair = pairOf(k);
      if (pair && takenPair.has(pair)) { pairDeferred++; continue; }
      if (pair) takenPair.add(pair);
      keys.push(k);
    }
    for (const k of keys) seen.add(k);
    let written = 0;
    for (let i = 0; i < keys.length; i += KEY_CHUNK) {
      const r = await corroboratePass(sb, def, keys.slice(i, i + KEY_CHUNK), { singleStore: true });
      written += r.canonicalsWritten;
    }
    summary[def.category] = { singleKeys: keys.length, written, pairDeferred };
    console.log(`  ${def.category}: single-store keys=${keys.length} written=${written}${pairDeferred ? ` brand+model-pair deferred=${pairDeferred}` : ""}`);
  }
  await pg.end();
  console.table(summary);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
