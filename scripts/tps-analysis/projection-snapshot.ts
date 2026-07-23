// scripts/tps-analysis/projection-snapshot.ts
// Dump every projection row's DERIVED fields to a stable, sorted JSON file so a
// builder rewrite can be proven output-equivalent rather than assumed to be
// (ADR-067). Presentation fields (image_url, affiliate_best_url) are excluded —
// they are owned by build-projection-presentation.ts, not the projection builder.
// Read-only. Usage: npx tsx scripts/tps-analysis/projection-snapshot.ts <out.json>
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { writeFileSync } from "fs";

(async () => {
  const out = process.argv[2];
  if (!out) throw new Error("usage: projection-snapshot.ts <out.json>");
  const url = process.env.SUPABASE_DB_URL!;
  if (!/db\.vyceqrzttspyycdpojtn\.supabase\.co/.test(url)) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const { rows } = await pg.query(`
    select tps_identity_key, canonical_id::text, display_name_ar, display_name_en, brand, category,
           lowest_price::text, highest_price::text, saving::text, price_spread_pct::text,
           cheapest_store, store_count, has_comparison, compare_url, identity_confidence, text_for_search
    from tps_product_projection order by tps_identity_key`);
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`snapshot: ${rows.length} rows → ${out}`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
