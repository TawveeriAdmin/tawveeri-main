// scripts/tps-analysis/q.ts
// READ-ONLY ad-hoc query runner against production. Refuses anything that is not
// a single SELECT/WITH statement — production is the source of truth and all
// verification is read-only unless the founder approves a write.
// Usage: npx tsx scripts/tps-analysis/q.ts "select 1" | npx tsx scripts/tps-analysis/q.ts --file q.sql
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { readFileSync } from "fs";

const args = process.argv.slice(2);
const sql = args[0] === "--file" ? readFileSync(args[1], "utf8") : args.join(" ");

const head = sql.trim().toLowerCase();
if (!(head.startsWith("select") || head.startsWith("with"))) {
  console.error("REFUSED: read-only runner accepts only SELECT/WITH");
  process.exit(2);
}

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  const ref = /db\.([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
  if (ref !== "vyceqrzttspyycdpojtn") { console.error(`REFUSED: not production (${ref})`); process.exit(2); }
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect(); await c.query("set statement_timeout=0");
  const { rows } = await c.query(sql);
  for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k}=${v}`).join("  "));
  console.log(`(${rows.length} rows)`);
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
