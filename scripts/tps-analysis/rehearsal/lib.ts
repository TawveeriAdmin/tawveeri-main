// scripts/tps-analysis/rehearsal/lib.ts
// Shared plumbing for the LOCAL, DISPOSABLE TPS rehearsal replica.
// Nothing in this directory ever writes to production: the production connection helper
// below opens a read-only session and refuses any statement that is not a read.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { Client } from "pg";

export const DIR = __dirname;
export const REPO = path.resolve(DIR, "../../..");
export const DATA = path.join(DIR, ".data");
export const PGDATA = path.join(DATA, "pgdata");
export const BIN = path.join(DIR, "bin");
export const PG_BIN = path.join(DIR, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
export const PIDS_FILE = path.join(DATA, "pids.json");
export const SECRETS_FILE = path.join(DATA, "secrets.json");

export const PG_PORT = 54329;
export const REST_PORT = 54330; // PostgREST (root-served)
export const PROXY_PORT = 54331; // supabase-js entry point: /rest/v1/* -> PostgREST /*
export const DB_NAME = "tps";
export const PG_SUPERUSER = "postgres";
export const LOCAL_URL = `http://127.0.0.1:${PROXY_PORT}`;
// Production PostgREST truncates at db-max-rows (ADR-172); mirror it.
export const DB_MAX_ROWS = 1000;

export interface Secrets { jwtSecret: string; authenticatorPassword: string }

export function loadSecrets(): Secrets {
  fs.mkdirSync(DATA, { recursive: true });
  if (fs.existsSync(SECRETS_FILE)) return JSON.parse(fs.readFileSync(SECRETS_FILE, "utf8"));
  const s: Secrets = { jwtSecret: crypto.randomBytes(32).toString("hex"), authenticatorPassword: crypto.randomBytes(12).toString("hex") };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(s, null, 2));
  return s;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
/** Tiny HS256 JWT (no dependency). Used to mint the LOCAL service_role key. */
export function mintJwt(secret: string, role: string): string {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ role, iss: "tps-rehearsal-local", iat: 1_700_000_000, exp: 4_102_444_800 }));
  const sig = b64u(crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function serviceKey(): string { return mintJwt(loadSecrets().jwtSecret, "service_role"); }

export function localDbUrl(db = DB_NAME, user = PG_SUPERUSER): string {
  return `postgres://${user}@127.0.0.1:${PG_PORT}/${db}`;
}

export async function localClient(db = DB_NAME): Promise<Client> {
  const c = new Client({ connectionString: localDbUrl(db) });
  await c.connect();
  return c;
}

// ── Production (READ-ONLY) ───────────────────────────────────────────────────────────────
const READ_OK = /^\s*(select|with|show|begin\s+read\s+only|rollback|set\s+(statement_timeout|default_transaction_read_only|session\s+characteristics)|explain)\b/i;
export interface ProdClient { query: (sql: string, params?: unknown[]) => Promise<any[]>; end: () => Promise<void>; raw: Client }

/** Opens a read-only session against PRODUCTION (SUPABASE_DB_URL via the pooler helper).
 *  Defence in depth: session default_transaction_read_only=on AND a JS guard that refuses any
 *  non-read statement. */
export async function prodClient(statementTimeoutMs = 60_000): Promise<ProdClient> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config({ path: path.join(REPO, ".env.local"), quiet: true });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toPoolerDbUrl } = require(path.join(REPO, "scripts", "tps-core", "pooler-url.js"));
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) throw new Error("SUPABASE_DB_URL not set (expected in .env.local)");
  const url = toPoolerDbUrl(raw);
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const guard = async (sql: string, params?: unknown[]) => {
    if (!READ_OK.test(sql)) throw new Error(`REFUSED non-read statement against production: ${sql.slice(0, 80)}`);
    return (await c.query(sql, params as any[])).rows;
  };
  await guard(`set statement_timeout = ${Math.floor(statementTimeoutMs)}`);
  await guard("set default_transaction_read_only = on");
  const ro = await guard("show default_transaction_read_only");
  if (ro[0].default_transaction_read_only !== "on") throw new Error("could not establish a read-only production session");
  return { query: guard, end: () => c.end(), raw: c };
}

// ── Process bookkeeping (we only ever stop what we started, by recorded PID) ────────────
export interface PidRecord { pid: number; image: string; started: string }
export type Pids = Partial<Record<"postgres" | "postgrest" | "proxy", PidRecord>>;
export function readPids(): Pids { try { return JSON.parse(fs.readFileSync(PIDS_FILE, "utf8")); } catch { return {}; } }
export function writePids(p: Pids) { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(PIDS_FILE, JSON.stringify(p, null, 2)); }

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function httpOk(url: string, timeoutMs = 2000, headers: Record<string, string> = {}): Promise<boolean> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctl.signal, headers }); clearTimeout(t);
    return r.status < 500;
  } catch { return false; }
}

export function fmtMs(ms: number): string { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }
