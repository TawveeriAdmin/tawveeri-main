// AC Rescue Lab — applies 030_ac_rescue_pilot_links.sql. This is the ONE script in this
// entire lab authorized to write DDL. It creates exactly one new, physically isolated
// table (idempotent — `create table if not exists`) and touches nothing else: no existing
// table is altered, no row in any existing table is read or written. Explicitly authorized
// by the founder's "AUTHORIZE BUILDING AND TESTING THE ISOLATED PILOT MECHANISM" mission.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { readFileSync } from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const sql = readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/030_ac_rescue_pilot_links.sql"), "utf8");
  console.log("Applying scripts/database/knowledge-db/030_ac_rescue_pilot_links.sql ...");
  await c.query(sql);
  console.log("Applied (idempotent — safe to re-run).");

  const check = await c.query(`
    select table_name, is_insertable_into
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ac_rescue_pilot_links'
  `);
  console.log("Verification:", JSON.stringify(check.rows, null, 2));

  const rls = await c.query(`select relrowsecurity from pg_class where relname = 'ac_rescue_pilot_links'`);
  console.log("RLS enabled:", rls.rows[0]?.relrowsecurity);

  const rowCount = await c.query(`select count(*) from ac_rescue_pilot_links`);
  console.log("Current row count (must be 0 on first run):", rowCount.rows[0].count);

  await c.end();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
