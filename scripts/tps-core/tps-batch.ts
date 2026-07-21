// scripts/tps-core/tps-batch.ts
// Shared contract for scheduler-invokable, hard-bounded TPS batches.
// Category-isolated: a mobile invocation can only touch mobile canonicals,
// an AC invocation only air_conditioner. Total observations can never exceed 500.

export type TpsCategory = 'mobile' | 'air_conditioner' | 'laptop';

export const TPS_MAX_OBSERVATIONS = 500;
export const TPS_MIN_OBSERVATIONS = 1;

export interface TpsBatchOptions {
  category: TpsCategory;
  dryRun: boolean;
  /** TOTAL observation cap for the run; must be 1..500. Split across the category's stores. */
  limit: number;
  /** Production project ref that must match, e.g. 'vyceqrzttspyycdpojtn'. */
  expectedFingerprint: string;
  /** 'schedule' | 'manual' | 'api' */
  source?: string;
  runId?: number | null;
  /** Local-only: write candidate IDs to this path (never in production). */
  dumpIdsPath?: string;
}

export interface TpsBatchResult {
  category: TpsCategory;
  requestedLimit: number;
  effectiveHardLimit: number;
  fetched: number;
  considered: number;
  parserFailures: number;
  lowConfidence: number;
  conflicts: number;
  proposedCanonicals: number;
  writtenCanonicals: number;
  normalized: number;
  matches: number;
  prices: number;
  statusUpdates: number;
  skipped: number;
  durationMs: number;
  success: boolean;
  dryRun: boolean;
  error: string | null;
}

/** Validate the bound invariants BEFORE any fetch/write. Throws on violation. */
export function assertBatchInvariants(opts: TpsBatchOptions): void {
  if (opts.category !== 'mobile' && opts.category !== 'air_conditioner' && opts.category !== 'laptop') {
    throw new Error(`invalid category: ${opts.category}`);
  }
  if (!Number.isInteger(opts.limit)) throw new Error('limit must be an integer');
  if (opts.limit > TPS_MAX_OBSERVATIONS) throw new Error(`limit ${opts.limit} exceeds hard bound ${TPS_MAX_OBSERVATIONS}`);
  if (opts.limit < TPS_MIN_OBSERVATIONS) throw new Error(`limit ${opts.limit} below minimum ${TPS_MIN_OBSERVATIONS}`);
  if (!opts.expectedFingerprint) throw new Error('expectedFingerprint required');
}

/** Verify the live Supabase URL matches the expected production project ref. */
export function assertFingerprint(supabaseUrl: string, expected: string): void {
  let host = '';
  try { host = new URL(supabaseUrl).host; } catch { /* ignore */ }
  if (!host.startsWith(expected + '.')) {
    throw new Error(`production fingerprint mismatch (expected ${expected})`);
  }
}

/** Per-store fetch cap so the SUM across a category's stores cannot exceed `limit`. */
export function perStoreLimit(limit: number, storeCount: number): number {
  return Math.max(1, Math.floor(limit / Math.max(1, storeCount)));
}
