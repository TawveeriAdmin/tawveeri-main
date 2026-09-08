// AC Rescue Lab — pilot ledger CLI. Every mutating subcommand is DRY-RUN BY DEFAULT and
// requires an explicit --go to actually write, matching the exact convention already
// established by scripts/tps-core/project-storefront-identity.ts. All decision logic
// lives in pilot/ledger-logic.ts (pure, unit-tested) — this file only reads real state,
// calls those functions, and prints or writes based on the result.
//
// Usage:
//   propose  --product <uuid> --canonical <uuid> [--fixtures test] [--go]
//   apply    --id <ledger_id> [--fixtures test] [--go]
//   rollback --id <ledger_id> [--fixtures test] [--go]
//   verify   --id <ledger_id>
//   status
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";
import {
  PRODUCTION_ALLOWLIST,
  TEST_ALLOWLIST,
  evaluateProposal,
  evaluateApply,
  evaluateRollback,
  type ProductState,
  type CanonicalState,
} from "./pilot/ledger-logic";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string): boolean => argv.includes(`--${name}`);
const GO = has("go");
const allowlist = flag("fixtures") === "test" ? TEST_ALLOWLIST : PRODUCTION_ALLOWLIST;
const PILOT_BATCH_ID = "ac-rescue-pilot-2026-09";
const RULE_VERSION = "ac-rescue-lab-pilot-v1";

async function connect(): Promise<Client> {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

async function getProduct(c: Client, id: string): Promise<ProductState | null> {
  const r = await c.query(`select id, canonical_product_id from products where id = $1`, [id]);
  if (r.rows.length === 0) return null;
  return { id: r.rows[0].id, canonicalProductId: r.rows[0].canonical_product_id };
}

async function getCanonical(c: Client, id: string): Promise<CanonicalState | null> {
  const r = await c.query(`select id, tps_identity_key, is_active from canonical_products where id = $1`, [id]);
  if (r.rows.length === 0) return null;
  return { id: r.rows[0].id, tpsIdentityKey: r.rows[0].tps_identity_key, isActive: r.rows[0].is_active };
}

async function hasOpenLedgerRow(c: Client, productId: string): Promise<boolean> {
  const r = await c.query(
    `select 1 from ac_rescue_pilot_links where amazon_product_id = $1 and status in ('proposed','active') limit 1`,
    [productId]
  );
  return r.rows.length > 0;
}

async function cmdPropose(c: Client) {
  const productId = flag("product")!;
  const canonicalId = flag("canonical")!;
  const currentProduct = await getProduct(c, productId);
  const openRow = await hasOpenLedgerRow(c, productId);
  const result = evaluateProposal(allowlist, productId, canonicalId, currentProduct, openRow);

  console.log("=== PROPOSE ===");
  console.log("product:", productId, "-> canonical:", canonicalId);
  console.log("current_product_state:", JSON.stringify(currentProduct));
  console.log("existing_open_ledger_row:", openRow);
  console.log("EVIDENCE_GATE:", result.allowed ? "PASS" : "FAIL", "-", result.reason);

  if (!result.allowed) { console.log("Refusing to propose."); return; }

  const beforeState = { canonical_product_id: currentProduct!.canonicalProductId };
  const afterState = { canonical_product_id: canonicalId };
  const entry = allowlist.find((e) => e.amazonProductId === productId && e.targetCanonicalId === canonicalId)!;

  if (!GO) {
    console.log("DRY RUN — would INSERT into ac_rescue_pilot_links:");
    console.log(JSON.stringify({ pilot_batch_id: PILOT_BATCH_ID, amazon_product_id: productId, target_canonical_id: canonicalId, before_state: beforeState, after_state: afterState, evidence_reference: entry.evidenceReference, rule_version: RULE_VERSION, status: "proposed" }, null, 2));
    console.log("Re-run with --go to write.");
    return;
  }

  const ins = await c.query(
    `insert into ac_rescue_pilot_links (pilot_batch_id, amazon_product_id, target_canonical_id, before_state, after_state, evidence_reference, rule_version, status)
     values ($1,$2,$3,$4,$5,$6,$7,'proposed') returning id`,
    [PILOT_BATCH_ID, productId, canonicalId, beforeState, afterState, entry.evidenceReference, RULE_VERSION]
  );
  console.log("WROTE ledger row id:", ins.rows[0].id);
}

async function cmdApply(c: Client) {
  const id = flag("id")!;
  const row = await c.query(`select * from ac_rescue_pilot_links where id = $1`, [id]);
  if (row.rows.length === 0) { console.log("EVIDENCE_GATE: FAIL - ledger row not found"); return; }
  const r = row.rows[0];
  const ledgerRow = { status: r.status, amazonProductId: r.amazon_product_id, targetCanonicalId: r.target_canonical_id, beforeState: { canonicalProductId: r.before_state.canonical_product_id } };
  const currentProduct = await getProduct(c, r.amazon_product_id);
  const currentCanonical = await getCanonical(c, r.target_canonical_id);
  const result = evaluateApply(allowlist, ledgerRow, currentProduct, currentCanonical);

  console.log("=== APPLY ===");
  console.log("ledger_id:", id, "| status:", r.status);
  console.log("AMAZON_PRODUCT_ID:", r.amazon_product_id);
  console.log("CURRENT_CANONICAL_PRODUCT_ID:", currentProduct?.canonicalProductId ?? null);
  console.log("TARGET_CANONICAL_ID:", r.target_canonical_id);
  console.log("CURRENT_STATE_VALID:", currentProduct && currentProduct.canonicalProductId === ledgerRow.beforeState.canonicalProductId ? "YES" : "NO");
  console.log("DRIFT_CHECK:", result.reason.startsWith("DRIFT") ? "FAIL" : "PASS");
  console.log("EVIDENCE_GATE:", result.allowed ? "PASS" : "FAIL", "-", result.reason);
  console.log("WRITE_WOULD_SUCCEED:", result.allowed ? "YES" : "NO");

  if (!result.allowed) { console.log("Refusing to apply."); return; }
  if (!GO) { console.log("DRY RUN — would UPDATE products SET canonical_product_id =", r.target_canonical_id, "WHERE id =", r.amazon_product_id, "AND canonical_product_id IS NULL"); console.log("Re-run with --go to write."); return; }

  await c.query("BEGIN");
  try {
    const upd = await c.query(`update products set canonical_product_id = $1 where id = $2 and canonical_product_id is null`, [r.target_canonical_id, r.amazon_product_id]);
    if (upd.rowCount !== 1) throw new Error(`expected 1 row updated, got ${upd.rowCount} — aborting transaction`);
    await c.query(`update ac_rescue_pilot_links set status = 'active', applied_at = now() where id = $1`, [id]);
    await c.query("COMMIT");
    console.log("APPLIED. products row updated, ledger row -> active.");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("APPLY FAILED, transaction rolled back:", e);
  }
}

async function cmdRollback(c: Client) {
  const id = flag("id")!;
  const row = await c.query(`select * from ac_rescue_pilot_links where id = $1`, [id]);
  if (row.rows.length === 0) { console.log("EVIDENCE_GATE: FAIL - ledger row not found"); return; }
  const r = row.rows[0];
  const ledgerRow = { status: r.status, amazonProductId: r.amazon_product_id, targetCanonicalId: r.target_canonical_id };
  const currentProduct = await getProduct(c, r.amazon_product_id);
  const result = evaluateRollback(ledgerRow, currentProduct);

  console.log("=== ROLLBACK ===");
  console.log("ledger_id:", id, "| status:", r.status);
  console.log("current products.canonical_product_id:", currentProduct?.canonicalProductId ?? null, "| ledger target:", r.target_canonical_id);
  console.log("ROLLBACK_GATE:", result.allowed ? "PASS" : "FAIL", "-", result.reason);
  console.log("ROLLBACK_WOULD_SUCCEED:", result.allowed ? "YES" : "NO");

  if (!result.allowed) { console.log("Refusing to roll back."); return; }
  if (!GO) { console.log("DRY RUN — would UPDATE products SET canonical_product_id = NULL WHERE id =", r.amazon_product_id, "AND canonical_product_id =", r.target_canonical_id); console.log("Re-run with --go to write."); return; }

  await c.query("BEGIN");
  try {
    const upd = await c.query(`update products set canonical_product_id = null where id = $1 and canonical_product_id = $2`, [r.amazon_product_id, r.target_canonical_id]);
    if (upd.rowCount !== 1) throw new Error(`expected 1 row updated, got ${upd.rowCount} — aborting transaction`);
    await c.query(`update ac_rescue_pilot_links set status = 'rolled_back', rolled_back_at = now() where id = $1`, [id]);
    await c.query("COMMIT");
    console.log("ROLLED BACK. products row reset to NULL, ledger row -> rolled_back.");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("ROLLBACK FAILED, transaction rolled back:", e);
  }
}

async function cmdVerify(c: Client) {
  const id = flag("id")!;
  const row = await c.query(`select * from ac_rescue_pilot_links where id = $1`, [id]);
  if (row.rows.length === 0) { console.log("ledger row not found"); return; }
  const r = row.rows[0];
  const currentProduct = await getProduct(c, r.amazon_product_id);
  console.log("=== VERIFY ===");
  console.log(JSON.stringify({ ledger_id: id, status: r.status, before_state: r.before_state, after_state: r.after_state, current_products_canonical_product_id: currentProduct?.canonicalProductId ?? null, matches_expected: r.status === "active" ? currentProduct?.canonicalProductId === r.target_canonical_id : r.status === "rolled_back" ? currentProduct?.canonicalProductId === null : "n/a" }, null, 2));
}

async function cmdStatus(c: Client) {
  const r = await c.query(`select id, pilot_batch_id, amazon_product_id, target_canonical_id, status, evidence_reference, created_at, applied_at, rolled_back_at from ac_rescue_pilot_links order by id`);
  console.log("=== STATUS ===");
  console.log(JSON.stringify(r.rows, null, 2));
}

(async () => {
  const c = await connect();
  try {
    if (cmd === "propose") await cmdPropose(c);
    else if (cmd === "apply") await cmdApply(c);
    else if (cmd === "rollback") await cmdRollback(c);
    else if (cmd === "verify") await cmdVerify(c);
    else if (cmd === "status") await cmdStatus(c);
    else { console.error("unknown command:", cmd, "— expected propose|apply|rollback|verify|status"); process.exit(1); }
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
