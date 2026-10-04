// scripts/tps-analysis/rehearsal/start.ts — idempotent: start local Postgres 17 + PostgREST + proxy.
//   npx tsx scripts/tps-analysis/rehearsal/start.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { Client } from "pg";
import {
  DATA, PGDATA, BIN, PG_BIN, DIR, PG_PORT, REST_PORT, PROXY_PORT, DB_NAME, PG_SUPERUSER, DB_MAX_ROWS,
  loadSecrets, serviceKey, readPids, writePids, sleep, httpOk, localDbUrl, LOCAL_URL, type Pids, type PidRecord,
} from "./lib";

const POSTGREST_VERSION = "v13.0.8";
const POSTGREST_ZIP = `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-windows-x86-64.zip`;

export function pidAlive(rec?: PidRecord): boolean {
  if (!rec) return false;
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${rec.pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" });
    return out.toLowerCase().includes(`"${rec.image.toLowerCase()}"`);
  } catch { return false; }
}

async function pgReady(db = "postgres"): Promise<boolean> {
  const c = new Client({ connectionString: localDbUrl(db), connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.query("select 1"); await c.end(); return true; } catch { try { await c.end(); } catch { /* */ } return false; }
}

function ensurePostgrestBinary() {
  const exe = path.join(BIN, "postgrest.exe");
  if (fs.existsSync(exe)) return;
  fs.mkdirSync(BIN, { recursive: true });
  const zip = path.join(BIN, "postgrest.zip");
  console.log(`downloading PostgREST ${POSTGREST_VERSION} ...`);
  execFileSync("curl", ["-sL", "-o", zip, POSTGREST_ZIP], { stdio: "inherit" });
  execFileSync("tar", ["-xf", zip, "-C", BIN], { stdio: "inherit" });
  if (!fs.existsSync(exe)) throw new Error("postgrest.exe not found after extract");
}

function initCluster() {
  if (fs.existsSync(path.join(PGDATA, "PG_VERSION"))) return;
  fs.mkdirSync(PGDATA, { recursive: true });
  console.log("initdb ...");
  const r = spawnSync(path.join(PG_BIN, "initdb.exe"), ["-D", PGDATA, "-U", PG_SUPERUSER, "-A", "trust", "-E", "UTF8", "--locale=C"], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("initdb failed");
  fs.appendFileSync(path.join(PGDATA, "postgresql.conf"), `
# --- tps-rehearsal (disposable; durability traded for speed) ---
port = ${PG_PORT}
listen_addresses = '127.0.0.1'
max_connections = 100
shared_buffers = 256MB
work_mem = 32MB
maintenance_work_mem = 256MB
fsync = off
synchronous_commit = off
full_page_writes = off
max_wal_size = 512MB
min_wal_size = 80MB
checkpoint_timeout = 15min
log_min_messages = warning
timezone = 'UTC'
log_timezone = 'UTC'
`);
}

function spawnDetached(image: string, cmd: string, args: string[], logName: string, env: NodeJS.ProcessEnv = process.env): PidRecord {
  const out = fs.openSync(path.join(DATA, logName), "a");
  const child = spawn(cmd, args, { detached: true, stdio: ["ignore", out, out], windowsHide: true, env });
  child.unref();
  if (!child.pid) throw new Error(`failed to spawn ${image}`);
  return { pid: child.pid, image, started: new Date().toISOString() };
}

async function ensureRolesAndDb() {
  const admin = new Client({ connectionString: localDbUrl("postgres") });
  await admin.connect();
  const { authenticatorPassword } = loadSecrets();
  const exists = await admin.query("select 1 from pg_database where datname=$1", [DB_NAME]);
  if (!exists.rowCount) await admin.query(`create database ${DB_NAME}`);
  await admin.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit password '${authenticatorPassword}'; end if;
    end $$;`);
  await admin.query(`alter role authenticator with password '${authenticatorPassword}'`);
  await admin.query("grant anon, authenticated, service_role to authenticator");
  // Production role timeouts (CLAUDE.md, ADR-099): authenticator 30s, API roles 20s.
  await admin.query("alter role authenticator set statement_timeout = '30s'");
  for (const r of ["anon", "authenticated", "service_role"]) await admin.query(`alter role ${r} set statement_timeout = '20s'`);
  await admin.end();
}

function writePostgrestConf(): string {
  const { jwtSecret, authenticatorPassword } = loadSecrets();
  const conf = `db-uri = "postgres://authenticator:${authenticatorPassword}@127.0.0.1:${PG_PORT}/${DB_NAME}"
db-schemas = "public"
db-anon-role = "anon"
db-max-rows = ${DB_MAX_ROWS}
db-pool = 10
jwt-secret = "${jwtSecret}"
server-host = "127.0.0.1"
server-port = ${REST_PORT}
`;
  const p = path.join(DATA, "postgrest.conf");
  fs.writeFileSync(p, conf);
  return p;
}

export async function start() {
  fs.mkdirSync(DATA, { recursive: true });
  ensurePostgrestBinary();
  initCluster();
  const pids: Pids = readPids();

  // 1. Postgres
  if (!(await pgReady())) {
    if (pidAlive(pids.postgres)) throw new Error(`postgres pid ${pids.postgres!.pid} alive but port ${PG_PORT} not answering — inspect ${path.join(DATA, "postgres.log")}`);
    console.log("starting postgres ...");
    pids.postgres = spawnDetached("postgres.exe", path.join(PG_BIN, "postgres.exe"), ["-D", PGDATA], "postgres.log");
    writePids(pids);
    for (let i = 0; i < 60 && !(await pgReady()); i++) await sleep(500);
    if (!(await pgReady())) throw new Error("postgres did not become ready (see .data/postgres.log)");
  } else console.log("postgres already up");
  await ensureRolesAndDb();

  const key = serviceKey();
  // 2. PostgREST
  if (!(await httpOk(`http://127.0.0.1:${REST_PORT}/`, 1500, { apikey: key, Authorization: `Bearer ${key}` }))) {
    console.log("starting postgrest ...");
    const conf = writePostgrestConf();
    pids.postgrest = spawnDetached("postgrest.exe", path.join(BIN, "postgrest.exe"), [conf], "postgrest.log", { ...process.env, PATH: `${PG_BIN};${process.env.PATH}` });
    writePids(pids);
    for (let i = 0; i < 60 && !(await httpOk(`http://127.0.0.1:${REST_PORT}/`, 1500, { apikey: key, Authorization: `Bearer ${key}` })); i++) await sleep(500);
  } else console.log("postgrest already up");

  // 3. proxy
  if (!(await httpOk(`${LOCAL_URL}/rest/v1/`, 1500, { apikey: key, Authorization: `Bearer ${key}` }))) {
    console.log("starting proxy ...");
    pids.proxy = spawnDetached("node.exe", process.execPath, [path.join(DIR, "proxy.cjs")], "proxy.log", { ...process.env, PROXY_PORT: String(PROXY_PORT), REST_PORT: String(REST_PORT) });
    writePids(pids);
    for (let i = 0; i < 40 && !(await httpOk(`${LOCAL_URL}/rest/v1/`, 1500, { apikey: key, Authorization: `Bearer ${key}` })); i++) await sleep(500);
  } else console.log("proxy already up");

  const ok = await httpOk(`${LOCAL_URL}/rest/v1/`, 3000, { apikey: key, Authorization: `Bearer ${key}` });
  if (!ok) throw new Error(`stack not healthy via ${LOCAL_URL}/rest/v1/ (see .data/postgrest.log, .data/proxy.log)`);
  console.log(`READY  postgres=127.0.0.1:${PG_PORT}/${DB_NAME}  postgrest=127.0.0.1:${REST_PORT}  supabase-url=${LOCAL_URL}`);
}

if (require.main === module) start().catch((e) => { console.error("start failed:", e.message); process.exit(1); });
