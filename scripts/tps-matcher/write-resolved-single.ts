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

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const KEY_CHUNK = 150;
  const summary: Record<string, unknown> = {};
  for (const def of Object.values(CATEGORY_DEFS)) {
    // distinct single-store keys for this category (exactly 1 store)
    const { rows } = await pg.query(
      `select identity_key from tps_identity_staging where category=$1 and identity_key is not null
       group by identity_key having count(distinct store_id)=1`, [def.category]);
    const keys = rows.map((r) => r.identity_key as string);
    let written = 0;
    for (let i = 0; i < keys.length; i += KEY_CHUNK) {
      const r = await corroboratePass(sb, def, keys.slice(i, i + KEY_CHUNK), { singleStore: true });
      written += r.canonicalsWritten;
    }
    summary[def.category] = { singleKeys: keys.length, written };
    console.log(`  ${def.category}: single-store keys=${keys.length} written=${written}`);
  }
  await pg.end();
  console.table(summary);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
