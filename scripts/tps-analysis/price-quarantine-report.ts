// scripts/tps-analysis/price-quarantine-report.ts
// Monitoring instrument for the price-truth gate (P0 incident 2026-08-05, see
// src/lib/intelligence/price-truth-gate.ts and docs/DECISIONS.md). Read-only.
//
// Lists every currently-quarantined offer (a price the storefront refused to publish
// because it failed the sanity check) so a human can review and either confirm the new
// price manually or leave it quarantined pending a second consistent observation.
// Run after any scraping burst, or on a schedule, to catch what the automated gate
// caught. `--json` for machine consumption (e.g. a future alert wiring).
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

(async () => {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!u.includes("vyceqrzttspyycdpojtn")) {
    console.error("REFUSING: not pointed at production (vyceqrzttspyycdpojtn)");
    process.exit(1);
  }
  const asJson = process.argv.includes("--json");
  const connStr = toPoolerDbUrl(process.env.SUPABASE_DB_URL || "");
  const pg = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 30000");

  const { rows } = await pg.query(`
    select ps.id, ps.product_id, ps.store_id, s.name_en as store, p.name_en, p.category,
           ps.current_price, ps.price_pending_value, ps.price_quarantine_reason,
           ps.price_quarantined_at, ps.external_id, ps.product_url
    from product_stores ps
    join products p on p.id = ps.product_id
    left join stores s on s.id = ps.store_id
    where ps.price_quarantined_at is not null
    order by ps.price_quarantined_at desc
  `);

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`${rows.length} offer(s) currently quarantined by the price-truth gate.\n`);
    for (const r of rows) {
      console.log(`- [${r.price_quarantined_at}] ${r.store ?? r.store_id} · ${String(r.name_en).slice(0, 70)}`);
      console.log(`  live=${r.current_price} pending=${r.price_pending_value} cat=${r.category} sku=${r.external_id}`);
      console.log(`  reason: ${r.price_quarantine_reason}`);
      console.log(`  ${r.product_url}`);
    }
  }

  await pg.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
