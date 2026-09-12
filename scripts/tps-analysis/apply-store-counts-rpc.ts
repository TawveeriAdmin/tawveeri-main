// ONE-TIME DDL apply for 031_tps_store_product_counts_rpc.sql (Samsung KSA global
// closure mission, 2026-09-12). Same pattern as apply-npo-payload-url-index.ts.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { readFileSync } from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("../tps-core/pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  const ref = /db\.([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
  if (ref !== "vyceqrzttspyycdpojtn") { console.error(`REFUSED: not production (${ref})`); process.exit(2); }
  const c = new pg.Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/031_tps_store_product_counts_rpc.sql"), "utf8");
  await c.query(sql);
  console.log("Applied 031_tps_store_product_counts_rpc.sql OK");
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
