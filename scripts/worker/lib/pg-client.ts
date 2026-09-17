// scripts/worker/lib/pg-client.ts
//
// Shared `pg` require + minimal type shim. This project has no @types/pg
// (matches the existing convention in scripts/tps-core/samsung-delta-watch.ts,
// which casts `Client` the same way rather than adding a new dependency) —
// centralized here once instead of repeated in every worker file that opens
// its own short-lived connection.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require('pg');

export type PgClient = {
  connect: () => Promise<void>;
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
  on: (event: 'error' | 'end', cb: (arg?: unknown) => void) => void;
};

export function newPgClient(config: Record<string, unknown>): PgClient {
  return new pg.Client(config) as PgClient;
}
