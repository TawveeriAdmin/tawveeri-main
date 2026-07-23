// scripts/tps-core/onboard-store-corroborate.ts
// ─────────────────────────────────────────────────────────────────────────────
// STORE ONBOARDING — CORROBORATION STEP (ADR-060)
//
// Adding a store to TPS_STORES is configuration, not onboarding. This performs
// the step that actually makes a new merchant participate in the knowledge
// graph: corroborate ONLY the identity keys in which that store appears.
//
// Deliberately narrow. A blanket re-corroboration would rewrite every category's
// canonicals and risk duplicate cards; restricting to keys touched by the new
// store is purely ADDITIVE — each write either adds the new store's offer to an
// existing comparison, or creates a comparison that could not exist before.
//
// Runs through the verified `write_ac_batch` path (same as every other writer),
// so it is idempotent and reversible.
//
// Usage: npx tsx scripts/tps-core/onboard-store-corroborate.ts --stores 3,8 [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_DEFS } from "./category-registry";
import { corroboratePass } from "./progressive-engine";
import { assertFingerprint } from "./tps-batch";
import { isBridgeableSpecKey } from "../../src/lib/identity/alias-graph";

const DRY = process.argv.includes("--dry");
const arg = process.argv[process.argv.indexOf("--stores") + 1];
const STORES = (process.argv.includes("--stores") && arg ? arg : "").split(",").map(Number).filter(Number.isFinite);

(async () => {
  if (!STORES.length) throw new Error("pass --stores <ids>, e.g. --stores 3,8");
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // Keys where the onboarding store appears AND >=2 distinct stores agree.
  const { rows } = await pg.query(
    `with s as (select category, identity_key, store_id from tps_identity_staging where status='valid'),
          k as (select category, identity_key,
                       count(distinct store_id) stores,
                       bool_or(store_id = any($1)) has_new
                from s group by 1,2)
     select category, identity_key, stores from k
     where stores >= 2 and has_new order by category, identity_key`,
    [STORES]
  );
  // PRECISION GUARD — apply the same bridge-quality standard used for aliasing.
  // A key built mostly of placeholders (e.g. `huawei|matepad|NO_GEN|256|wifi|
  // NO_SIZE`, generation AND screen size unknown) is too weak to assert one
  // product, even when several stores agree on it. Coverage grows only when
  // precision holds; a skipped key merely defers.
  const weak = rows.filter((r) => !String(r.identity_key).includes("|MODEL:") && !isBridgeableSpecKey(String(r.identity_key)));
  const weakSet = new Set(weak.map((r) => String(r.identity_key)));
  const usable = rows.filter((r) => !weakSet.has(String(r.identity_key)));
  if (weak.length) {
    console.log(`skipped ${weak.length} weak placeholder key(s):`);
    for (const r of weak) console.log(`  - [${r.category}] ${r.identity_key}`);
  }

  const byCat = new Map<string, string[]>();
  for (const r of usable) {
    const c = String(r.category);
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(String(r.identity_key));
  }
  console.log(`stores=${STORES.join(",")}  corroboratable keys=${usable.length} across ${byCat.size} categories`);
  for (const [cat, keys] of byCat) console.log(`  ${cat}: ${keys.length}`);

  // Which of these would be NEW cards vs adding a store to an existing one.
  const { rows: exist } = await pg.query(
    `select tps_identity_key from canonical_products where is_active and tps_identity_key = any($1)`,
    [usable.map((r) => String(r.identity_key))]
  );
  const existing = new Set(exist.map((r) => r.tps_identity_key));
  const fresh = usable.filter((r) => !existing.has(String(r.identity_key)));
  console.log(`  → ${existing.size} add a store to an EXISTING comparison; ${fresh.length} create a NEW comparison`);

  if (DRY) {
    console.log("\nsample keys:");
    for (const r of usable.slice(0, 15)) console.log(`  [${r.category}] ${r.identity_key}  (stores=${r.stores})`);
    await pg.end(); return;
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false } });
  let written = 0, corroborated = 0;
  for (const [cat, keys] of byCat) {
    const def = Object.values(CATEGORY_DEFS).find((d) => d.category === cat);
    if (!def) { console.log(`  skip ${cat}: no category def`); continue; }
    for (let i = 0; i < keys.length; i += 100) {
      const r = await corroboratePass(sb, def, keys.slice(i, i + 100));
      written += r.canonicalsWritten; corroborated += r.corroborated;
    }
    console.log(`  ${cat}: done`);
  }
  console.log(`\nONBOARDING corroborated=${corroborated} canonicalsWritten=${written}`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
