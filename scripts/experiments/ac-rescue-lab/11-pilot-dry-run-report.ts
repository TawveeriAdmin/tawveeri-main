// AC Rescue Lab — TCL/Haier pilot dry-run report. ZERO writes anywhere, not even to the
// new ac_rescue_pilot_links table (only SELECT queries against products/canonical_products).
// Simulates propose -> apply -> rollback entirely in memory using the real, current
// production state and the exact same pure guard functions the live CLI uses — so this
// report is provably what the CLI would decide, without creating any real ledger row.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";
import {
  PRODUCTION_ALLOWLIST,
  evaluateProposal,
  evaluateApply,
  evaluateRollback,
  type ProductState,
  type CanonicalState,
} from "./pilot/ledger-logic";

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  for (const entry of PRODUCTION_ALLOWLIST) {
    console.log(`\n================ ${entry.label} ================`);

    const pr = await c.query(`select id, canonical_product_id from products where id = $1`, [entry.amazonProductId]);
    const currentProduct: ProductState | null = pr.rows.length ? { id: pr.rows[0].id, canonicalProductId: pr.rows[0].canonical_product_id } : null;

    const cr = await c.query(`select id, tps_identity_key, is_active from canonical_products where id = $1`, [entry.targetCanonicalId]);
    const currentCanonical: CanonicalState | null = cr.rows.length ? { id: cr.rows[0].id, tpsIdentityKey: cr.rows[0].tps_identity_key, isActive: cr.rows[0].is_active } : null;

    // Real query, not a hardcoded assumption: does an open ledger row already exist?
    const openRow = await c.query(`select 1 from ac_rescue_pilot_links where amazon_product_id = $1 and status in ('proposed','active') limit 1`, [entry.amazonProductId]);

    const proposal = evaluateProposal(PRODUCTION_ALLOWLIST, entry.amazonProductId, entry.targetCanonicalId, currentProduct, openRow.rows.length > 0);

    // Simulate the ledger row that propose() WOULD write, without writing it.
    const simulatedProposedRow = {
      status: "proposed",
      amazonProductId: entry.amazonProductId,
      targetCanonicalId: entry.targetCanonicalId,
      beforeState: { canonicalProductId: currentProduct?.canonicalProductId ?? null },
    };
    const apply = evaluateApply(PRODUCTION_ALLOWLIST, simulatedProposedRow, currentProduct, currentCanonical);

    // Simulate "if apply had succeeded" to answer whether rollback would then succeed —
    // the ledger row would be 'active' and products.canonical_product_id would equal target.
    const simulatedActiveRow = { status: "active", amazonProductId: entry.amazonProductId, targetCanonicalId: entry.targetCanonicalId };
    const simulatedPostApplyProduct: ProductState = { id: entry.amazonProductId, canonicalProductId: entry.targetCanonicalId };
    const rollback = evaluateRollback(simulatedActiveRow, simulatedPostApplyProduct);

    console.log("AMAZON_PRODUCT_ID:", entry.amazonProductId);
    console.log("CURRENT_CANONICAL_PRODUCT_ID:", currentProduct?.canonicalProductId ?? null);
    console.log("TARGET_CANONICAL_ID:", entry.targetCanonicalId);
    console.log("CURRENT_STATE_VALID:", currentProduct && currentProduct.canonicalProductId === null ? "YES" : "NO");
    console.log("EVIDENCE_GATE (propose):", proposal.allowed ? "PASS" : "FAIL", proposal.allowed ? "" : `- ${proposal.reason}`);
    console.log("DRIFT_CHECK (apply, vs proposal-time snapshot):", apply.reason.startsWith("DRIFT") ? "FAIL" : "PASS");
    console.log("WRITE_WOULD_SUCCEED:", apply.allowed ? "YES" : "NO", apply.allowed ? "" : `- ${apply.reason}`);
    console.log("ROLLBACK_WOULD_SUCCEED (simulated, if apply had run):", rollback.allowed ? "YES" : "NO", rollback.allowed ? "" : `- ${rollback.reason}`);
    console.log("target canonical resolved:", currentCanonical ? `${currentCanonical.id} (active=${currentCanonical.isActive}, identity_key=${currentCanonical.tpsIdentityKey})` : "NOT FOUND");
  }

  const finalCount = await c.query(`select count(*) from ac_rescue_pilot_links`);
  console.log("\nac_rescue_pilot_links row count after this report (must be unchanged, 0):", finalCount.rows[0].count);

  await c.end();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
