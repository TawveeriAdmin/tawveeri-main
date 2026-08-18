/**
 * users.role privilege-boundary guard (ADR-259).
 *
 * WHY THIS EXISTS
 * The 2026-08-18 readiness audit found that any authenticated user could promote
 * themselves to admin: `users_update_self` carried no WITH CHECK, and BOTH `anon` and
 * `authenticated` held an UPDATE grant on every column of public.users — including
 * `role`, which is exactly the column is_admin() and the whole application read to
 * decide who is an administrator. Signup is open, so the attack was "create an account,
 * send one PATCH".
 *
 * Migration 36 closed it with two barriers. This test guards the barriers.
 *
 * Like tests/database/rls-coverage.test.ts, it reads the schema DEFINITIONS rather than
 * talking to a database — the defect was born in a migration, so a migration is where it
 * must be caught. The specific regression it is designed to catch is a *future* file
 * doing `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated`, or re-granting
 * UPDATE on users, which would silently re-open the hole months from now.
 *
 * The live counterpart is `npm run tps:security-audit`, which asserts the same
 * invariants against production.
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_DIR = path.join(process.cwd(), 'scripts', 'database');
const MIGRATION = '36-users-role-privilege-boundary.sql';
const SWEEP = '37-client-role-privilege-sweep.sql';

/**
 * The origin of the whole defect class, kept out of the sweep below because it is
 * HISTORY, not a live decision: `02-rls-policies.sql` ends with
 *   GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
 * which is how every table since inherited privileges nobody chose. Migration 37 revokes
 * what that grant handed out and sets ALTER DEFAULT PRIVILEGES so new tables do not
 * inherit it again. This test found it, which is the point; it is exempted by name so the
 * guard stays useful for files written from here on. Do not add to this list — a new
 * entry means someone re-opened the hole.
 */
const KNOWN_BLANKET_GRANT = '02-rls-policies.sql';

/** Columns a user may legitimately edit about themselves. Anything outside this set is
 *  either authorization data (role), verification state the server owns
 *  (email_verified / phone_verified / is_active), or identity provenance. */
const USER_EDITABLE = [
  'full_name',
  'avatar_url',
  'preferred_language',
  'phone',
  'email',
  'last_login_at',
  'updated_at',
];

const FORBIDDEN_CLIENT_WRITABLE = [
  'role',
  'is_active',
  'email_verified',
  'phone_verified',
  'auth_provider',
  'auth_provider_id',
];

const readSql = (file: string) => fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
const sqlFiles = () => fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql'));

/** Strip `--` line comments so prose about grants is never mistaken for a grant. */
const stripComments = (sql: string) =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

describe('users.role privilege boundary (migration 36)', () => {
  it('the migration exists', () => {
    expect(fs.existsSync(path.join(SCHEMA_DIR, MIGRATION))).toBe(true);
  });

  it('revokes table-wide UPDATE on users from both client roles', () => {
    const sql = stripComments(readSql(MIGRATION)).toLowerCase();
    expect(sql).toMatch(/revoke\s+update\s+on\s+public\.users\s+from\s+authenticated/);
    expect(sql).toMatch(/revoke\s+update\s+on\s+public\.users\s+from\s+anon/);
  });

  it('grants back only the self-editable profile columns, and only to authenticated', () => {
    const sql = stripComments(readSql(MIGRATION));
    const grant = sql.match(/GRANT\s+UPDATE\s*\(([^)]*)\)\s*\n?\s*ON\s+public\.users\s+TO\s+([a-z_,\s]+);/i);
    expect(grant).not.toBeNull();

    const columns = grant![1].split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    const roles = grant![2].split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);

    expect(columns.sort()).toEqual([...USER_EDITABLE].sort());
    expect(roles).toEqual(['authenticated']); // anon gets nothing back
    for (const forbidden of FORBIDDEN_CLIENT_WRITABLE) {
      expect(columns).not.toContain(forbidden);
    }
  });

  it('installs the role-immutability trigger', () => {
    const sql = stripComments(readSql(MIGRATION));
    expect(sql).toMatch(/CREATE\s+TRIGGER\s+trg_users_role_immutable/i);
    expect(sql).toMatch(/BEFORE\s+UPDATE\s+ON\s+public\.users/i);
    expect(sql).toMatch(/EXECUTE\s+FUNCTION\s+public\.enforce_user_role_immutable/i);
  });

  it('keeps the trigger function SECURITY INVOKER', () => {
    // Non-negotiable: as SECURITY DEFINER, `current_user` inside the function is the
    // function OWNER, so the privileged-caller check passes for everyone and the trigger
    // fails open. This was caught during implementation, not in review.
    const fn = stripComments(readSql(MIGRATION)).match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_user_role_immutable[\s\S]*?AS\s+\$\$/i
    );
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/SECURITY\s+INVOKER/i);
    expect(fn![0]).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it('gives the UPDATE policy an explicit WITH CHECK', () => {
    const sql = stripComments(readSql(MIGRATION));
    const policy = sql.match(/CREATE\s+POLICY\s+users_update_self[\s\S]*?;/i);
    expect(policy).not.toBeNull();
    expect(policy![0]).toMatch(/WITH\s+CHECK/i);
  });

  /**
   * The regression that actually worries us: not this migration changing, but a LATER
   * one quietly handing the grant back.
   */
  it('no migration re-opens UPDATE on users to a client role', () => {
    const offenders: string[] = [];

    for (const file of sqlFiles()) {
      if (file === MIGRATION || file === SWEEP || KNOWN_BLANKET_GRANT === file) continue;
      const sql = stripComments(readSql(file));

      // Table-wide or column-level UPDATE on users granted to anon/authenticated.
      const directGrant = /GRANT[\s\S]{0,120}?\bUPDATE\b[\s\S]{0,120}?\bON\s+(public\.)?users\b[\s\S]{0,80}?\bTO\b[^;]*\b(anon|authenticated)\b/gi;
      if (directGrant.test(sql)) offenders.push(`${file}: grants UPDATE on users to a client role`);

      // The blunt instrument that would catch every table at once.
      const blanket = /GRANT\s+(ALL|UPDATE)[^;]*\bON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public[^;]*\bTO\b[^;]*\b(anon|authenticated)\b/gi;
      if (blanket.test(sql)) offenders.push(`${file}: blanket grant over schema public to a client role`);
    }

    expect(offenders).toEqual([]);
  });

  it('migration 37 closes the adjacent defects the blanket grant opened', () => {
    const sql = stripComments(readSql(SWEEP));
    // P0: the pipeline writer must not be callable by a client role. It is SECURITY
    // INVOKER, so a client caller would write with the client's own table privileges.
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.write_mobile_batch[^;]*FROM\s+PUBLIC/i);
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.write_mobile_batch[^;]*TO\s+service_role/i);
    // P1: RLS does not gate TRUNCATE — the privilege itself has to go.
    expect(sql).toMatch(/REVOKE\s+TRUNCATE[^;]*ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon/i);
    expect(sql).toMatch(/REVOKE\s+TRUNCATE[^;]*ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+authenticated/i);
    // P1: anon reads, anon never writes.
    expect(sql).toMatch(/REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon/i);
    // The part that stops it recurring for the NEXT table someone creates.
    expect(sql).toMatch(/ALTER\s+DEFAULT\s+PRIVILEGES[^;]*REVOKE[^;]*TRUNCATE/i);
  });

  it('no migration re-grants execute on the pipeline writer to a client role', () => {
    const offenders = sqlFiles().filter((file) => {
      if (file === SWEEP) return false;
      const sql = stripComments(readSql(file));
      return /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.write_mobile_batch[^;]*\b(anon|authenticated|PUBLIC)\b/i.test(sql);
    });
    expect(offenders).toEqual([]);
  });

  it('no migration drops the role-immutability trigger without replacing it', () => {
    const droppers = sqlFiles().filter((file) => {
      if (file === MIGRATION) return false;
      const sql = stripComments(readSql(file));
      const drops = /DROP\s+TRIGGER[^;]*trg_users_role_immutable/i.test(sql);
      const recreates = /CREATE\s+TRIGGER\s+trg_users_role_immutable/i.test(sql);
      return drops && !recreates;
    });
    expect(droppers).toEqual([]);
  });
});
