// scripts/tps-core/load-listing-evidence.ts — append page-captured evidence (capture-listing-evidence.ts JSONL) to `tps_listing_evidence`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// DRY by default. `--write` creates the table if absent (039_listing_evidence.sql: RLS on, no anon/authenticated grants) and INSERTS rows
// (`on conflict do nothing`) in one transaction. It never updates or deletes a row and touches no other table: the evidence is append-only
// and the only reader is the identity evidence layer behind TPS_IDENTITY_EVIDENCE. Rollback = `drop table tps_listing_evidence`.
//
//   npx tsx scripts/tps-core/load-listing-evidence.ts --in=…/page-evidence-2026-10-04.jsonl            (dry: counts only)
//   npx tsx scripts/tps-core/load-listing-evidence.ts --in=… --write
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";

const argv = process.argv.slice(2);
const IN = resolve(process.cwd(), argv.find((a) => a.startsWith("--in="))?.split("=").slice(1).join("=") ?? "");
const WRITE = argv.includes("--write");
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

type Line = { store_id: number; merchant: string; url: string; fetch_url?: string; status: number | null; captured_at: string; items: { field: string; value: string }[] };

(async () => {
  const lines = readFileSync(IN, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Line).filter((l) => l.status === 200 && l.items.length);
  const rows = lines.flatMap((l) => l.items.map((i) => ({ store_id: l.store_id, merchant: resolveApprovedSlug(l.store_id) ?? l.merchant, url: l.url, fetch_url: l.fetch_url ?? null, http_status: l.status, field: i.field, raw_value: i.value, normalized_value: norm(i.value), captured_at: l.captured_at })))
    .filter((r) => r.normalized_value);
  const summary = { listings_with_evidence: lines.length, rows: rows.length, mode: WRITE ? "write" : "dry" };
  if (!WRITE) { console.log(JSON.stringify(summary)); return; }
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    await pg.query("begin");
    await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/039_listing_evidence.sql"), "utf8"));
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500); const params: unknown[] = [];
      const values = chunk.map((r, j) => { const b = j * 9; params.push(r.store_id, r.merchant, r.url, r.fetch_url, r.http_status, r.field, r.raw_value, r.normalized_value, r.captured_at); return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9}::timestamptz)`; });
      inserted += (await pg.query(`insert into tps_listing_evidence (store_id, merchant, url, fetch_url, http_status, field, raw_value, normalized_value, captured_at) values ${values.join(",")} on conflict do nothing`, params)).rowCount ?? 0;
    }
    await pg.query("commit");
    console.log(JSON.stringify({ ...summary, inserted }));
  } catch (e) { await pg.query("rollback"); throw e; } finally { await pg.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
