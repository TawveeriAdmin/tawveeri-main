// scripts/worker/jobs/dispatch-sweep.ts
//
// Owns the two real workloads that used to live inside POST /api/cron/dispatch
// and run DETACHED inside tawveeri-main after the HTTP response returned
// (discovered during the isolated-worker migration audit — not one of the
// originally-enumerated 7 jobs, but a real one: a normalize/corroborate sweep
// of up to 500 raw_observations every 15 minutes, plus a daily coverage
// snapshot). Both are now run directly, awaited, bounded by this job's own
// timeout in the worker supervisor — never fire-and-forget inside a web
// request again.
//
// dispatchDueSchedules() itself is intentionally NOT called here — it is
// thin and safe to keep on the HTTP route (manual/admin trigger path,
// scraping_schedules is a near-empty stub in production) and is not heavy
// execution in the sense this migration is about.

import { maybeProgressiveSweep, maybeCoverageSnapshot } from '../../../src/app/api/cron/dispatch/route';

async function main() {
  const sweep = await maybeProgressiveSweep();
  console.log(`[worker:dispatch-sweep] progressive sweep: ran=${sweep.ran} scanned=${sweep.scanned ?? 0}`);

  const snapshot = await maybeCoverageSnapshot();
  console.log(`[worker:dispatch-sweep] coverage snapshot: wrote=${snapshot.wrote}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:dispatch-sweep] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
