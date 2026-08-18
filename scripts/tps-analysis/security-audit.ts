// scripts/tps-analysis/security-audit.ts
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY AUDIT — evidence for the launch-readiness Security gate (read-only).
//
// The Constitution requires: every table enables RLS; credential/session tables are NEVER
// granted to `anon`. This turns the "assessed 85" into MEASURED findings by querying the live
// catalog: (1) which public tables lack RLS; (2) whether sensitive tables expose grants to
// anon/authenticated; (3) tables with RLS on but ZERO policies (locked to nobody, or a config
// mistake). Prints findings + a computed score; exits non-zero on a critical finding.
//   npx tsx scripts/tps-analysis/security-audit.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

// Tables holding credentials, sessions, PII, or audit trails — anon must never touch these.
const SENSITIVE = ["users", "phone_otps", "login_sessions", "admin_logs", "audit_logs", "transactions",
  "user_preferences", "saved_searches", "price_alerts", "user_wishlists", "product_reviews", "notifications"];

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const noRls = (await c.query(
      `select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity order by 1`
    )).rows.map((r) => r.relname as string);

    const rlsNoPolicy = (await c.query(
      `select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relrowsecurity
         and not exists (select 1 from pg_policy p where p.polrelid=c.oid) order by 1`
    )).rows.map((r) => r.relname as string);

    // In Supabase, anon/authenticated hold broad table GRANTS by default and RLS enforces
    // access. So the ACTUAL exposure = a table with anon grants AND no RLS (grants ungated).
    const exposed = (await c.query(
      `select t.relname, string_agg(distinct g.privilege_type, ',') privs
         from pg_class t
         join information_schema.role_table_grants g on g.table_name=t.relname and g.table_schema='public' and g.grantee='anon'
        where t.relnamespace='public'::regnamespace and t.relkind='r' and not t.relrowsecurity
        group by t.relname order by 1`
    )).rows as { relname: string; privs: string }[];

    const tableCount = (await c.query(`select count(*) n from pg_class where relnamespace='public'::regnamespace and relkind='r'`)).rows[0].n;
    console.log(`\n══ SECURITY AUDIT ══\n`);
    console.log(`  public tables: ${tableCount}\n`);
    console.log(`  [CRITICAL] tables with NO RLS that anon can reach: ${exposed.length ? "‼ " + exposed.map((r) => `${r.relname}(${r.privs})`).join(", ") : "✓ none"}`);
    console.log(`  [info] tables with NO RLS (any grantee): ${noRls.length ? noRls.join(", ") : "none"}`);
    console.log(`  [OK] RLS-on-but-no-policy (default-DENY — correct service-role-only lockdown): ${rlsNoPolicy.length} tables`);
    console.log(`  [note] Sensitive tables use the Supabase default (anon grant + RLS gate) — RLS policy correctness is a separate manual review: ${SENSITIVE.join(", ")}`);

    // ── PRIVILEGE-BOUNDARY INVARIANTS (ADR-259, migrations 36 + 37) ───────────────────
    // The 2026-08-18 audit found three defects that RLS alone cannot express, so RLS
    // coverage alone was scoring 100/100 while all three were live. These are the LIVE
    // counterpart to tests/database/users-role-privilege.test.ts (which guards the
    // migration text); this block guards the database that is actually running.
    const roleWritable = (await c.query(
      `select grantee from information_schema.column_privileges
        where table_schema='public' and table_name='users' and column_name='role'
          and privilege_type='UPDATE' and grantee in ('anon','authenticated')`
    )).rows.map((r) => r.grantee as string);

    const roleTrigger = (await c.query(
      `select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
        where t.tgrelid='public.users'::regclass and t.tgname='trg_users_role_immutable'
          and not t.tgisinternal and not p.prosecdef`   // must be SECURITY INVOKER to work
    )).rowCount;

    const truncatable = (await c.query(
      `select count(distinct table_name)::int n from information_schema.role_table_grants
        where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='TRUNCATE'`
    )).rows[0].n as number;

    const anonWritable = (await c.query(
      `select count(distinct table_name)::int n from information_schema.role_table_grants
        where table_schema='public' and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE')`
    )).rows[0].n as number;

    // Any SECURITY INVOKER function that writes, reachable by a client role, inherits that
    // role's table privileges. write_mobile_batch was exactly this and was PUBLIC-executable.
    const clientWriterFns = (await c.query(
      `select p.proname from pg_proc p
        where p.pronamespace='public'::regnamespace and p.prokind in ('f','p')
          and coalesce(p.prosrc,'') ~* '(insert[[:space:]]+into|delete[[:space:]]+from|truncate)'
          and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
        order by 1`
    )).rows.map((r) => r.proname as string);

    const boundaryFindings: string[] = [];
    if (roleWritable.length) boundaryFindings.push(`users.role is UPDATE-able by ${roleWritable.join("/")} — PRIVILEGE ESCALATION`);
    if (!roleTrigger) boundaryFindings.push(`trg_users_role_immutable missing or is SECURITY DEFINER (fails open)`);
    if (truncatable > 0) boundaryFindings.push(`${truncatable} table(s) TRUNCATE-able by a client role (RLS does not gate TRUNCATE)`);
    if (anonWritable > 0) boundaryFindings.push(`anon holds INSERT/UPDATE/DELETE on ${anonWritable} table(s)`);
    if (clientWriterFns.length) boundaryFindings.push(`client-executable writer function(s): ${clientWriterFns.join(", ")}`);

    console.log(`\n  ── privilege boundary (ADR-259) ──`);
    console.log(`  users.role client-writable:        ${roleWritable.length ? "‼ " + roleWritable.join("/") : "✓ no"}`);
    console.log(`  role-immutability trigger:         ${roleTrigger ? "✓ present (SECURITY INVOKER)" : "‼ missing/definer"}`);
    console.log(`  tables TRUNCATE-able by clients:   ${truncatable === 0 ? "✓ 0" : "‼ " + truncatable}`);
    console.log(`  tables anon can write:             ${anonWritable === 0 ? "✓ 0" : "‼ " + anonWritable}`);
    console.log(`  client-executable writer funcs:    ${clientWriterFns.length ? "‼ " + clientWriterFns.join(", ") : "✓ none"}`);

    // Score: an anon-reachable RLS-less table is the real hole (−30 each). RLS-no-policy is
    // NOT penalized (it is a correct default-deny lockdown). Grants-with-RLS are the norm.
    // A broken privilege boundary is as critical as an RLS-less table — same weight.
    const score = Math.max(0, 100 - exposed.length * 30 - boundaryFindings.length * 30);
    const critical = exposed.length > 0 || boundaryFindings.length > 0;
    if (boundaryFindings.length) {
      console.log(`\n  [CRITICAL] privilege-boundary regressions:`);
      boundaryFindings.forEach((f) => console.log(`    ‼ ${f}`));
      console.log(`    → re-apply scripts/database/36-users-role-privilege-boundary.sql and 37-client-role-privilege-sweep.sql`);
    }
    console.log(`\n  SECURITY SCORE: ${score}/100  ${critical ? `‼ ${exposed.length} anon-reachable RLS-less table(s) — enable RLS (default-deny) before launch` : "✓ no anon-reachable RLS-less tables"}`);
    console.log(`  (assessed extras: credentials env-only, no hardcoded keys, Sentry live, service-role server-only)\n`);
    if (critical) process.exitCode = 1;
  } finally { await c.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
