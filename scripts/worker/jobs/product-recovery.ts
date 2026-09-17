// scripts/worker/jobs/product-recovery.ts
//
// Direct replacement for scheduler.js's runProductRecovery() (was an HTTP
// self-call to /api/cron/product-recovery). Imports the exact matching/
// ingestion logic (`processOne`, `PROVIDER_CASCADE`, `BATCH_SIZE`, etc.) from
// the route file itself — those were exported specifically for this reuse
// (2026-09-17) so there is exactly one implementation of the recovery
// cascade, used by both the HTTP route (manual/admin trigger) and this
// worker job (scheduled trigger).

import { createServerClient } from '../../../src/lib/database';
import {
  processOne,
  MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE,
  BATCH_SIZE,
  type RecoveryRow,
  type UntypedClient,
} from '../../../src/app/api/cron/product-recovery/route';

async function main() {
  const supabase = createServerClient() as unknown as UntypedClient;

  const { data: rows, error } = await (supabase as any)
    .from('product_recovery_requests')
    .select('id, dedup_key, category, raw_query, normalized_query, attempt_count, provider_attempts')
    .in('status', ['PENDING', 'RETRYABLE_FAILURE'])
    .lt('attempt_count', MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`product_recovery_requests select failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    console.log('[worker:product-recovery] nothing pending');
    return;
  }

  console.log(`[worker:product-recovery] processing ${rows.length} request(s)`);
  for (const row of rows as RecoveryRow[]) {
    const result = await processOne(supabase, row);
    console.log(`[worker:product-recovery] ${result.id}: ${result.status} (${result.attempts} attempt(s))`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:product-recovery] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
