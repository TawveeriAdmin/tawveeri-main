// F7 — DURABLE VALIDATION LOG SINK (ADR-160).
//
// THE ONE RULE THIS FILE EXISTS TO OBEY: logging is observability, never a dependency of the
// guard. Nothing here can change a verdict, delay a response, or throw into the answer path. If
// the database is unreachable, slow, or gone, the validator still suppresses and the customer
// still gets the deterministic answer. A guard that stops guarding because its logger is down
// has inverted its own purpose.
//
// That is enforced structurally, not by care:
//   • the insert is FIRE-AND-FORGET — never awaited by the caller, so it cannot add latency;
//   • every failure path ends in a swallowed catch, so it cannot throw;
//   • `recordValidationEvent` calls this AFTER the verdict exists, and the route reads the
//     VERDICT to decide, never this function's result. There is no value here to depend on.
//
// WHY DIRECT `pg` AND NOT THE SUPABASE CLIENT: the table lives in `observability`, a schema
// PostgREST does not expose. That keeps it out of the REST schema cache entirely and out of
// reach of `anon` under any misconfiguration. `api/debug/scheduler` already takes this path, so
// it is a pattern the app has, not one this introduces.
import type { ValidationEvent } from './validation-log';

type PoolLike = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
  end: () => Promise<void>;
};

let pool: PoolLike | null = null;
let poolFailed = false;

/**
 * ON by default in production, OFF in tests.
 *
 * `.env.local` carries a real production DSN and jest loads it, so a default-on sink would have
 * every test run writing to the production log. Silent test pollution of the exact table used to
 * answer "was the guard running?" would poison the only record that matters.
 */
function durableEnabled(): boolean {
  if (process.env.VALIDATION_LOG_DURABLE === '0') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return Boolean(process.env.SUPABASE_DB_URL);
}

function getPool(): PoolLike | null {
  if (pool || poolFailed) return pool;
  try {
    // Required lazily so that importing the vocabulary never pulls `pg` into a bundle that does
    // not need it — this module is imported by the same barrel client code touches.
    const { Pool } = require('pg') as typeof import('pg');
    const { toPoolerDbUrl } = require('../../../scripts/tps-core/pooler-url') as {
      toPoolerDbUrl: (u?: string) => string;
    };
    pool = new Pool({
      connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL),
      ssl: { rejectUnauthorized: false },
      max: 2,                       // observability must never compete for connections
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // A slow log must not become a slow answer. The insert is not awaited anyway; this bounds
      // how long a stuck statement can hold one of the two connections.
      statement_timeout: 5_000,
    }) as unknown as PoolLike;
    return pool;
  } catch {
    // `pg` missing, DSN unparseable, anything: give up permanently and stay silent. Retrying on
    // every event would turn a broken logger into a hot loop on the answer path.
    poolFailed = true;
    return null;
  }
}

const INSERT = `
  insert into observability.validation_events
    (occurred_at, outcome, surface, query, generated, generated_truncated,
     violated_rules, findings, unavailable_reason, decision, vocabulary_version, fingerprint)
  values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
`;

/**
 * Record one event durably. Returns immediately; the write happens in the background.
 *
 * NEVER THROWS, NEVER AWAITS. The signature is `void` on purpose — there is no result for a
 * caller to branch on, so no caller can accidentally make the guard depend on the log.
 */
export function writeDurableValidationEvent(event: ValidationEvent): void {
  if (!durableEnabled()) return;
  const p = getPool();
  if (!p) return;
  try {
    void p
      .query(INSERT, [
        event.timestamp,
        event.outcome,
        event.surface,
        event.query,
        event.generated,
        event.generatedTruncated,
        event.violatedRules,
        JSON.stringify(event.findings ?? []),
        event.unavailableReason ?? null,
        event.decision,
        event.vocabularyVersion,
        event.fingerprint,
      ])
      // A rejected promise with no handler is an unhandled rejection, which on some runtimes
      // takes the process down — the loudest possible way for a LOGGER to break a product.
      .catch((err: unknown) => {
        console.warn('[f7-validation] durable sink write failed:', err instanceof Error ? err.message : String(err));
      });
  } catch (err) {
    console.warn('[f7-validation] durable sink threw synchronously:', err instanceof Error ? err.message : String(err));
  }
}

/** Test/operator hook: close the pool. Safe to call when none was ever created. */
export async function closeDurableSink(): Promise<void> {
  const p = pool;
  pool = null;
  poolFailed = false;
  if (p) { try { await p.end(); } catch { /* already closed */ } }
}
