// scripts/worker/lib/global-lock.ts
//
// WHY (founder directive, 2026-09-17 isolated-worker migration): "Verify the
// advisory-lock connection uses a direct or session-compatible database
// connection, not transaction pooling. Hold the lock for the full job
// lifetime. On lock-connection loss, stop the job and its descendants before
// further processing."
//
// PROVEN LIVE (read-only test, 2026-09-17): the pooler URL produced by
// scripts/tps-core/pooler-url.js always targets port 5432 — Supabase's
// SESSION pooler (Supavisor session mode), not the 6543 transaction pooler.
// A live two-connection test confirmed pg_advisory_lock is held correctly
// across separate statements on the same client and correctly blocks a
// second client until released. Do not point this at any other connection
// string without re-verifying the same way — a transaction-pooled connection
// would silently make this lock meaningless (the underlying backend can
// change between statements, so "held" and "acquired" stop being reliable).
//
// This is intentionally ONE shared lock key for every heavy job, not one key
// per job type — the founder's requirement is "one heavy job globally at a
// time", not "one of each job type at a time". Using a single key makes that
// requirement true by construction rather than by convention.

import { newPgClient } from './pg-client';

// Arbitrary but STABLE int4 key. Never reuse this constant for anything else;
// changing it silently creates a second, uncoordinated lock namespace.
export const GLOBAL_HEAVY_JOB_LOCK_KEY = 748219001;

export interface GlobalLock {
  /** Release the advisory lock and close the connection. Idempotent. */
  release: () => Promise<void>;
  /** Register a callback fired once if the lock connection errors or closes
   *  unexpectedly (network blip, pooler restart, etc.) — the caller MUST
   *  treat this as "the lock may no longer be held" and kill whatever job
   *  is running under it rather than let it continue unprotected. */
  onLost: (cb: (reason: string) => void) => void;
  /** True once onLost has fired. */
  isLost: () => boolean;
}

/**
 * Try to acquire the single global heavy-job lock. Returns null (not an
 * error) if another holder already has it — that is the expected, normal
 * "something else is running" case, not a failure.
 */
export async function acquireGlobalLock(connectionString: string): Promise<GlobalLock | null> {
  const client = newPgClient({
    connectionString,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  await client.connect();

  const { rows } = await client.query('select pg_try_advisory_lock($1) as ok', [GLOBAL_HEAVY_JOB_LOCK_KEY]);
  if (!rows[0]?.ok) {
    await client.end().catch(() => {});
    return null;
  }

  let lost = false;
  let released = false; // set BEFORE client.end() in release() below, so the
                         // 'end' event a clean release itself triggers does
                         // NOT get misreported as an unexpected loss — this
                         // was caught live (2026-09-17): an early version
                         // fired onLost on every normal release because
                         // client.end() emits 'end' unconditionally.
  const lostCallbacks: Array<(reason: string) => void> = [];
  const fireLost = (reason: string) => {
    if (lost || released) return;
    lost = true;
    for (const cb of lostCallbacks) {
      try { cb(reason); } catch { /* never let a listener crash the guard */ }
    }
  };
  client.on('error', (e: unknown) => fireLost(`connection error: ${(e as { message?: string })?.message || e}`));
  client.on('end', () => fireLost('connection closed'));

  return {
    release: async () => {
      if (released || lost) return;
      released = true; // must be set before client.end() — see comment above
      try {
        await client.query('select pg_advisory_unlock($1)', [GLOBAL_HEAVY_JOB_LOCK_KEY]);
      } catch { /* best-effort — closing the connection below also drops a session-held lock */ }
      try { await client.end(); } catch { /* ignore */ }
    },
    onLost: (cb) => lostCallbacks.push(cb),
    isLost: () => lost,
  };
}
