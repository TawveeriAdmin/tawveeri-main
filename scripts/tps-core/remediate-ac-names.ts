// scripts/tps-core/remediate-ac-names.ts
// One-time remediation (ADR-109): AC canonicals written before the NO_TECH sentinel fix
// have "NO_TECH" baked into name_ar/name_en. Recompute the display name from the (unchanged)
// tps_identity_key with the corrected buildNames and UPDATE where it differs. canonical_products
// is DERIVED (safe to rewrite); this only touches the display name, never identity. Dry-first.
//   npx tsx scripts/tps-core/remediate-ac-names.ts [--apply]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import { assertFingerprint } from "./tps-batch";
import { buildNames } from "../tps-matcher/ac-matcher-v1-dry";

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const rows = (await c.query(
      `select id, tps_identity_key, name_ar, name_en from canonical_products
        where is_active and category='air_conditioner'
          and (name_ar like '%NO_TECH%' or name_en like '%NO_TECH%' or name_ar like '%NO_SERIES%' or name_en like '%NO_SERIES%')`
    )).rows as { id: string; tps_identity_key: string; name_ar: string; name_en: string }[];
    console.log(`\n◆ AC canonicals with a leaked sentinel in the name: ${rows.length}`);

    const updates = rows
      .map((r) => ({ r, n: buildNames(r.tps_identity_key || "") }))
      .filter(({ r, n }) => n.nameAr && (n.nameAr !== r.name_ar || n.nameEn !== r.name_en));
    for (const { r, n } of updates.slice(0, 6)) console.log(`  • "${r.name_ar}"  →  "${n.nameAr}"`);
    console.log(`  fixable: ${updates.length}`);

    if (!apply) { console.log(`\n[dry] no writes. Re-run with --apply.\n`); return; }
    let done = 0;
    for (const { r, n } of updates) {
      await c.query(`update canonical_products set name_ar=$1, name_en=$2, data_updated_at=now() where id=$3`, [n.nameAr, n.nameEn, r.id]);
      done++;
    }
    // Verify no sentinel remains in any active AC name.
    const left = (await c.query(`select count(*) n from canonical_products where is_active and category='air_conditioner' and (name_ar like '%NO_TECH%' or name_en like '%NO_TECH%')`)).rows[0].n;
    console.log(`\n✓ updated ${done} AC canonical names · remaining NO_TECH in active AC names: ${left}\n`);
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
