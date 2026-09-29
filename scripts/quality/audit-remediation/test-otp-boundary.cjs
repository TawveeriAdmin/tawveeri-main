/* eslint-disable @typescript-eslint/no-require-imports */
// Usage: PGLITE_MODULE=/absolute/module node test-otp-boundary.cjs results.json
// PGlite serializes SQL on one connection. Promise.all below exercises concurrent
// requests at that boundary, not multi-session PostgreSQL lock contention.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const results = [];
const account = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
let id = 0;
const insert = async (purpose = 'password_reset', extra = {}) => {
  const record = { id: `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`, phone: 'fixture', otp_code: '123456', expires_at: new Date(Date.now() + 300000).toISOString(), purpose, account_id: account, ...extra };
  await db.query(`INSERT INTO public.phone_otps(${Object.keys(record).join(',')}) VALUES(${Object.keys(record).map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(record));
};
const consume = async (code = '123456', purpose = 'password_reset', who = account, commit = true) =>
  (await db.query('SELECT public.consume_phone_otp($1,$2,$3,$4,$5) ok', ['fixture', code, purpose, who, commit])).rows[0].ok;
const test = async (name, fn) => { await db.exec('RESET ROLE; TRUNCATE public.phone_otps'); await fn(); results.push({ name, passed: true }); };
(async () => {
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE TABLE public.phone_otps(id uuid PRIMARY KEY,phone varchar NOT NULL,otp_code varchar NOT NULL,
        expires_at timestamptz NOT NULL,is_used boolean NOT NULL DEFAULT false,attempts int NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT clock_timestamp(),verified_at timestamptz);
      GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
      GRANT SELECT,INSERT,UPDATE ON public.phone_otps TO service_role;
      ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.phone_otps FORCE ROW LEVEL SECURITY;
    `);
    const sql = fs.readFileSync(path.resolve(__dirname, '../../database/64-atomic-purpose-bound-otp.sql'), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    await test('only one of two concurrently submitted consumption requests succeeds', async () => {
      await insert(); await db.exec('SET ROLE service_role');
      assert.deepEqual((await Promise.all([consume(), consume()])).sort(), [false, true]);
      assert.equal(await consume(), false);
    });
    await test('expired code is rejected', async () => { await insert('password_reset', { expires_at: '2000-01-01T00:00:00Z' }); assert.equal(await consume(), false); });
    await test('wrong purpose and wrong account are rejected', async () => {
      await insert(); assert.equal(await consume('123456', 'phone_signin'), false);
      assert.equal(await consume('123456', 'password_reset', other), false);
      assert.equal(await consume(), true);
    });
    await test('five wrong attempts exhaust the challenge', async () => {
      await insert(); for (let i = 0; i < 5; i++) assert.equal(await consume('000000'), false);
      assert.equal(await consume(), false);
      assert.equal((await db.query('SELECT attempts FROM public.phone_otps')).rows[0].attempts, 5);
    });
    await test('latest used challenge never falls back to an older unused code', async () => {
      await insert('password_reset', { created_at: '2026-01-01T00:00:00Z' });
      await insert('password_reset', { is_used: true }); assert.equal(await consume(), false);
    });
    await test('legacy challenge cannot authenticate in any new purpose', async () => {
      await insert('legacy'); assert.equal(await consume(), false); assert.equal(await consume('123456', 'legacy'), false);
    });
    await test('signup preview does not consume; final authentication consumes once', async () => {
      await insert('phone_signin', { account_id: null });
      assert.equal(await consume('123456', 'phone_signin', null, false), true);
      assert.equal(await consume('123456', 'phone_signin', null, true), true);
      assert.equal(await consume('123456', 'phone_signin', null, true), false);
    });
    await test('reset cannot authenticate an unbound account', async () => {
      await insert('password_reset', { account_id: null }); assert.equal(await consume('123456', 'password_reset', null), false);
    });
    await test('anon and authenticated cannot invoke private consumption RPC', async () => {
      await insert(); for (const role of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        await assert.rejects(() => consume(), error => error.code === '42501');
        await db.exec('RESET ROLE');
      }
    });
    const output = { at: new Date().toISOString(), postgres: (await db.query('SELECT version()')).rows[0], concurrencyScope: 'Concurrent promises on PGlite single serialized connection; live multi-session contention not exercised', results };
    if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(output, null, 2));
    console.log(`${results.length} isolated OTP checks passed`);
  } finally { await db.close(); }
})().catch(error => { console.error({ name: error.name, code: error.code, message: error.message }); process.exitCode = 1; });
