// scripts/tps-analysis/sentinel-check.ts
// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL-LEAK GATE — a standing customer-surface quality check (read-only).
//
// Internal identity sentinels (NO_STORAGE/NO_TECH/NO_SERIES/…) are placeholders for an
// unspecified spec. They must NEVER reach a customer-facing string. Twice now a category's
// name builder leaked one (mobile NO_STORAGE — ADR-081/084; AC NO_TECH — ADR-109). This gate
// scans every ACTIVE canonical display name for ANY known sentinel across ALL categories, so
// the next leak is caught mechanically instead of by a customer. Exits non-zero if any leak
// is found — wire into CI / run after any pipeline or parser change.
//   npx tsx scripts/tps-analysis/sentinel-check.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

// Every sentinel any plugin emits into an identity key (grep the plugins for NO_/NA tokens).
const SENTINELS = [
  "NO_STORAGE", "NO_TECH", "NO_SERIES", "NO_GEN", "NO_RES", "NO_PANEL", "NO_HZ",
  "NO_CONN", "NO_SIZE", "NO_FAMILY", "NO_SCREEN", "NO_STORE", "NO_CPU",
];

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const like = SENTINELS.map((s) => `name_ar like '%${s}%' or name_en like '%${s}%'`).join(" or ");
    const rows = (await c.query(
      `select category, count(*) n, min(name_ar) sample from canonical_products
        where is_active and (${like}) group by category order by 2 desc`
    )).rows as { category: string; n: string; sample: string }[];

    const total = rows.reduce((a, r) => a + Number(r.n), 0);
    if (!total) { console.log("✓ sentinel-check: 0 leaks — no internal sentinel in any active canonical name."); return; }
    console.log(`✗ sentinel-check: ${total} active canonicals leak an internal sentinel into the display name:\n`);
    for (const r of rows) console.log(`  ${r.category.padEnd(18)} ${String(r.n).padStart(4)}   e.g. "${r.sample}"`);
    console.log(`\n→ Fix the category's name builder (omit the sentinel segment) + remediate. See ADR-109.`);
    process.exitCode = 1;
  } finally { await c.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
