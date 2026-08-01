// scripts/tps-analysis/validation-log-health.ts
// ─────────────────────────────────────────────────────────────────────────────
// F7 DURABLE VALIDATION LOG — health check (ADR-160).
//
// Answers the one question the table exists for: WAS THE GUARD RUNNING, and what did it do?
// Silence in a log that only records failures is ambiguous between "nothing was generated",
// "everything passed" and "the validator never executed". Three distinct outcomes make it
// answerable, and this reports all three.
//
// It also REHEARSES the write path end to end — writes one event of each outcome, reads them
// back, then deletes them. A health check that only reads cannot tell a working sink from an
// empty table.
//
//   npx tsx scripts/tps-analysis/validation-log-health.ts
//   npx tsx scripts/tps-analysis/validation-log-health.ts --no-write   # read-only
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

// The durable sink is disabled under NODE_ENV=test; this script IS the production path.
if (process.env.NODE_ENV === "test") process.env.NODE_ENV = "production";

import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import {
  validateGeneratedAnswer,
  recordValidationEvent,
  closeDurableSink,
  MAX_INPUT_CHARS,
} from "../../src/lib/vocabulary";

const READ_ONLY = process.argv.includes("--no-write");
let failures = 0;
const check = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

async function connect(): Promise<Client> {
  let lastErr: unknown;
  for (let i = 1; i <= 5; i++) {
    const c = new Client({
      connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    try { await c.connect(); return c; } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 2000 * i)); }
  }
  throw lastErr;
}

(async () => {
  console.log("\nF7 DURABLE VALIDATION LOG — HEALTH\n" + "=".repeat(64) + "\n");
  const c = await connect();

  const { rows: t } = await c.query(
    "select count(*)::int n from information_schema.tables where table_schema='observability' and table_name='validation_events'",
  );
  check(t[0].n === 1, "observability.validation_events exists");

  // The table must be UNREACHABLE from the API roles. It holds customer queries verbatim, and a
  // grant to `anon` would publish them.
  const { rows: g } = await c.query(
    `select count(*)::int n from information_schema.role_table_grants
      where table_schema='observability' and grantee in ('anon','authenticated')`,
  );
  check(g[0].n === 0, "no grants to anon/authenticated", `${g[0].n} grant(s)`);

  const { rows: r } = await c.query(
    "select relrowsecurity, relforcerowsecurity from pg_class where oid='observability.validation_events'::regclass",
  );
  check(r[0]?.relrowsecurity === true && r[0]?.relforcerowsecurity === true, "RLS enabled and forced");

  if (!READ_ONLY) {
    // Rehearse all three outcomes through the REAL record path, then clean up.
    const marker = `f7-log-health-${process.pid}`;
    const samples: Array<[string, string]> = [
      ["rejected", "Prices updated daily across all stores."],
      ["passed", "لم نرصد سعرًا لهذا المنتج بعد."],
      ["unavailable", "x".repeat(MAX_INPUT_CHARS + 1)],
    ];
    for (const [, generated] of samples) {
      recordValidationEvent({
        verdict: validateGeneratedAnswer(generated, { figures: [], retailers: [] }),
        query: marker,
        generated,
        surface: marker,
        timestamp: new Date().toISOString(),
      });
    }
    await new Promise((res) => setTimeout(res, 4000)); // fire-and-forget: give it a moment
    await closeDurableSink();

    const { rows: written } = await c.query(
      "select outcome, decision, violated_rules, unavailable_reason from observability.validation_events where surface=$1 order by id",
      [marker],
    );
    check(written.length === 3, "all three outcomes written durably", `${written.length}/3`);
    const outcomes = new Set(written.map((w) => w.outcome));
    check(outcomes.size === 3, "the three outcomes are stored DISTINCTLY", [...outcomes].join(", "));
    check(
      written.some((w) => w.outcome === "rejected" && (w.violated_rules ?? []).includes("refresh-cadence")),
      "a rejection stores its violated rule",
    );
    check(
      written.some((w) => w.outcome === "unavailable" && w.unavailable_reason === "input_too_large"),
      "an unavailable stores its reason",
    );
    await c.query("delete from observability.validation_events where surface=$1", [marker]);
    console.log("      rehearsal rows deleted");
  }

  // What the operator actually wants to see.
  const { rows: dist } = await c.query(
    `select outcome, count(*)::int n, max(occurred_at) newest
       from observability.validation_events group by 1 order by 1`,
  );
  console.log("\n  recorded events by outcome:");
  if (!dist.length) console.log("      (none — expected while the generative surface is closed)");
  for (const d of dist) console.log(`      ${String(d.outcome).padEnd(12)} ${String(d.n).padStart(6)}   newest ${d.newest?.toISOString?.() ?? d.newest}`);

  await c.end();
  console.log("\n" + "=".repeat(64));
  console.log(failures === 0 ? "GATE: PASS" : `GATE: FAIL — ${failures} check(s) failing`);
  if (failures) process.exitCode = 1;
})();
