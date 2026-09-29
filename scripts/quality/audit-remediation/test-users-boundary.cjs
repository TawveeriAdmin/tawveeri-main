// Usage: PGLITE_MODULE=/absolute/module node test-users-boundary.cjs metadata.json results.json
// Uses an isolated in-memory PostgreSQL instance; never reads application credentials.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const snapshot = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
const migration = fs.readFileSync(path.resolve(__dirname, '../../database/63-users-insert-role-boundary.sql'), 'utf8');
const db = new PGlite();
const results = [];
const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
const identifier = value => '"' + value.replace(/"/g, '""') + '"';
async function as(role, id, fn) {
  await db.exec(`SET ROLE ${identifier(role)}`);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [id || '', role]);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}
async function denied(fn, code = '42501') {
  await assert.rejects(fn, error => error.code === code);
}
async function test(name, fn) { await fn(); results.push({ name, passed: true }); }
(async () => {
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TYPE public.user_role AS ENUM ('customer','admin','store','guest');
      CREATE TYPE public.auth_provider AS ENUM ('email','phone','google','facebook','apple');
    `);
    const columns = snapshot.data.users_columns.rows.map(c => {
      const type = c.data_type === 'USER-DEFINED' ? identifier(c.udt_name) : c.data_type;
      return `${identifier(c.column_name)} ${type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`;
    });
    await db.exec(`CREATE TABLE public.users (${columns.join(',')}, PRIMARY KEY(id), FOREIGN KEY(id) REFERENCES auth.users(id), UNIQUE(email), UNIQUE(phone)); ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`);
    for (const id of ids) await db.query('INSERT INTO auth.users(id) VALUES ($1)', [id]);
    for (const f of snapshot.data.role_functions.rows) await db.exec(f.definition);
    for (const t of snapshot.data.triggers.rows.filter(t => t.nspname === 'public')) {
      await db.exec(t.function_definition);
      await db.exec(t.definition);
    }
    for (const p of snapshot.data.policies.rows.filter(p => p.tablename === 'users')) {
      const roles = p.roles.replace(/[{}]/g, '').split(',').map(identifier).join(',');
      await db.exec(`CREATE POLICY ${identifier(p.policyname)} ON public.users AS ${p.permissive} FOR ${p.cmd} TO ${roles}${p.qual ? ' USING (' + p.qual + ')' : ''}${p.with_check ? ' WITH CHECK (' + p.with_check + ')' : ''}`);
    }
    for (const g of snapshot.data.table_grants.rows.filter(g => g.table_name === 'users' && ['anon', 'authenticated', 'service_role'].includes(g.grantee))) {
      await db.exec(`GRANT ${g.privilege_type} ON public.users TO ${identifier(g.grantee)}`);
    }
    for (const g of snapshot.data.column_grants.rows) await db.exec(`GRANT ${g.privilege_type} (${identifier(g.column_name)}) ON public.users TO ${identifier(g.grantee)}`);

    await test('before: authenticated missing-profile user can select admin role in isolated clone', async () => {
      await as('authenticated', ids[0], () => db.query("INSERT INTO public.users(id,role) VALUES($1,'admin') RETURNING role", [ids[0]]).then(r => assert.equal(r.rows[0].role, 'admin')));
      await db.query('DELETE FROM public.users WHERE id=$1', [ids[0]]);
    });
    await db.exec(migration);
    await test('migration is safely repeatable', () => db.exec(migration));
    await test('anon INSERT denied', () => as('anon', '', () => denied(() => db.query('INSERT INTO public.users(id) VALUES($1)', [ids[0]]))));
    await test('authenticated admin INSERT denied; no resulting row', async () => {
      await as('authenticated', ids[0], () => denied(() => db.query("INSERT INTO public.users(id,role) VALUES($1,'admin')", [ids[0]])));
      assert.equal((await db.query('SELECT count(*)::int n FROM public.users')).rows[0].n, 0);
    });
    await test('ordinary profile with explicit customer role persists', () => as('authenticated', ids[0], async () => {
      const r = await db.query("INSERT INTO public.users(id,role,full_name,email_verified) VALUES($1,'customer','Fixture',true) RETURNING id,role,full_name", [ids[0]]);
      assert.deepEqual(r.rows, [{ id: ids[0], role: 'customer', full_name: 'Fixture' }]);
    }));
    await test('default customer persists', () => as('authenticated', ids[1], async () => {
      const r = await db.query('INSERT INTO public.users(id) VALUES($1) RETURNING role', [ids[1]]);
      assert.equal(r.rows[0].role, 'customer');
    }));
    await test('another user profile INSERT denied', () => as('authenticated', ids[0], () => denied(() => db.query('INSERT INTO public.users(id) VALUES($1)', [ids[2]]))));
    await test('duplicate INSERT cannot create a second row', () => as('authenticated', ids[0], () => denied(() => db.query('INSERT INTO public.users(id) VALUES($1)', [ids[0]]), '23505')));
    await test('legitimate UPSERT updates allowed profile field and preserves role', () => as('authenticated', ids[0], async () => {
      const r = await db.query("INSERT INTO public.users(id,full_name) VALUES($1,'Updated') ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name RETURNING role,full_name", [ids[0]]);
      assert.deepEqual(r.rows, [{ role: 'customer', full_name: 'Updated' }]);
    }));
    await test('malicious UPSERT role denied', () => as('authenticated', ids[0], () => denied(() => db.query("INSERT INTO public.users(id,role) VALUES($1,'admin') ON CONFLICT(id) DO UPDATE SET role=excluded.role", [ids[0]]))));
    await test('role UPDATE remains denied', () => as('authenticated', ids[0], () => denied(() => db.query("UPDATE public.users SET role='admin' WHERE id=$1", [ids[0]]))));
    await test('allowed profile UPDATE persists', () => as('authenticated', ids[0], async () => {
      const r = await db.query("UPDATE public.users SET full_name='Allowed' WHERE id=$1 RETURNING full_name,role", [ids[0]]);
      assert.deepEqual(r.rows, [{ full_name: 'Allowed', role: 'customer' }]);
    }));
    await test('extra permissive INSERT policy cannot reopen boundary', async () => {
      await db.exec('CREATE POLICY fixture_broad_insert ON public.users FOR INSERT TO authenticated WITH CHECK(true)');
      await as('authenticated', ids[0], () => denied(() => db.query('INSERT INTO public.users(id) VALUES($1)', [ids[2]])));
      await as('authenticated', ids[2], () => denied(() => db.query("INSERT INTO public.users(id,role) VALUES($1,'store')", [ids[2]])));
    });
    await test('spoofed request role setting does not bypass SQL execution role', () => as('authenticated', ids[2], async () => {
      await db.exec("SET request.jwt.claim.role='service_role'");
      await denied(() => db.query("INSERT INTO public.users(id,role) VALUES($1,'admin')", [ids[2]]));
    }));
    await test('invoker RPC cannot escalate', async () => {
      await db.exec("CREATE FUNCTION public.fixture_insert_admin(who uuid) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$ INSERT INTO public.users(id,role) VALUES(who,'admin') $$");
      await as('authenticated', ids[2], () => denied(() => db.query('SELECT public.fixture_insert_admin($1)', [ids[2]])));
    });
    await test('trusted service-role administrative creation and update persist', () => as('service_role', '', async () => {
      assert.equal((await db.query("INSERT INTO public.users(id,role) VALUES($1,'admin') RETURNING role", [ids[3]])).rows[0].role, 'admin');
      assert.equal((await db.query("UPDATE public.users SET role='store' WHERE id=$1 RETURNING role", [ids[3]])).rows[0].role, 'store');
    }));
    const output = { at: new Date().toISOString(), runtime: (await db.query('SELECT version()')).rows[0], mode: 'in-memory isolated PostgreSQL; SQL roles and live metadata clone; no production writes or external access', results };
    fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(output, null, 2));
    console.log(`${results.length} isolated PostgreSQL boundary checks passed`);
  } finally { await db.close(); }
})().catch(error => { console.error({ name: error.name, code: error.code, message: error.message }); process.exitCode = 1; });
