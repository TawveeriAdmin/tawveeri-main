/**
 * RLS coverage guard.
 *
 * WHY THIS EXISTS
 * `phone_otps` (migration 08) and `login_sessions` (migration 12) were created
 * without RLS. In Supabase a public-schema table with RLS disabled is readable
 * by anyone holding the anon key, which ships in the web bundle and the mobile
 * binary. Live phone numbers, OTP codes, device fingerprints and IP addresses
 * were publicly readable for as long as those tables existed.
 *
 * Nineteen of twenty-one tables were correct. The two that were not slipped
 * through because nothing checked. This test is that check: it reads the schema
 * definitions statically, so a table created without RLS fails at test time
 * rather than after it reaches production.
 *
 * It deliberately does not talk to a database — it guards the *definitions*,
 * which is where the defect was born and what milestone E9 will replay into the
 * knowledge database.
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_DIR = path.join(process.cwd(), 'scripts', 'database');

/**
 * Tables that are intentionally readable without authentication.
 * Adding a name here is a deliberate, reviewable decision to publish a table.
 */
const INTENTIONALLY_PUBLIC = new Set<string>([
  // none: every public catalog table still enables RLS and grants read via policy
]);

function readSchemaSql(): { file: string; sql: string }[] {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ file: f, sql: fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8') }));
}

function collect() {
  const created = new Map<string, string>();
  const rlsEnabled = new Set<string>();
  const materialized = new Map<string, string>();
  const revoked = new Set<string>();

  // SCHEMA-QUALIFIED NAMES ARE PARSED, not assumed away. The original patterns matched
  // `(?:public\.)?<name>`, so `create table observability.validation_events` captured
  // "observability" as the TABLE and the matching `alter table observability.validation_events
  // enable row level security` matched nothing at all — the table looked RLS-less while its
  // definition enabled and FORCED RLS two lines below. A guard that cannot read the schema
  // prefix would either block every non-public table or, worse, mis-report which one is exposed.
  // `public.` is normalised away so existing bare names keep working.
  const qualified = (raw: string) => raw.replace(/^public\./i, '').toLowerCase();

  for (const { file, sql } of readSchemaSql()) {
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+(?:\.[a-z_]+)?)/gi)) {
      const name = qualified(m[1]);
      if (!created.has(name)) created.set(name, file);
    }
    for (const m of sql.matchAll(/ALTER TABLE ([a-z_]+(?:\.[a-z_]+)?)\s+ENABLE ROW LEVEL SECURITY/gi)) {
      rlsEnabled.add(qualified(m[1]));
    }
    for (const m of sql.matchAll(/CREATE MATERIALIZED VIEW (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)/gi)) {
      if (!materialized.has(m[1])) materialized.set(m[1], file);
    }
    for (const m of sql.matchAll(/REVOKE\s+[A-Z, ]+\s+ON\s+(?:public\.)?([a-z_]+)\s+FROM\s+([a-z_, ]+)/gi)) {
      if (/anon/.test(m[2])) revoked.add(m[1]);
    }
  }
  return { created, rlsEnabled, materialized, revoked };
}

describe('RLS coverage', () => {
  it('finds schema definitions to audit', () => {
    expect(readSchemaSql().length).toBeGreaterThan(0);
  });

  it('every created table enables row level security', () => {
    const { created, rlsEnabled } = collect();

    const missing = [...created.entries()]
      .filter(([table]) => !rlsEnabled.has(table) && !INTENTIONALLY_PUBLIC.has(table))
      .map(([table, file]) => `${table} (defined in ${file})`);

    expect(missing).toEqual([]);
  });

  it('every materialized view revokes access from anon', () => {
    // Materialized views cannot carry RLS. Grants are the only control, and
    // Supabase grants SELECT to anon by default — so an explicit REVOKE is
    // mandatory, not optional.
    const { materialized, revoked } = collect();

    const missing = [...materialized.entries()]
      .filter(([view]) => !revoked.has(view))
      .map(([view, file]) => `${view} (defined in ${file})`);

    expect(missing).toEqual([]);
  });

  it('tables holding credentials or session data are never granted to anon', () => {
    // A stricter rule for the highest-sensitivity tables: RLS alone is not
    // enough, the grant must be revoked too, so a future permissive policy
    // cannot re-expose them.
    const SENSITIVE = ['phone_otps', 'login_sessions'];
    const { created, revoked } = collect();

    const problems = SENSITIVE.filter((t) => created.has(t) && !revoked.has(t));

    expect(problems).toEqual([]);
  });
});
