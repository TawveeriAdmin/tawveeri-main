// AC Rescue Lab — integration-level checks against the REAL ac_rescue_pilot_links table
// (safe: no FK to products/canonical_products, purpose-built for exactly this). Proves the
// DB-level unique-index double-write backstop actually fires, independent of the pure
// evaluateProposal() unit tests. Cleans up its own synthetic rows afterward. Never touches
// `products` or `canonical_products`.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";
import { TEST_ALLOWLIST } from "./pilot/ledger-logic";

const FIXTURE = TEST_ALLOWLIST[0];

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log("=== INTEGRATION CHECK: DB-level double-write prevention (unique index) ===");
  console.log("Using synthetic fixture (never a real product):", FIXTURE.amazonProductId);

  // Clean slate for this fixture id, in case a prior run left something.
  await c.query(`delete from ac_rescue_pilot_links where amazon_product_id = $1`, [FIXTURE.amazonProductId]);

  const insert1 = await c.query(
    `insert into ac_rescue_pilot_links (pilot_batch_id, amazon_product_id, target_canonical_id, before_state, after_state, evidence_reference, rule_version, status)
     values ('integration-test','${FIXTURE.amazonProductId}','${FIXTURE.targetCanonicalId}','{"canonical_product_id":null}','{"canonical_product_id":"${FIXTURE.targetCanonicalId}"}','TEST-FIXTURE','ac-rescue-lab-pilot-v1','proposed') returning id`
  );
  console.log("first INSERT (status=proposed) succeeded, id:", insert1.rows[0].id);

  let secondInsertRejected = false;
  let secondInsertErrorCode: string | undefined;
  try {
    await c.query(
      `insert into ac_rescue_pilot_links (pilot_batch_id, amazon_product_id, target_canonical_id, before_state, after_state, evidence_reference, rule_version, status)
       values ('integration-test','${FIXTURE.amazonProductId}','${FIXTURE.targetCanonicalId}','{"canonical_product_id":null}','{"canonical_product_id":"${FIXTURE.targetCanonicalId}"}','TEST-FIXTURE','ac-rescue-lab-pilot-v1','proposed')`
    );
  } catch (e: any) {
    secondInsertRejected = true;
    secondInsertErrorCode = e.code;
  }
  console.log("second INSERT (same product, still open status) rejected by DB:", secondInsertRejected, "| error code:", secondInsertErrorCode, "(23505 = unique_violation, expected)");

  // A row with status='rolled_back' for the SAME product should be allowed (history accumulates).
  await c.query(`update ac_rescue_pilot_links set status = 'rolled_back' where amazon_product_id = $1`, [FIXTURE.amazonProductId]);
  let thirdInsertSucceeded = false;
  try {
    const r = await c.query(
      `insert into ac_rescue_pilot_links (pilot_batch_id, amazon_product_id, target_canonical_id, before_state, after_state, evidence_reference, rule_version, status)
       values ('integration-test','${FIXTURE.amazonProductId}','${FIXTURE.targetCanonicalId}','{"canonical_product_id":null}','{"canonical_product_id":"${FIXTURE.targetCanonicalId}"}','TEST-FIXTURE','ac-rescue-lab-pilot-v1','proposed') returning id`
    );
    thirdInsertSucceeded = true;
    console.log("third INSERT after prior row rolled_back: allowed (id " + r.rows[0].id + ") — history correctly accumulates once the prior row is closed");
  } catch (e) {
    console.log("third INSERT unexpectedly rejected:", e);
  }

  console.log("\nDB_LEVEL_DOUBLE_WRITE_PREVENTION:", secondInsertRejected && secondInsertErrorCode === "23505" ? "PASS" : "FAIL");
  console.log("HISTORY_ACCUMULATION_AFTER_CLOSE:", thirdInsertSucceeded ? "PASS" : "FAIL");

  // Cleanup — this is the isolated pilot table, safe to fully clear synthetic fixture rows.
  const del = await c.query(`delete from ac_rescue_pilot_links where amazon_product_id = $1`, [FIXTURE.amazonProductId]);
  console.log("\nCleanup: deleted", del.rowCount, "synthetic fixture row(s). Table state restored.");

  const remaining = await c.query(`select count(*) from ac_rescue_pilot_links`);
  console.log("ac_rescue_pilot_links row count after cleanup:", remaining.rows[0].count);

  await c.end();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
