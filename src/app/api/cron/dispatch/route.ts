import { NextRequest, NextResponse } from 'next/server';
import { dispatchDueSchedules } from '@/lib/scraping/services/schedule-dispatcher';
import { createServerClient } from '@/lib/database';
import { runSweepUnit } from '../../../../../scripts/tps-core/progressive-engine';
import { CATEGORY_DEFS } from '../../../../../scripts/tps-core/category-registry';
import { writeCoverageSnapshot } from '@/lib/intelligence/coverage-ledger';

// E15.5 — daily Coverage Ledger snapshot (throttled marker '_ledger_tick'/store 0).
const LEDGER_INTERVAL_S = 86400; // 24h
// Exported (2026-09-17, isolated-worker migration): this used to run DETACHED
// inside tawveeri-main after the HTTP response returned (fire-and-forget,
// invisible to the caller) — a real, DB-heavy background workload discovered
// during the worker migration audit, not one of the originally-enumerated
// jobs. The worker now runs it directly and AWAITS it (bounded by the job's
// own timeout), rather than leaving it detached inside the web server.
export async function maybeCoverageSnapshot(): Promise<{ wrote: boolean }> {
  try {
    const sb = createServerClient();
    const nowS = Math.floor(Date.now() / 1000);
    const { data: mark } = await sb.from('tps_progress_cursors').select('last_raw_id').eq('category', '_ledger_tick').eq('store_id', 0).maybeSingle();
    if (nowS - Number(mark?.last_raw_id ?? 0) < LEDGER_INTERVAL_S) return { wrote: false };
    await sb.from('tps_progress_cursors').upsert({ category: '_ledger_tick', store_id: 0, last_raw_id: nowS, updated_at: new Date().toISOString() }, { onConflict: 'category,store_id' });
    await writeCoverageSnapshot(sb as never, new Date().toISOString());
    return { wrote: true };
  } catch (e) { console.error('[dispatch] coverage snapshot skipped:', e instanceof Error ? e.message : e); return { wrote: false }; }
}

export const maxDuration = 60;

// E7 (canonical linkage on ingestion) — closed via a THROTTLED progressive sweep
// on the every-minute dispatch tick. At most one bounded unit (≤500 obs) every
// SWEEP_INTERVAL_S, so newly-ingested observations are linked + corroborated
// continuously without new infra. Throttle marker lives in tps_progress_cursors
// (category '_sweep_tick', store_id 0, last_raw_id = epoch seconds). Best-effort:
// failures never block the scraping dispatch.
const SWEEP_INTERVAL_S = 900; // 15 min
// Exported for the same reason as maybeCoverageSnapshot above.
export async function maybeProgressiveSweep(): Promise<{ ran: boolean; scanned?: number }> {
  try {
    const sb = createServerClient();
    const nowS = Math.floor(Date.now() / 1000);
    const { data: mark } = await sb.from('tps_progress_cursors')
      .select('last_raw_id').eq('category', '_sweep_tick').eq('store_id', 0).maybeSingle();
    const last = Number(mark?.last_raw_id ?? 0);
    if (nowS - last < SWEEP_INTERVAL_S) return { ran: false };
    // claim the slot first (avoid overlap across cluster instances)
    await sb.from('tps_progress_cursors').upsert(
      { category: '_sweep_tick', store_id: 0, last_raw_id: nowS, updated_at: new Date().toISOString() },
      { onConflict: 'category,store_id' });
    const r = await runSweepUnit(sb as never, Object.values(CATEGORY_DEFS), 500);
    return { ran: true, scanned: r.normalize.fetched };
  } catch (e) {
    console.error('[dispatch] progressive sweep skipped:', e instanceof Error ? e.message : e);
    return { ran: false };
  }
}

/**
 * POST /api/cron/dispatch
 * Called every minute by the PM2 scheduler process. Reads due scraping_schedules
 * and fires off the appropriate per-store cron routes.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // dispatchDueSchedules() stays here — it is thin (scraping_schedules is a
    // near-empty stub in production, see schedule-dispatcher.ts) and safe for
    // an HTTP request/response cycle either way.
    //
    // CHANGED 2026-09-17 (isolated-worker migration, SEV-1 follow-up): this
    // route used to ALSO run the progressive sweep and coverage snapshot —
    // real, DB-heavy background work — DETACHED after responding, so the
    // work continued executing inside tawveeri-main's process invisibly to
    // the caller. That is exactly the pattern the migration exists to
    // eliminate. Those two jobs are now owned exclusively by the isolated
    // worker's own schedule (scripts/worker/jobs/dispatch-sweep.ts). A call
    // to this route — manual, admin, or from any other trigger — no longer
    // silently falls back to running them here; it reports that plainly
    // instead.
    const result = await dispatchDueSchedules();
    return NextResponse.json({ success: true, ...result, sweep: 'owned_by_isolated_worker', coverage_snapshot: 'owned_by_isolated_worker' });
  } catch (error) {
    console.error('[dispatch] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Scraping dispatcher endpoint',
  });
}
