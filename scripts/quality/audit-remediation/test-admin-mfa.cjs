// Isolated PostgreSQL role tests. No network, credentials, enrollment or messages.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const results = [];
const admin = '00000000-0000-4000-8000-000000000001';
const customer = '00000000-0000-4000-8000-000000000002';
async function check(name, id, aal, expected) {
  await db.exec('SET ROLE authenticated');
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, aal })]);
  try {
    const r = await db.query('SELECT public.is_admin() admin, public.current_user_role() role, (SELECT count(*)::int FROM public.coupons) visible');
    assert.deepEqual(r.rows[0], expected);
    results.push({ name, passed: true });
  } finally { await db.exec('RESET ROLE'); }
}
(async () => {
  try {
    await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims', true)::jsonb $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
      CREATE TYPE public.user_role AS ENUM ('customer','admin','store','guest');
      CREATE TABLE public.users(id uuid PRIMARY KEY, role public.user_role);
      CREATE TABLE public.coupons(id int, is_active boolean);
      ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public, auth TO authenticated;
      GRANT SELECT ON public.coupons TO authenticated;
      INSERT INTO public.users VALUES ('${admin}', 'admin'), ('${customer}', 'customer');
      INSERT INTO public.coupons VALUES (1,true),(2,false);`);
    const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    for (const row of snapshot.data.functions.rows) await db.exec(row.definition);
    for (const row of snapshot.data.policies.rows.filter(p => p.tablename === 'coupons')) {
      await db.exec(`CREATE POLICY "${row.policyname}" ON public.coupons FOR ${row.cmd} USING (${row.qual})${row.with_check ? ` WITH CHECK (${row.with_check})` : ''}`);
    }
    await check('before: AAL1 admin can read inactive coupons', admin, 'aal1', { admin: true, role: 'admin', visible: 2 });
    await db.exec(fs.readFileSync(path.resolve(__dirname, '../../database/staged/65-admin-mfa-assurance.sql'), 'utf8'));
    await check('AAL1 loses administrative privilege but keeps public data', admin, 'aal1', { admin: false, role: null, visible: 1 });
    await check('missing assurance fails closed', admin, undefined, { admin: false, role: null, visible: 1 });
    await check('AAL2 restores legitimate administrator authority', admin, 'aal2', { admin: true, role: 'admin', visible: 2 });
    await check('AAL2 does not promote ordinary customer', customer, 'aal2', { admin: false, role: 'customer', visible: 1 });
    await check('ordinary AAL1 customer behavior preserved', customer, 'aal1', { admin: false, role: 'customer', visible: 1 });
    await check('factor downgrade closes administrative access again', admin, 'aal1', { admin: false, role: null, visible: 1 });
    const output = { at: new Date().toISOString(), isolation: 'PGlite fixture; JWT validation is tested separately in server tests; no real factor or recovery exercise', appliedToProduction: false, results };
    fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2));
    console.log(`${results.length} PostgreSQL MFA assertions passed`);
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
